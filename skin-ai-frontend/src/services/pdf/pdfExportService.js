import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { API_URL } from "../../config";
import {
  generateMonitoringInsight,
  generateMonitoringReminder,
  generateSmartRecommendations,
  getConditionStatus,
} from "../../utils/monitoring";

const formatDate = (dateString, withTime = false) => {
  if (!dateString) return "-";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
  });
};

const safeFileName = (value) =>
  (value || "Pasien")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_");

const toPercent = (value = 0) => {
  const numberValue = Number(value || 0);
  const normalized = numberValue > 1 ? numberValue : numberValue * 100;

  return Math.max(0, Math.min(100, Math.round(normalized)));
};

const escapeHtml = (value = "") =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const asArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];

  return String(value)
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const imageUrl = (path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }

  return `${API_URL}/uploads/${path}`;
};

const blobToDataUrl = (blob) =>
  new Promise((resolve) => {
    const reader = new FileReader();

    reader.onloadend = () => resolve(reader.result || "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(blob);
  });

const loadImageAsDataUrl = async (url) => {
  if (!url) return "";
  if (url.startsWith("data:")) return url;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      mode: "cors",
    });

    if (!response.ok) return "";

    const blob = await response.blob();

    if (!blob.type.startsWith("image/")) return "";

    return await blobToDataUrl(blob);
  } catch (error) {
    console.error("PDF IMAGE LOAD ERROR:", error);
    return "";
  }
};

const waitForReportImages = async (root) => {
  const images = Array.from(root.querySelectorAll("img"));

  await Promise.all(
    images.map(
      (image) =>
        new Promise((resolve) => {
          if (image.complete && image.naturalWidth > 0) {
            resolve();
            return;
          }

          image.onload = () => resolve();
          image.onerror = () => resolve();
        })
    )
  );

  await Promise.all(
    images.map((image) =>
      typeof image.decode === "function"
        ? image.decode().catch(() => undefined)
        : Promise.resolve()
    )
  );
};

const metricRows = (session = {}) => [
  { label: "Berminyak", value: session.oily, color: "#2563eb" },
  { label: "Kering", value: session.dry_skin, color: "#f59e0b" },
  { label: "Kombinasi", value: session.combination_skin, color: "#8b5cf6" },
  { label: "Normal", value: session.normal_skin, color: "#10b981" },
  { label: "Sensitif", value: session.sensitive_skin, color: "#ef4444" },
];

const buildChartSvg = (sessions = []) => {
  const points = sessions.map((session, index) => ({
    label: `S${session.session_number || index + 1}`,
    confidence: toPercent(session.confidence),
  }));

  if (!points.length) {
    return `<div class="empty-chart">Belum ada data monitoring chart.</div>`;
  }

  const width = 640;
  const height = 190;
  const padding = 34;
  const plotted = points.map((point, index) => {
    const x =
      points.length > 1
        ? padding + (index * (width - padding * 2)) / (points.length - 1)
        : width / 2;
    const y = height - padding - (point.confidence / 100) * (height - padding * 2);

    return { ...point, x, y };
  });
  const path = plotted
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const area = `${path} L ${plotted.at(-1)?.x || padding} ${height - padding} L ${
    plotted[0]?.x || padding
  } ${height - padding} Z`;

  return `
    <svg class="monitoring-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img">
      <defs>
        <linearGradient id="pdfMonitorLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#2563eb" />
          <stop offset="100%" stop-color="#10b981" />
        </linearGradient>
      </defs>
      ${[25, 50, 75, 100]
        .map((tick) => {
          const y = height - padding - (tick / 100) * (height - padding * 2);
          return `
            <g>
              <line x1="${padding}" x2="${width - padding}" y1="${y}" y2="${y}" stroke="#e2e8f0" stroke-dasharray="5 6" />
              <text x="${padding - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#94a3b8">${tick}%</text>
            </g>
          `;
        })
        .join("")}
      <path d="${area}" fill="#dbeafe" opacity="0.62" />
      <path d="${path}" fill="none" stroke="url(#pdfMonitorLine)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
      ${plotted
        .map(
          (point) => `
            <g>
              <circle cx="${point.x}" cy="${point.y}" r="8" fill="#ffffff" stroke="#2563eb" stroke-width="4" />
              <text x="${point.x}" y="${point.y - 16}" text-anchor="middle" font-size="12" font-weight="700" fill="#334155">${point.confidence}%</text>
              <text x="${point.x}" y="${height - 6}" text-anchor="middle" font-size="12" font-weight="700" fill="#64748b">${escapeHtml(point.label)}</text>
            </g>
          `
        )
        .join("")}
    </svg>
  `;
};

const listItems = (items = []) =>
  items.length
    ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>Belum ada rekomendasi khusus pada session ini.</li>";

const buildTemplate = async ({ patient = {}, session = {}, sessions = [] }) => {
  const exportDate = new Date();
  const orderedSessions = sessions.length ? sessions : [session].filter(Boolean);
  const firstSession = orderedSessions[0] || session;
  const latestSession = session || orderedSessions.at(-1) || {};
  const confidence = toPercent(latestSession.confidence);
  const conditionStatus = getConditionStatus(orderedSessions);
  const insights = generateMonitoringInsight(orderedSessions);
  const reminder = generateMonitoringReminder(orderedSessions);
  const recommendations = generateSmartRecommendations(orderedSessions, latestSession);
  const mainImage = await loadImageAsDataUrl(imageUrl(latestSession.image_path));
  const beforeImage =
    firstSession?.image_path && firstSession.image_path !== latestSession.image_path
      ? await loadImageAsDataUrl(imageUrl(firstSession.image_path))
      : "";
  const ingredients = asArray(latestSession.ingredients);
  const products = asArray(latestSession.products);
  const tips = asArray(latestSession.tips);
  const patientName = patient.nama_pasien || latestSession.nama_pasien || "-";
  const patientCode = patient.kode_pasien || latestSession.kode_pasien || "-";
  const examDate = latestSession.exam_date || latestSession.created_at;

  return `
    <div class="pdf-report">
      <style>
        .pdf-report {
          width: 794px;
          min-height: 1123px;
          padding: 32px;
          background: #f8fafc;
          color: #0f172a;
          font-family: Arial, Helvetica, sans-serif;
          box-sizing: border-box;
          letter-spacing: 0;
          overflow: hidden;
        }
        .pdf-report * {
          box-sizing: border-box;
        }
        .hero {
          background: linear-gradient(135deg, #eff6ff 0%, #ffffff 62%, #ecfeff 100%);
          border: 1px solid #dbeafe;
          border-radius: 24px;
          padding: 24px;
          display: flex;
          justify-content: space-between;
          gap: 20px;
        }
        .brand { display: flex; align-items: center; gap: 14px; }
        .logo {
          width: 54px; height: 54px; border-radius: 18px;
          background: #2563eb; color: white; display: flex;
          align-items: center; justify-content: center;
          font-size: 25px; font-weight: 800;
          box-shadow: 0 18px 40px rgba(37, 99, 235, .22);
        }
        h1, h2, h3, p { margin: 0; }
        h1 { font-size: 30px; color: #1e3a8a; }
        .subtitle { margin-top: 5px; color: #475569; font-size: 13px; font-weight: 700; }
        .timestamp { text-align: right; color: #475569; font-size: 11px; line-height: 1.6; }
        .section { margin-top: 18px; break-inside: avoid; page-break-inside: avoid; }
        .section-break { break-before: page; page-break-before: always; }
        .section-title { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 10px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .card {
          background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px;
          padding: 16px; box-shadow: 0 12px 30px rgba(15, 23, 42, .05);
          break-inside: avoid; page-break-inside: avoid;
        }
        .summary-card { min-height: 74px; }
        .label { color: #64748b; font-size: 10px; font-weight: 800; text-transform: uppercase; }
        .value { margin-top: 5px; color: #0f172a; font-size: 15px; font-weight: 800; }
        .badge {
          display: inline-block; border-radius: 999px; padding: 7px 11px;
          background: #dbeafe; color: #1d4ed8; font-size: 11px; font-weight: 800;
        }
        .image-card img {
          width: 100%; height: 245px; object-fit: cover; border-radius: 18px;
          border: 1px solid #e2e8f0; background: #f1f5f9;
        }
        .image-placeholder {
          height: 245px; border-radius: 18px; border: 1px dashed #cbd5e1;
          display: flex; align-items: center; justify-content: center;
          color: #64748b; font-weight: 700; background: #f8fafc;
        }
        .metric { margin-top: 10px; }
        .metric-row { display: grid; grid-template-columns: 92px 1fr 42px; gap: 10px; align-items: center; margin: 10px 0; }
        .metric-label { font-size: 12px; color: #334155; font-weight: 800; }
        .bar { height: 9px; border-radius: 999px; background: #e2e8f0; overflow: hidden; }
        .bar span { display: block; height: 100%; border-radius: 999px; }
        .metric-value { text-align: right; font-size: 12px; color: #0f172a; font-weight: 800; }
        ul { margin: 10px 0 0 18px; padding: 0; color: #334155; font-size: 12px; line-height: 1.55; }
        li { margin-bottom: 6px; }
        .insight { border-left: 4px solid #2563eb; padding-left: 12px; margin-top: 9px; color: #334155; font-size: 12px; line-height: 1.55; }
        .chart-section {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .chart-wrap {
          width: 100%;
          max-width: 704px;
          overflow: visible;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 14px;
        }
        .monitoring-chart {
          width: 100%;
          max-width: 676px;
          height: 200px;
          display: block;
          overflow: visible;
        }
        .empty-chart { height: 120px; display: flex; align-items: center; justify-content: center; color: #64748b; }
        .rec-card h3 { font-size: 14px; color: #0f172a; margin-top: 8px; }
        .footer {
          margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 14px;
          display: flex; justify-content: space-between; align-items: flex-end;
          color: #64748b; font-size: 10px; line-height: 1.5;
        }
        .qr {
          width: 58px; height: 58px; border-radius: 12px; border: 1px solid #cbd5e1;
          background:
            linear-gradient(90deg, #0f172a 8px, transparent 8px) 8px 8px / 18px 18px,
            linear-gradient(#0f172a 8px, transparent 8px) 8px 8px / 18px 18px,
            #ffffff;
        }
      </style>

      <section class="hero">
        <div class="brand">
          <div class="logo">S</div>
          <div>
            <h1>SkinAI</h1>
            <p class="subtitle">Sistem Monitoring Kulit Klinik</p>
          </div>
        </div>
        <div class="timestamp">
          <strong>Laporan Monitoring Kulit</strong><br />
          Tanggal export: ${escapeHtml(formatDate(exportDate))}<br />
          Generated: ${escapeHtml(formatDate(exportDate, true))}
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">Informasi Pasien</h2>
        <div class="grid-3">
          <div class="card summary-card"><p class="label">Nama Pasien</p><p class="value">${escapeHtml(patientName)}</p></div>
          <div class="card summary-card"><p class="label">Kode Pasien</p><p class="value">${escapeHtml(patientCode)}</p></div>
          <div class="card summary-card"><p class="label">Tanggal Pemeriksaan</p><p class="value">${escapeHtml(formatDate(examDate))}</p></div>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">Hasil Pemeriksaan</h2>
        <div class="grid-3">
          <div class="card summary-card"><p class="label">Jenis Kulit</p><p class="value">${escapeHtml(latestSession.dominant_skin_type || "-")}</p></div>
          <div class="card summary-card"><p class="label">Tingkat Akurasi</p><p class="value">${confidence}%</p></div>
          <div class="card summary-card"><p class="label">Status Monitoring</p><p class="value"><span class="badge">${escapeHtml(conditionStatus.label)}</span></p></div>
        </div>
      </section>

      <section class="section grid-2">
        <div class="card image-card">
          <h2 class="section-title">Foto Pemeriksaan</h2>
          ${
            mainImage
              ? `<img src="${mainImage}" alt="Foto pemeriksaan" />`
              : `<div class="image-placeholder">Foto tidak tersedia</div>`
          }
        </div>
        <div class="card image-card">
          <h2 class="section-title">Before vs After</h2>
          <div class="grid-2">
            ${
              beforeImage
                ? `<img src="${beforeImage}" alt="Before" />`
                : `<div class="image-placeholder">Before belum tersedia</div>`
            }
            ${
              mainImage
                ? `<img src="${mainImage}" alt="After" />`
                : `<div class="image-placeholder">After belum tersedia</div>`
            }
          </div>
        </div>
      </section>

      <section class="section grid-2">
        <div class="card">
          <h2 class="section-title">Parameter Kulit</h2>
          <div class="metric">
            ${metricRows(latestSession)
              .map((metric) => {
                const percent = toPercent(metric.value);
                return `
                  <div class="metric-row">
                    <span class="metric-label">${escapeHtml(metric.label)}</span>
                    <span class="bar"><span style="width:${percent}%; background:${metric.color};"></span></span>
                    <span class="metric-value">${percent}%</span>
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>
        <div class="card">
          <h2 class="section-title">Monitoring Insight</h2>
          <p class="badge">${escapeHtml(conditionStatus.description)}</p>
          ${insights.map((item) => `<p class="insight">${escapeHtml(item)}</p>`).join("")}
        </div>
      </section>

      <section class="section section-break chart-section" data-pdf-keep="true">
        <h2 class="section-title">Monitoring Chart</h2>
        <div class="chart-wrap">
          ${buildChartSvg(orderedSessions)}
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">Rekomendasi</h2>
        <div class="grid-3">
          ${recommendations
            .map(
              (group) => `
                <div class="card rec-card">
                  <span class="badge">${escapeHtml(group.priority)}</span>
                  <h3>${escapeHtml(group.title)}</h3>
                  <ul>${listItems(group.items)}</ul>
                </div>
              `
            )
            .join("")}
        </div>
      </section>

      <section class="section grid-2">
        <div class="card">
          <h2 class="section-title">Reminder Monitoring</h2>
          <p class="value">${escapeHtml(reminder.title)}</p>
          <p class="insight">${escapeHtml(reminder.message)}</p>
        </div>
        <div class="card">
          <h2 class="section-title">Catatan Pendukung</h2>
          <ul>
            ${listItems([...ingredients, ...products, ...tips].slice(0, 6))}
          </ul>
        </div>
      </section>

      <footer class="footer">
        <div>
          <strong>Generated by SkinAI</strong><br />
          Laporan ini dibuat otomatis untuk mendukung monitoring klinik dan perlu divalidasi sesuai kebutuhan klinis.<br />
          Timestamp: ${escapeHtml(exportDate.toISOString())}
        </div>
        <div class="qr" aria-label="QR placeholder"></div>
      </footer>
    </div>
  `;
};

const createReportNode = (html) => {
  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-10000px";
  wrapper.style.top = "0";
  wrapper.style.width = "794px";
  wrapper.style.overflow = "hidden";
  wrapper.style.background = "#ffffff";
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  return wrapper;
};

const canvasToPdf = (canvas, filename, protectedRanges = []) => {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 8;
  const imgWidth = pageWidth - margin * 2;
  const usablePageHeight = pageHeight - margin * 2;
  const pageCanvas = document.createElement("canvas");
  const pageContext = pageCanvas.getContext("2d");
  const pageHeightPx = Math.floor((canvas.width * usablePageHeight) / imgWidth);
  const minSlicePx = Math.floor(canvas.width * 0.18);
  const overlapPx = Math.floor(canvas.width * 0.015);
  let renderedHeight = 0;
  let pageIndex = 0;

  pageCanvas.width = canvas.width;

  while (renderedHeight < canvas.height) {
    let sliceHeight = Math.min(pageHeightPx, canvas.height - renderedHeight);
    const sliceEnd = renderedHeight + sliceHeight;
    const crossingProtectedRange = protectedRanges.find(
      (range) =>
        renderedHeight < range.start &&
        sliceEnd > range.start &&
        sliceEnd < range.end
    );

    if (
      crossingProtectedRange &&
      crossingProtectedRange.start - renderedHeight > minSlicePx
    ) {
      sliceHeight = crossingProtectedRange.start - renderedHeight;
    }

    pageCanvas.height = sliceHeight;
    pageContext.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
    pageContext.drawImage(
      canvas,
      0,
      renderedHeight,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight
    );

    const pageData = pageCanvas.toDataURL("image/jpeg", 0.96);
    const pageImageHeight = (sliceHeight * imgWidth) / canvas.width;

    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(pageData, "JPEG", margin, margin, imgWidth, Math.min(pageImageHeight, usablePageHeight));

    const nextRenderedHeight = renderedHeight + sliceHeight;
    renderedHeight =
      nextRenderedHeight < canvas.height
        ? Math.max(nextRenderedHeight - overlapPx, renderedHeight + 1)
        : nextRenderedHeight;
    pageIndex += 1;
  }

  pdf.save(filename);
};

export const exportProfessionalSkinAiPdf = async ({
  patient = {},
  session = {},
  sessions = [],
} = {}) => {
  const reportHtml = await buildTemplate({ patient, session, sessions });
  const reportNode = createReportNode(reportHtml);
  const patientName = patient.nama_pasien || session.nama_pasien || "Pasien";
  const fileDate = (session.exam_date || session.created_at || new Date().toISOString())
    .toString()
    .slice(0, 10);

  try {
    await waitForReportImages(reportNode);

    const reportElement = reportNode.firstElementChild;
    const canvas = await html2canvas(reportElement, {
      backgroundColor: "#f8fafc",
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      windowWidth: 794,
      width: 794,
      scrollX: 0,
      scrollY: 0,
    });

    const canvasScale = canvas.width / reportElement.offsetWidth;
    const protectedRanges = Array.from(reportElement.querySelectorAll("[data-pdf-keep]"))
      .map((element) => ({
        start: Math.max(0, Math.floor(element.offsetTop * canvasScale) - Math.floor(24 * canvasScale)),
        end: Math.ceil((element.offsetTop + element.offsetHeight) * canvasScale) + Math.floor(24 * canvasScale),
      }));

    canvasToPdf(
      canvas,
      `SkinAI_Clinic_Report_${safeFileName(patientName)}_${fileDate}.pdf`,
      protectedRanges
    );
  } finally {
    reportNode.remove();
  }
};

export const exportSkinAiPdf = (data) =>
  exportProfessionalSkinAiPdf({
    patient: data,
    session: data,
    sessions: [data].filter(Boolean),
  });
