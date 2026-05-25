import { memo, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileText,
  HeartPulse,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import UserPortalShell from "../components/UserPortalShell";
import { ButtonSpinner } from "../components/ui";
import { getUserHistory } from "../services/HistoryService";
import { API_URL } from "../config";
import {
  calculateHealthScore,
  generateMonitoringInsight,
  getConditionStatus,
  getSessionQualityStatus,
} from "../utils/monitoring";

const toneClass = {
  green: {
    card: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-600",
    dot: "bg-emerald-500",
    icon: "bg-emerald-100 text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700",
    ring: "#10b981",
  },
  yellow: {
    card: "bg-amber-50 border-amber-200",
    text: "text-amber-600",
    dot: "bg-amber-500",
    icon: "bg-amber-100 text-amber-600",
    badge: "bg-amber-100 text-amber-700",
    ring: "#f59e0b",
  },
  red: {
    card: "bg-red-50 border-red-200",
    text: "text-red-600",
    dot: "bg-red-500",
    icon: "bg-red-100 text-red-600",
    badge: "bg-red-100 text-red-700",
    ring: "#ef4444",
  },
  blue: {
    card: "bg-blue-50 border-blue-200",
    text: "text-blue-600",
    dot: "bg-blue-500",
    icon: "bg-blue-100 text-blue-600",
    badge: "bg-blue-100 text-blue-700",
    ring: "#2563eb",
  },
};

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const renderTrendIcon = (trend, size = 22) => {
  if (trend === "up") return <TrendingUp size={size} />;
  if (trend === "down") return <TrendingDown size={size} />;
  return <Minus size={size} />;
};

const renderSessionIcon = (status) => {
  if (status.label === "Valid") return <CheckCircle2 size={18} />;
  if (status.label === "Low Confidence") return <Clock3 size={18} />;
  return <AlertTriangle size={18} />;
};

const MonitoringChart = memo(function MonitoringChart({ points, path }) {
  const width = 720;
  const height = 220;
  const padding = 28;

  if (!points.length) return null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-[200px] w-full sm:h-[220px]"
      role="img"
      aria-label="Grafik monitoring tingkat akurasi"
    >
      <defs>
        <linearGradient id="userMonitorLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
      </defs>

      {[25, 50, 75, 100].map((tick) => {
        const y = height - padding - (tick / 100) * (height - padding * 2);

        return (
          <g key={tick}>
            <line
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              stroke="#e2e8f0"
              strokeDasharray="5 6"
            />
            <text x={padding - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
              {tick}%
            </text>
          </g>
        );
      })}

      <path
        d={`${path} L ${points.at(-1)?.x || padding} ${height - padding} L ${points[0]?.x || padding} ${height - padding} Z`}
        fill="#dbeafe"
        opacity="0.55"
      />
      <path
        d={path}
        fill="none"
        stroke="url(#userMonitorLine)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {points.map((point) => (
        <g key={point.label}>
          <circle cx={point.x} cy={point.y} r="8" fill="#ffffff" stroke="#2563eb" strokeWidth="4" />
          <text x={point.x} y={point.y - 16} textAnchor="middle" fontSize="12" fontWeight="700" fill="#334155">
            {point.confidence}%
          </text>
          <text x={point.x} y={height - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill="#64748b">
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  );
});

export default function UserHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        const rows = await getUserHistory();
        setHistory(rows);
        setSelectedId(rows[0]?.id || null);
      } catch (error) {
        toast.error(error.message || "Riwayat user gagal dimuat");
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, []);

  const orderedHistory = useMemo(
    () =>
      [...history].sort(
        (a, b) =>
          new Date(a.exam_date || a.created_at || 0).getTime() -
          new Date(b.exam_date || b.created_at || 0).getTime()
      ),
    [history]
  );
  const latest = orderedHistory.at(-1);
  const selectedSession =
    orderedHistory.find((item) => Number(item.id) === Number(selectedId)) || latest;
  const conditionStatus = useMemo(() => getConditionStatus(orderedHistory), [orderedHistory]);
  const healthScore = useMemo(() => calculateHealthScore(orderedHistory), [orderedHistory]);
  const insights = useMemo(() => generateMonitoringInsight(orderedHistory), [orderedHistory]);
  const conditionTone = toneClass[conditionStatus.tone] || toneClass.blue;
  const healthTone = toneClass[healthScore.tone] || toneClass.blue;

  const chart = useMemo(() => {
    const width = 720;
    const height = 220;
    const padding = 28;
    const points = orderedHistory.map((session, index) => {
      const confidence = Math.round((Number(session.confidence || 0) > 1 ? session.confidence : session.confidence * 100) || 0);
      const x =
        orderedHistory.length > 1
          ? padding + (index * (width - padding * 2)) / (orderedHistory.length - 1)
          : width / 2;
      const y = height - padding - (Math.min(confidence, 100) / 100) * (height - padding * 2);

      return {
        label: `S${session.session_number || index + 1}`,
        confidence,
        x,
        y,
      };
    });
    const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

    return { points, path };
  }, [orderedHistory]);

  const handleDownloadPdf = async (item) => {
    if (!item || exportingId) return;

    try {
      setExportingId(item.id);
      const { exportProfessionalSkinAiPdf } = await import("../services/pdfService");
      await exportProfessionalSkinAiPdf({
        patient: item,
        session: item,
        sessions: orderedHistory,
      });
      toast.success("PDF berhasil dibuat");
    } catch (error) {
      console.error("USER HISTORY PDF ERROR:", error);
      toast.error("PDF gagal dibuat");
    } finally {
      setExportingId(null);
    }
  };

  return (
    <UserPortalShell wide>
      <header className="flex flex-col gap-2">
        <p className="text-sm font-bold text-blue-600">Portal Pasien</p>
        <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">Riwayat Pemeriksaan</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
          Ringkasan monitoring dan daftar session pemeriksaan kulit Anda.
        </p>
      </header>

      {loading ? (
        <div className="rounded-[28px] bg-white/95 p-6 text-sm font-semibold text-slate-500 shadow-[0_18px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-100">
          <span className="inline-flex items-center gap-2">
            <ButtonSpinner /> Memuat riwayat...
          </span>
        </div>
      ) : history.length === 0 ? (
        <div className="rounded-[28px] bg-white/95 p-6 text-sm text-slate-500 shadow-[0_18px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-100">
          Belum ada riwayat pemeriksaan.
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition hover:shadow-md">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-400">Total Session</p>
                  <h2 className="mt-2 text-4xl font-black text-slate-800">{orderedHistory.length}</h2>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <FileText size={26} />
                </div>
              </div>
              <p className="border-t border-slate-100 pt-4 text-sm text-slate-500">
                Monitoring pemeriksaan pasien
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition hover:shadow-md">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-400">Last Scan</p>
                  <h2 className="mt-2 text-lg font-black text-slate-800">{formatDate(latest?.exam_date || latest?.created_at)}</h2>
                  <p className="mt-1 text-sm text-slate-400">{formatTime(latest?.created_at)}</p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                  <CalendarDays size={26} />
                </div>
              </div>
              <p className="border-t border-slate-100 pt-4 text-sm text-slate-500">
                Pemeriksaan terakhir
              </p>
            </div>

            <div className={`rounded-3xl border p-6 shadow-sm transition hover:shadow-md ${conditionTone.card}`}>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-500">Status Kondisi</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${conditionTone.dot}`} />
                    <h2 className={`text-3xl font-black ${conditionTone.text}`}>{conditionStatus.label}</h2>
                  </div>
                </div>
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${conditionTone.icon}`}>
                  {renderTrendIcon(conditionStatus.trend, 26)}
                </div>
              </div>
              <p className="text-sm leading-relaxed text-slate-500">{conditionStatus.description}</p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition hover:shadow-md">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-400">Health Score</p>
                  <h2 className={`mt-2 text-4xl font-black ${healthTone.text}`}>{healthScore.score}</h2>
                </div>
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl text-white"
                  style={{ background: healthTone.ring }}
                >
                  <HeartPulse size={26} />
                </div>
              </div>
              <p className="border-t border-slate-100 pt-4 text-sm font-semibold text-slate-500">
                {healthScore.label}
              </p>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Grafik Monitoring Kulit</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Perkembangan kualitas pemeriksaan pada setiap session
                  </p>
                </div>
                <span className="w-fit rounded-2xl bg-blue-50 px-4 py-2 text-sm font-black text-blue-600">
                  {orderedHistory.length} Titik Data
                </span>
              </div>
              <div className="overflow-x-auto">
                <MonitoringChart points={chart.points} path={chart.path} />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-400">Monitoring Insight</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-800">Catatan Perkembangan</h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Activity size={24} />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {insights.map((item, index) => (
                  <div key={`${item}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-sm leading-relaxed text-slate-600">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5">
              <h2 className="text-2xl font-black text-slate-800">Session Pemeriksaan</h2>
              <p className="mt-1 text-sm text-slate-400">
                Pilih session untuk melihat ringkasan dan aksi pemeriksaan.
              </p>
            </div>

            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max gap-4">
                {orderedHistory.map((session, index) => {
                  const sessionStatus = getSessionQualityStatus(session);
                  const sessionTone = toneClass[sessionStatus.tone] || toneClass.blue;
                  const isSelected = Number(selectedSession?.id) === Number(session.id);
                  const isLatest = Number(latest?.id) === Number(session.id);
                  const confidence = Math.round((session.confidence || 0) * 100);

                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => setSelectedId(session.id)}
                      className={`relative w-[260px] shrink-0 overflow-hidden rounded-3xl border p-5 text-left transition-all duration-300 ${
                        isSelected
                          ? "border-blue-500 bg-gradient-to-br from-blue-600 to-indigo-600 shadow-xl shadow-blue-100"
                          : "border-slate-200 bg-white hover:border-blue-200 hover:shadow-lg"
                      }`}
                    >
                      {isLatest && (
                        <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold uppercase text-blue-600 shadow-sm">
                          Latest
                        </div>
                      )}

                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${isSelected ? "bg-white/20 text-white" : sessionTone.icon}`}>
                            {renderSessionIcon(sessionStatus)}
                          </div>
                          <div className={`text-sm font-black ${isSelected ? "text-white" : "text-slate-700"}`}>
                            Session {session.session_number || index + 1}
                          </div>
                        </div>
                        <div className={`h-3 w-3 rounded-full ${sessionTone.dot}`} />
                      </div>

                      <div className={`mb-3 inline-flex rounded-full px-3 py-1 text-xs font-black ${isSelected ? "bg-white/20 text-white" : sessionTone.badge}`}>
                        {sessionStatus.label}
                      </div>

                      <div className={`mb-3 text-xs ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                        {formatDate(session.exam_date || session.created_at)}
                      </div>

                      <div className={`mb-4 text-lg font-black capitalize ${isSelected ? "text-white" : "text-slate-800"}`}>
                        {session.dominant_skin_type || "-"}
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className={isSelected ? "text-blue-100" : "text-slate-400"}>Tingkat Akurasi</span>
                          <span className={`font-semibold ${isSelected ? "text-white" : "text-slate-700"}`}>{confidence}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
                          <div
                            className={`h-2 rounded-full ${isSelected ? "bg-white" : sessionTone.dot}`}
                            style={{ width: `${confidence}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isSelected ? "bg-white/20 text-white" : sessionTone.badge}`}>
                          {sessionStatus.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {selectedSession && (
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
                <img
                  src={
                    selectedSession.image_path
                      ? `${API_URL}/uploads/${selectedSession.image_path}`
                      : "/placeholder.jpg"
                  }
                  alt={selectedSession.nama_pasien || "Foto pemeriksaan"}
                  className="h-[300px] w-full object-cover sm:h-[420px]"
                />
              </div>

              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-400">Session Terpilih</p>
                    <h2 className="mt-1 text-2xl font-black text-slate-800">
                      Session {selectedSession.session_number || "-"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(selectedSession.exam_date || selectedSession.created_at)}
                    </p>
                  </div>

                  <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-black capitalize text-blue-700">
                    {selectedSession.dominant_skin_type || "-"}
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-blue-50 p-4">
                    <p className="text-sm font-bold text-blue-500">Jenis Kulit</p>
                    <p className="mt-2 text-2xl font-black capitalize text-blue-700">
                      {selectedSession.dominant_skin_type || "-"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <p className="text-sm font-bold text-emerald-500">Akurasi</p>
                    <p className="mt-2 text-2xl font-black text-emerald-700">
                      {Math.round((selectedSession.confidence || 0) * 100)}%
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/result/${selectedSession.id}`)}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 active:scale-[0.99]"
                  >
                    <Eye size={18} /> Detail Pemeriksaan
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(selectedSession)}
                    disabled={exportingId === selectedSession.id}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 font-black text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50"
                  >
                    {exportingId === selectedSession.id ? <ButtonSpinner /> : <Download size={18} />}
                    Download PDF
                  </button>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </UserPortalShell>
  );
}
