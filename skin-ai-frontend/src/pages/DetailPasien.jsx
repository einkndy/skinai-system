import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileDown,
  ImageOff,
  Mail,
  PlusCircle,
  Sparkles,
  UserRound,
} from "lucide-react";

import { getPatientById } from "../services/HistoryService";
import { API_URL } from "../config";
import { markDetailFlow } from "../services/flowAudit";
import {
  generateMonitoringInsight,
  generateSmartRecommendations,
} from "../utils/monitoring";
import {
  buildFaceCondition,
  CONDITION_PROBABILITY_ITEMS,
  formatConditionLabel,
  formatConditionPercent,
  getConditionPercentValue,
} from "../utils/conditionAnalysis";
import { AnimatedPage, ButtonSpinner, EmptyState, OptimizedImage, SkeletonCard } from "../components/ui";
import { toast } from "sonner";
import Swal from "sweetalert2";

export default function DetailPasien() {
  const { id } = useParams();

  const navigate = useNavigate();
  const location = useLocation();

  const [patient, setPatient] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);
  const accountPopupShownRef = useRef(false);

  const escapePopupText = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const handleNewSession = useCallback(() => {
    navigate("/analisis", {
      state: {
        patientId: patient?.id,
        patientCode: patient?.kode_pasien,
        patientName: patient?.nama_pasien,
      },
    });
  }, [navigate, patient]);

  const handleExportPdf = useCallback(async () => {
    if (!selectedSession || exportingPdf) return;

    try {
      setExportingPdf(true);
      toast.info("Menyiapkan laporan PDF klinik...");
      const { exportProfessionalSkinAiPdf } = await import("../services/pdfService");
      await exportProfessionalSkinAiPdf({
        patient,
        session: selectedSession,
        sessions,
      });
      toast.success("Laporan PDF berhasil dibuat");
    } catch (error) {
      console.error("DETAIL PDF EXPORT ERROR:", error);
      toast.error("Laporan PDF gagal dibuat. Coba beberapa saat lagi.");
    } finally {
      setExportingPdf(false);
    }
  }, [exportingPdf, patient, selectedSession, sessions]);

  useEffect(() => {
    loadPatient();
  }, []);

  useEffect(() => {
    const accountInfo = location.state?.accountInfo;

    if (!accountInfo || accountPopupShownRef.current) return;

    accountPopupShownRef.current = true;

    Swal.fire({
      icon: "success",
      title: "AKUN PASIEN BERHASIL DIBUAT",
      html: `
        <div style="text-align:left;line-height:1.8">
          <p><b>Username:</b> ${escapePopupText(accountInfo.username)}</p>
          <p><b>Email:</b> ${escapePopupText(accountInfo.email)}</p>
          <p><b>Password default:</b> ${escapePopupText(accountInfo.password)}</p>
          <p style="margin-top:12px">Simpan informasi login ini dan berikan kepada pasien.</p>
        </div>
      `,
      confirmButtonText: "Saya sudah simpan",
      confirmButtonColor: "#2563eb",
      allowOutsideClick: false,
    }).finally(() => {
      navigate(location.pathname, {
        replace: true,
        state: {
          ...location.state,
          accountInfo: null,
        },
      });
    });
  }, [location.pathname, location.state, navigate]);

  const loadPatient = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const data = await getPatientById(id);

      console.log("DETAIL PASIEN:", data);
      markDetailFlow(data);

      setPatient(data.patient);

      setSessions(data.sessions);

      if (data.sessions.length > 0) {
        const latest = data.sessions[data.sessions.length - 1];

        setSelectedSession(latest);

      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Data pasien tidak tersedia");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AnimatedPage>
        <div className="p-4 sm:p-10">
          <SkeletonCard />
        </div>
      </AnimatedPage>
    );
  }

  if (errorMessage || !patient) {
    return (
      <AnimatedPage>
      <div className="page-enter bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 text-center">
        <EmptyState
          title={errorMessage || "Data pasien tidak tersedia"}
          subtitle="Silakan kembali ke daftar rekam medis atau muat data pasien yang lain."
        />

        <button
          onClick={() => navigate("/rekam-medis")}
          className="btn-premium mt-5 px-5 py-3 rounded-2xl bg-blue-600 text-white font-semibold"
        >
          Kembali ke Rekam Medis
        </button>
      </div>
      </AnimatedPage>
    );
  }

  if (!selectedSession) {
    return (
      <AnimatedPage>
      <div className="page-enter bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 text-center">
        <EmptyState
          title="Belum ada sesi pemeriksaan"
          subtitle="Tambahkan analisis baru untuk mulai membuat riwayat scan pasien."
        />

        <button
          onClick={handleNewSession}
          className="btn-premium mt-5 px-5 py-3 rounded-2xl bg-blue-600 text-white font-semibold"
        >
          Analisis Baru
        </button>
      </div>
      </AnimatedPage>
    );
  }

  const firstSession = sessions?.[0];

  const latestSession = sessions?.[sessions.length - 1];
  const isSameSession = (session, target) => {
    if (!session || !target) return false;
    if (session.id != null && target.id != null) return String(session.id) === String(target.id);
    if (session.session_number != null && target.session_number != null) {
      return Number(session.session_number) === Number(target.session_number);
    }

    return session === target;
  };
  const selectedSessionIndex = sessions.findIndex((session) => isSameSession(session, selectedSession));
  const selectedMonitoringSessions =
    selectedSessionIndex >= 0 ? sessions.slice(0, selectedSessionIndex + 1) : [selectedSession].filter(Boolean);
  const previousSession = selectedSessionIndex > 0 ? sessions[selectedSessionIndex - 1] : null;
  const nextSession =
    selectedSessionIndex >= 0 && selectedSessionIndex < sessions.length - 1
      ? sessions[selectedSessionIndex + 1]
      : null;
  const visualLeftSession = nextSession ? selectedSession : previousSession || selectedSession;
  const visualRightSession = nextSession || selectedSession;
  const canMoveToNextSession = Boolean(nextSession);
  const handleNextVisualSession = () => {
    if (nextSession) {
      setSelectedSession(nextSession);
    }
  };

  // =========================
  // SESSION COMPARISON
  // =========================

  const oilyDiff =
    latestSession && firstSession
      ? ((latestSession.oily - firstSession.oily) * 100).toFixed(1)
      : 0;

  const dryDiff =
    latestSession && firstSession
      ? ((latestSession.dry_skin - firstSession.dry_skin) * 100).toFixed(1)
      : 0;

  const hasEnoughSessions = sessions.length >= 2;

  // =========================
  // FORMAT DATE
  // =========================

  const formatDate = (dateString) => {
    if (!dateString) return "-";

    const date = new Date(dateString);

    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return "-";

    const date = new Date(dateString);

    return date
      .toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(/\./g, ":");
  };

  // =========================
  // INSIGHT MONITORING
  // =========================

  const insights = generateMonitoringInsight(selectedMonitoringSessions);
  const smartRecommendations = generateSmartRecommendations(selectedMonitoringSessions, selectedSession);

  const skinMetrics = [
    {
      label: "Berminyak",
      value: selectedSession?.oily || 0,
      color: "from-blue-500 to-cyan-400",
      bg: "bg-blue-50",
      text: "text-blue-600",
    },
    {
      label: "Kering",
      value: selectedSession?.dry_skin || 0,
      color: "from-orange-400 to-amber-300",
      bg: "bg-orange-50",
      text: "text-orange-600",
    },
    {
      label: "Kombinasi",
      value: selectedSession?.combination_skin || 0,
      color: "from-purple-500 to-fuchsia-400",
      bg: "bg-purple-50",
      text: "text-purple-600",
    },
    {
      label: "Normal",
      value: selectedSession?.normal_skin || 0,
      color: "from-emerald-500 to-teal-400",
      bg: "bg-emerald-50",
      text: "text-emerald-600",
    },
    {
      label: "Sensitif",
      value: selectedSession?.sensitive_skin || 0,
      color: "from-rose-500 to-pink-400",
      bg: "bg-rose-50",
      text: "text-rose-600",
    },
  ];
  const getSkinMetricPercentValue = (value) => {
    const number = Number(value || 0);

    if (!Number.isFinite(number)) return 0;

    return Math.max(0, Math.min(Math.round(number <= 1 ? number * 100 : number), 100));
  };
  const skinRankings = skinMetrics
    .map((metric) => ({
      ...metric,
      percentage: getSkinMetricPercentValue(metric.value),
    }))
    .sort((a, b) => b.percentage - a.percentage);
  const dominantSkinMetric = skinRankings[0];
  const secondarySkinMetric = skinRankings[1];
  const selectedCondition = buildFaceCondition(selectedSession);
  const getSkinMetricDescription = (label, percentage) => {
    const descriptions = {
      Berminyak: "Hasil pemeriksaan menunjukkan produksi sebum relatif tinggi pada area wajah.",
      Kering: "Kelembapan alami kulit terdeteksi lebih minim dibanding kategori lainnya.",
      Kombinasi: "Terdapat campuran area berminyak dan area kering pada wajah.",
      Normal: "Keseimbangan kadar minyak dan kelembapan kulit relatif stabil.",
      Sensitif: "Kulit menunjukkan potensi reaktivitas terhadap faktor lingkungan tertentu.",
    };

    return `${descriptions[label] || "Hasil pemeriksaan berhasil membaca kategori kulit ini."} Hasil pemeriksaan menunjukkan kondisi wajah saat ini ${label.toLowerCase()} sebesar ${percentage}%.`;
  };
  const conditionDescriptionMap = {
    jerawat: "Menunjukkan indikasi area inflamasi atau jerawat aktif.",
    komedo: "Menunjukkan kemungkinan penyumbatan pori-pori kulit.",
    kerutan: "Menunjukkan tanda garis halus atau penurunan elastisitas kulit.",
    flek_hitam: "Menunjukkan indikasi hiperpigmentasi pada area tertentu.",
    pori_pori_besar: "Menunjukkan visibilitas pori yang lebih besar dibanding area normal.",
  };
  const hasConditionPredictions = Object.keys(selectedCondition?.predictions || {}).length > 0;
  const conditionRankings = hasConditionPredictions
    ? CONDITION_PROBABILITY_ITEMS
        .map((item) => ({
          ...item,
          percentage: getConditionPercentValue(selectedCondition.predictions?.[item.key]),
        }))
        .sort((a, b) => b.percentage - a.percentage)
    : [];
  const dominantConditionMetric = conditionRankings[0];
  const secondaryConditionMetric = conditionRankings[1];
  const getSessionImageValue = (session) =>
    session?.image_url ||
    session?.photo_url ||
    session?.captured_image ||
    session?.image_path ||
    session?.image ||
    session?.photo ||
    "";
  const getSessionImageSrc = (session) => {
    const value = getSessionImageValue(session);

    if (!value) return "";
    if (/^(https?:|data:|blob:)/i.test(value)) return value;

    return `${API_URL}/uploads/${value}`;
  };
  const renderImagePlaceholder = (
    label = "Foto pemeriksaan tidak tersedia",
    className = "h-[260px] sm:h-[360px]"
  ) => (
    <div
      className={`flex ${className} flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-400`}
    >
      <ImageOff size={28} className="mb-3 text-slate-300" />
      <span className="text-slate-600">{label}</span>
      <span className="mt-1 text-xs font-medium text-slate-400">
        File foto untuk sesi ini tidak ditemukan.
      </span>
    </div>
  );

  const conditionToneClass = {
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
    orange: {
      card: "bg-orange-50 border-orange-200",
      text: "text-orange-600",
      dot: "bg-orange-500",
      icon: "bg-orange-100 text-orange-600",
      badge: "bg-orange-100 text-orange-700",
      ring: "#f97316",
    },
    slate: {
      card: "bg-slate-50 border-slate-200",
      text: "text-slate-600",
      dot: "bg-slate-400",
      icon: "bg-slate-100 text-slate-600",
      badge: "bg-slate-100 text-slate-700",
      ring: "#64748b",
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

  const renderRecommendationIcon = (priority) => {
    if (priority === "utama") return <Sparkles size={20} />;
    if (priority === "tambahan") return <PlusCircle size={20} />;
    return <Activity size={20} />;
  };

  return (
    <AnimatedPage>
    <div className="page-enter space-y-5 min-w-0">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0">
          <button
            onClick={() => navigate("/rekam-medis")}
            className="
              flex
              items-center
              gap-2
              px-4
              py-2
              rounded-xl
              bg-white
              shadow
              hover:bg-slate-100
              transition
              btn-premium
            "
          >
            <ArrowLeft size={18} />

            <span>Kembali</span>
          </button>

          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Detail Pasien</h1>

            <p className="text-slate-400 mt-1 break-words">
              Informasi lengkap hasil pemeriksaan kulit wajah pasien
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:flex gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exportingPdf || !selectedSession}
            className="
              btn-premium
              inline-flex
              items-center
              gap-2
              w-full
              sm:w-auto
              justify-center
              px-5
              py-3
              rounded-2xl
              bg-slate-800
              hover:bg-slate-900
              text-white
              font-semibold
              disabled:opacity-60
            "
          >
            {exportingPdf ? <ButtonSpinner /> : <FileDown size={18} />}
            {exportingPdf ? "Membuat PDF..." : "Ekspor PDF"}
          </button>

          <button
            onClick={handleNewSession}
            className="
              btn-premium
              inline-flex
              items-center
              gap-2
              w-full
              sm:w-auto
              justify-center
              px-5
              py-3
              rounded-2xl
              bg-blue-600
              hover:bg-blue-700
              text-white
              font-semibold
              shadow-lg
              shadow-blue-100
            "
          >
            <PlusCircle size={18} />
            Analisis Baru
          </button>
        </div>
      </div>

      {/* INFORMASI PASIEN */}
      <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col gap-1 mb-5">
          <h2 className="text-2xl font-bold text-slate-800">
            Informasi Pasien
          </h2>

          <p className="text-sm text-slate-400">
            Identitas pasien dan tanggal pemeriksaan sesi yang dipilih
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-100 text-blue-600">
                <UserRound size={20} />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-slate-400">
                  Nama Pasien
                </p>
                <p className="mt-1 truncate text-base font-bold text-slate-800">
                  {patient?.nama_pasien || selectedSession?.nama_pasien || "-"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-600">
                <Mail size={20} />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-slate-400">
                  Email
                </p>
                <p className="mt-1 truncate text-base font-bold text-slate-800">
                  {patient?.email || selectedSession?.patient_email || "-"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-600">
                <CalendarDays size={20} />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-slate-400">
                  Tanggal Pemeriksaan
                </p>
                <p className="mt-1 truncate text-base font-bold text-slate-800">
                  {formatDate(selectedSession?.exam_date || selectedSession?.created_at)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HASIL PEMERIKSAAN JENIS KULIT */}
      <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              Hasil Pemeriksaan Jenis Kulit
            </h2>

            <p className="text-sm text-slate-400 mt-1">
              Lima klasifikasi lengkap dari data histori sesi yang dipilih
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-5">
          <div className="rounded-3xl border border-blue-100 bg-blue-50/70 p-5">
            <p className="text-xs font-semibold uppercase text-blue-400">
              Jenis Kulit Dominan
            </p>

            <h3 className="mt-2 text-2xl font-bold capitalize text-blue-800 break-words">
              {dominantSkinMetric ? dominantSkinMetric.label : "-"}
            </h3>

            <div className="mt-5 grid grid-cols-1 gap-3">
              <div className="rounded-2xl bg-white/80 border border-blue-100 p-4">
                <p className="text-xs font-semibold uppercase text-blue-400">
                  Jenis Kulit Sekunder
                </p>
                <p className="mt-1 text-base font-bold text-blue-900">
                  {secondarySkinMetric ? secondarySkinMetric.label : "-"}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-white/80 border border-blue-100 p-4 text-sm leading-relaxed text-blue-800">
              <h4 className="mb-2 text-sm font-bold text-blue-900">
                Interpretasi Jenis Kulit
              </h4>
              {dominantSkinMetric ? (
                <>
                  <p>
                    Jenis kulit dominan yang terdeteksi adalah{" "}
                    <span className="font-bold">{dominantSkinMetric.label}</span>.
                  </p>
                  {secondarySkinMetric && (
                    <p className="mt-2">
                      Jenis kulit sekunder adalah{" "}
                      <span className="font-bold">{secondarySkinMetric.label}</span>.
                    </p>
                  )}
                </>
              ) : (
                <p>Data jenis kulit belum tersedia pada sesi ini.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {skinMetrics.map((metric) => {
              const percentage = getSkinMetricPercentValue(metric.value);

              return (
                <div
                  key={metric.label}
                  className="premium-card flex min-h-[210px] flex-col rounded-3xl border border-slate-100 bg-slate-50 p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-bold text-slate-800">
                      {metric.label}
                    </h3>

                    <span className={`shrink-0 rounded-2xl px-3 py-2 text-sm font-bold ${metric.bg} ${metric.text}`}>
                      {percentage}%
                    </span>
                  </div>

                  <div className="mt-4 h-3 rounded-full bg-white border border-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${metric.color}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <p className="mt-4 text-xs leading-relaxed text-slate-400">
                    {getSkinMetricDescription(metric.label, percentage)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HASIL PEMERIKSAAN KONDISI WAJAH */}
      <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              Hasil Pemeriksaan Kondisi Wajah
            </h2>

            <p className="text-sm text-slate-400 mt-1">
              Seluruh probabilitas dari model deteksi kondisi wajah
            </p>
          </div>
        </div>

        {selectedCondition ? (
          <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-5">
            <div className="rounded-3xl border border-violet-100 bg-violet-50/70 p-5">
              <p className="text-xs font-semibold uppercase text-violet-400">
                Kondisi Dominan
              </p>

              <h3 className="mt-2 text-2xl font-bold capitalize text-violet-800 break-words">
                {formatConditionLabel(selectedCondition.dominant_condition)}
              </h3>

              <div className="mt-5 grid grid-cols-1 gap-3">
                <div className="rounded-2xl bg-white/80 border border-violet-100 p-4">
                  <p className="text-xs font-semibold uppercase text-violet-400">
                    Kondisi Sekunder
                  </p>
                  <p className="mt-1 text-base font-bold text-violet-900">
                    {secondaryConditionMetric ? secondaryConditionMetric.label : "-"}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-white/80 border border-violet-100 p-4 text-sm leading-relaxed text-violet-800">
                <h4 className="mb-2 text-sm font-bold text-violet-900">
                  Interpretasi Kondisi Wajah
                </h4>
                {dominantConditionMetric ? (
                  <>
                    <p>
                      Kondisi dominan yang terdeteksi adalah{" "}
                      <span className="font-bold">{dominantConditionMetric.label}</span>.
                    </p>
                    {secondaryConditionMetric && (
                      <p className="mt-2">
                        Kondisi sekunder adalah{" "}
                        <span className="font-bold">{secondaryConditionMetric.label}</span>.
                      </p>
                    )}
                  </>
                ) : (
                  <p>Probabilitas kondisi wajah belum tersedia pada sesi ini.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CONDITION_PROBABILITY_ITEMS.map((item) => {
                const value = selectedCondition.predictions?.[item.key];
                const percentage = getConditionPercentValue(value);

                return (
                  <div
                    key={item.key}
                    className="rounded-3xl border border-violet-100 bg-violet-50/60 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-slate-700">
                        {item.label}
                      </p>

                      <p className="text-sm font-bold text-violet-700">
                        {formatConditionPercent(value)}
                      </p>
                    </div>

                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      {conditionDescriptionMap[item.key]}
                    </p>

                    <div className="mt-3 h-3 rounded-full bg-white border border-violet-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-violet-100 bg-violet-50/70 p-5 text-sm font-semibold text-violet-700">
            <h3 className="font-bold text-violet-900">
              Interpretasi Kondisi Wajah
            </h3>
            <p className="mt-2">
              Kondisi wajah belum tersedia pada sesi ini.
            </p>
          </div>
        )}
      </section>

      {/* CARD */}
      <div
        className="
        premium-card
        bg-gradient-to-b
        from-white
        to-slate-50
        rounded-3xl
        shadow-sm
        border
        border-slate-100
        p-5
        sm:p-7
        space-y-6
      "
      >
        {/* TIMELINE */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div className="min-w-0">
              <h3 className="text-2xl font-bold text-slate-800">
                Riwayat Pemeriksaan
              </h3>

              <p className="text-slate-400 mt-1">
                Riwayat pemantauan kondisi kulit pasien
              </p>
            </div>

            <div className="w-fit px-4 py-2 rounded-2xl bg-blue-50 text-blue-600 text-sm font-semibold">
              {sessions.length} Sesi
            </div>
          </div>

          <div className="flex items-center gap-4 overflow-x-auto pb-3">
            {sessions.map((session, index) => {
              const isSelected = selectedSession?.id === session.id;
              const isLatest = latestSession?.id === session.id;
              const sessionCondition = buildFaceCondition(session);
              const sessionConditionLabel = formatConditionLabel(sessionCondition?.dominant_condition);

              return (
                <div
                  key={session.id}
                  className="flex items-center stagger-item"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  {/* CARD */}
                  <div
                    onClick={() => setSelectedSession(session)}
                    className={`
                      min-w-[178px]
                      rounded-2xl
                      p-4
                      cursor-pointer
                      transition-all
                      duration-300
                      border
                      relative
                      overflow-hidden
                      group

                      ${
                        isSelected
                          ? "bg-gradient-to-br from-blue-600 to-indigo-600 border-blue-500 shadow-xl shadow-blue-100"
                          : "bg-white border-slate-200 hover:border-blue-200 hover:shadow-lg"
                      }
                    `}
                  >
                    {isLatest && (
                      <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold uppercase text-blue-600 shadow-sm">
                        Terbaru
                      </div>
                    )}

                    {/* SESSION NUMBER */}
                    <div
                      className={`
                        mb-3 text-sm font-bold
                        ${isSelected ? "text-white" : "text-slate-700"}
                      `}
                    >
                      Sesi {session.session_number}
                    </div>

                    {/* DATE */}
                    <div
                      className={`
                        text-xs mb-2
                        ${isSelected ? "text-blue-100" : "text-slate-400"}
                      `}
                    >
                      {formatDate(session.created_at)}
                    </div>

                    {/* RESULT */}
                    <div
                      className={`
                        text-base font-bold capitalize
                        ${isSelected ? "text-white" : "text-slate-800"}
                      `}
                    >
                      {session.dominant_skin_type}
                    </div>

                    <p
                      className={`mt-1 text-xs font-semibold ${
                        isSelected ? "text-blue-100" : "text-violet-600"
                      }`}
                    >
                      {sessionConditionLabel !== "-" ? sessionConditionLabel : "Kondisi belum tersedia"}
                    </p>
                  </div>

                  {/* CONNECTOR */}
                  {index !== sessions.length - 1 && (
                    <div className="relative w-16 h-[2px] bg-gradient-to-r from-blue-200 to-slate-200 rounded-full mx-2">
                      <div className="absolute left-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-blue-400" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* VISUAL TRACKING */}
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Pelacakan Visual Pemantauan
          </h2>

          {hasEnoughSessions && (
            <div className="flex items-center gap-3 mt-2 mb-5">
              <div className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
                Sesi Dipilih
              </div>

              <div className="flex items-center text-slate-400">
                {"\u2192"}
              </div>

              <div className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold">
                {canMoveToNextSession ? "Sesi Berikutnya" : "Sesi Terakhir"}
              </div>
            </div>
          )}

          {hasEnoughSessions ? (
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto_1fr] gap-6 items-start">
              {/* SESSION DIPILIH */}
              <div className="premium-card bg-slate-50 rounded-3xl p-5 border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800">
                      {canMoveToNextSession ? "Sesi Dipilih" : "Sesi Sebelumnya"}
                    </h3>

                    <p className="text-sm text-slate-400">
                      {canMoveToNextSession
                        ? "Pemeriksaan yang sedang dipilih"
                        : "Pembanding sebelum sesi terakhir"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                      {formatDate(visualLeftSession?.created_at)}
                    </p>
                  </div>

                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-600">
                    Sesi {visualLeftSession?.session_number || "-"}
                  </span>
                </div>

                <div className="relative group overflow-hidden rounded-[28px] bg-slate-100 border border-slate-200">
                  {getSessionImageSrc(visualLeftSession) ? (
                    <OptimizedImage
                      src={getSessionImageSrc(visualLeftSession)}
                      alt="Foto sesi dipilih"
                      fallback={renderImagePlaceholder()}
                      className="
                        image-fade
                        w-full
                        h-[260px]
                        sm:h-[360px]
                        object-cover
                        transition-all
                        duration-500
                        group-hover:scale-[1.02]
                      "
                    />
                  ) : (
                    renderImagePlaceholder()
                  )}
                </div>

              </div>

              {/* NEXT SESSION BUTTON */}
              <div className="flex items-center justify-center xl:pt-48">
                <button
                  type="button"
                  onClick={handleNextVisualSession}
                  disabled={!canMoveToNextSession}
                  title={canMoveToNextSession ? "Lihat sesi berikutnya" : "Sudah sesi terakhir"}
                  className={`
                    flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white shadow-lg transition-all duration-300
                    ${
                      canMoveToNextSession
                        ? "bg-gradient-to-br from-blue-500 to-purple-500 hover:scale-105 hover:shadow-purple-200"
                        : "cursor-not-allowed bg-slate-300 shadow-slate-100"
                    }
                  `}
                  aria-label={canMoveToNextSession ? "Lihat sesi berikutnya" : "Sudah sesi terakhir"}
                >
                  {"\u2192"}
                </button>
              </div>

              {/* SESSION BERIKUTNYA */}
              <div className="premium-card bg-slate-50 rounded-3xl p-5 border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800">
                      {canMoveToNextSession ? "Sesi Berikutnya" : "Sesi Terakhir"}
                    </h3>

                    <p className="text-sm text-slate-400">
                      {canMoveToNextSession
                        ? "Pemeriksaan setelah sesi dipilih"
                        : "Pemeriksaan terakhir"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                      {formatDate(visualRightSession?.created_at)}
                    </p>
                  </div>

                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-600">
                    Sesi {visualRightSession?.session_number || "-"}
                  </span>
                </div>

                <div className="relative group overflow-hidden rounded-[28px] bg-slate-100 border border-slate-200">
                  {getSessionImageSrc(visualRightSession) ? (
                    <OptimizedImage
                      src={getSessionImageSrc(visualRightSession)}
                      alt="Foto sesi berikutnya"
                      fallback={renderImagePlaceholder()}
                      className="
                        image-fade
                        w-full
                        h-[260px]
                        sm:h-[360px]
                        object-cover
                        transition-all
                        duration-500
                        group-hover:scale-[1.02]
                      "
                    />
                  ) : (
                    renderImagePlaceholder()
                  )}
                </div>

              </div>
            </div>
          ) : (
            <div className="premium-card bg-slate-50 rounded-3xl p-5 border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-800">
                    Foto Pemeriksaan
                  </h3>

                  <p className="text-sm text-slate-400">
                    Hasil scan terbaru pasien
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    {formatDate(selectedSession?.created_at)}
                  </p>
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-600">
                  Sesi {selectedSession?.session_number}
                </span>
              </div>

              <div className="relative group overflow-hidden rounded-[28px] bg-slate-100 border border-slate-200">
                {getSessionImageSrc(selectedSession) ? (
                  <OptimizedImage
                    src={getSessionImageSrc(selectedSession)}
                    alt="Foto pemeriksaan"
                    fallback={renderImagePlaceholder("Foto pemeriksaan tidak tersedia", "h-[280px] sm:h-[360px]")}
                    className="
                      image-fade
                      w-full
                      h-[280px]
                      sm:h-[360px]
                      object-cover
                      transition-all
                      duration-500
                      group-hover:scale-[1.02]
                  "
                  />
                ) : (
                  renderImagePlaceholder("Foto pemeriksaan tidak tersedia", "h-[280px] sm:h-[360px]")
                )}
              </div>
            </div>
          )}
        </div>

        {/* ========================= */}
        {/* COMPARATIVE ANALYTICS */}
        {/* ========================= */}

        {hasEnoughSessions ? (
          <div
            className="
              premium-card
              bg-white
              rounded-3xl
              border
              border-slate-100
              shadow-sm
              p-6
              mb-8
          "
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  Perkembangan Kondisi Kulit
                </h2>

                <p className="text-slate-400 text-sm mt-1">
                  Pemantauan perubahan dari sesi awal hingga terbaru
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* OILY */}
              <div
                className="
                  bg-slate-50
                  rounded-2xl
                  p-5
                  border
                  border-slate-100
              "
              >
                <div className="text-sm text-slate-400 mb-2">
                  Produksi Minyak
                </div>

                <div
                  className={`
                      text-3xl
                      font-bold
                      ${
                        oilyDiff < 0
                          ? "text-emerald-500"
                          : "text-orange-500"
                      }
                  `}
                >
                  {oilyDiff > 0 ? "+" : ""}
                  {oilyDiff}%
                </div>

                <div className="mt-2 text-sm text-slate-500">
                  {oilyDiff < 0
                    ? "Produksi minyak menurun"
                    : "Produksi minyak meningkat"}
                </div>
              </div>

              {/* DRY */}
              <div
                className="
                  bg-slate-50
                  rounded-2xl
                  p-5
                  border
                  border-slate-100
              "
              >
                <div className="text-sm text-slate-400 mb-2">
                  Tingkat Kekeringan
                </div>

                <div
                  className={`
                      text-3xl
                      font-bold
                      ${
                        dryDiff < 0
                          ? "text-emerald-500"
                          : "text-orange-500"
                      }
                  `}
                >
                  {dryDiff > 0 ? "+" : ""}
                  {dryDiff}%
                </div>

                <div className="mt-2 text-sm text-slate-500">
                  {dryDiff < 0
                    ? "Kondisi kulit lebih lembab"
                    : "Kulit lebih kering"}
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="premium-card bg-white rounded-3xl border border-slate-100 p-5 sm:p-8">
            <h3 className="text-2xl font-bold text-slate-800">
              Pemantauan Perkembangan
            </h3>

            <p className="text-slate-400 mt-2">
              Pemantauan perubahan kondisi kulit akan tersedia setelah minimal 2
              sesi pemeriksaan.
            </p>

            <div className="mt-6 bg-slate-50 rounded-2xl p-6 border border-dashed border-slate-200">
              <p className="text-slate-500 text-sm">
                Lakukan pemeriksaan berkala untuk melihat perkembangan kondisi
                kulit pasien secara visual dan analitis.
              </p>
            </div>
          </div>
        )}

        {/* ========================= */}
        {/* SMART CLINICAL INSIGHT */}
        {/* ========================= */}

        {insights.length > 0 && (
          <div
            className="
              premium-card
              bg-gradient-to-br
              from-blue-50
              to-indigo-50
              border
              border-blue-100
              rounded-3xl
              p-6
              mb-8
          "
          >
            <div className="flex items-center gap-3 mb-5">
              <div
                className="
                  w-12
                  h-12
                  rounded-2xl
                  bg-blue-500
                  flex
                  items-center
                  justify-center
                  text-white
                  text-xl
                  shadow-lg
              "
              >
                <Activity size={22} />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  Wawasan Pemantauan
                </h2>

                <p className="text-slate-500 text-sm">
                  Analisa perkembangan kondisi wajah berdasarkan sesi
                  pemeriksaan
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {insights.map((item, index) => (
                <div
                  key={index}
                  className="
                      bg-white/70
                      backdrop-blur-sm
                      rounded-2xl
                      p-4
                      border
                      border-white
                      shadow-sm
                      flex
                      items-start
                      gap-3
                  "
                >
                  <div
                    className="
                      min-w-[32px]
                      h-8
                      rounded-full
                      bg-blue-100
                      flex
                      items-center
                      justify-center
                      text-blue-600
                      font-bold
                      text-sm
                  "
                  >
                    {"\u2713"}
                  </div>

                  <p
                    className="
                      text-slate-700
                      leading-relaxed
                  "
                  >
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REKOMENDASI */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800">
              Rekomendasi Perawatan
            </h2>

            <p className="text-sm text-slate-400 mt-1">
              Rekomendasi personal berdasarkan jenis kulit dan riwayat pemantauan pasien
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {smartRecommendations.map((group) => {
              const recTone = conditionToneClass[group.tone] || conditionToneClass.blue;

              return (
              <div
                key={group.priority}
                className="monitoring-polish premium-card relative overflow-hidden bg-slate-50 rounded-3xl p-5 border border-slate-100"
              >
                <div className={`absolute top-0 left-0 right-0 h-1 ${recTone.dot}`} />

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold capitalize ${recTone.badge}`}>
                      {group.priority}
                    </span>
                    <h3 className="mt-3 text-lg font-bold text-slate-800">
                      {group.title}
                    </h3>
                  </div>

                  <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${recTone.icon}`}>
                    {renderRecommendationIcon(group.priority)}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {group.items.map((item, index) => (
                    <div key={index} className="flex items-start gap-2 rounded-2xl bg-white border border-slate-100 p-3">
                      <CheckCircle2 size={16} className={`mt-0.5 shrink-0 ${recTone.text}`} />
                      <p className="text-sm leading-relaxed text-slate-600">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </AnimatedPage>
  );
}
