import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileDown,
  HeartPulse,
  Minus,
  PlusCircle,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { getPatientById } from "../services/HistoryService";
import { API_URL } from "../config";
import { markDetailFlow } from "../services/flowAudit";
import {
  calculateHealthScore,
  generateMonitoringReminder,
  generateMonitoringInsight,
  generatePatientActivityFeed,
  generateSmartRecommendations,
  getConditionStatus,
  getSessionQualityStatus,
} from "../utils/monitoring";
import { AnimatedPage, ButtonSpinner, EmptyState, OptimizedImage, SkeletonCard } from "../components/ui";
import { toast } from "sonner";

const MonitoringChart = memo(function MonitoringChart({
  chartWidth,
  chartHeight,
  chartPadding,
  chartPath,
  chartPoints,
}) {
  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      className="w-full h-[200px] sm:h-[220px]"
      role="img"
      aria-label="Grafik monitoring tingkat akurasi"
    >
      <defs>
        <linearGradient id="monitorLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
      </defs>

      {[25, 50, 75, 100].map((tick) => {
        const y =
          chartHeight -
          chartPadding -
          (tick / 100) * (chartHeight - chartPadding * 2);

        return (
          <g key={tick}>
            <line
              x1={chartPadding}
              x2={chartWidth - chartPadding}
              y1={y}
              y2={y}
              stroke="#e2e8f0"
              strokeDasharray="5 6"
            />
            <text
              x={chartPadding - 10}
              y={y + 4}
              textAnchor="end"
              fontSize="11"
              fill="#94a3b8"
            >
              {tick}%
            </text>
          </g>
        );
      })}

      <path
        d={`${chartPath} L ${chartPoints.at(-1)?.x || chartPadding} ${
          chartHeight - chartPadding
        } L ${chartPoints[0]?.x || chartPadding} ${
          chartHeight - chartPadding
        } Z`}
        fill="#dbeafe"
        opacity="0.55"
      />

      <path
        d={chartPath}
        fill="none"
        stroke="url(#monitorLine)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {chartPoints.map((point) => (
        <g key={point.label}>
          <circle
            cx={point.x}
            cy={point.y}
            r="8"
            fill="#ffffff"
            stroke="#2563eb"
            strokeWidth="4"
          />
          <text
            x={point.x}
            y={point.y - 16}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill="#334155"
          >
            {point.confidence}%
          </text>
          <text
            x={point.x}
            y={chartHeight - 6}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill="#64748b"
          >
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  );
});

export default function DetailPasien() {
  const { id } = useParams();

  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);

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
          title="Belum ada session pemeriksaan"
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

  const confidenceDiff =
    latestSession && firstSession
      ? ((latestSession.confidence - firstSession.confidence) * 100).toFixed(1)
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

  const insights = generateMonitoringInsight(sessions);
  const conditionStatus = getConditionStatus(sessions);
  const healthScore = calculateHealthScore(sessions);
  const smartRecommendations = generateSmartRecommendations(sessions, selectedSession);
  const monitoringReminder = generateMonitoringReminder(sessions);
  const activityFeed = generatePatientActivityFeed(sessions);

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
  ];

  const sessionTrend = sessions.map((session) => ({
    label: `S${session.session_number}`,
    confidence: Math.round((session.confidence || 0) * 100),
  }));

  const chartWidth = 720;
  const chartHeight = 220;
  const chartPadding = 28;
  const chartPoints = sessionTrend.map((item, index) => {
    const x =
      sessionTrend.length > 1
        ? chartPadding +
          (index * (chartWidth - chartPadding * 2)) / (sessionTrend.length - 1)
        : chartWidth / 2;
    const y =
      chartHeight -
      chartPadding -
      (Math.min(item.confidence, 100) / 100) * (chartHeight - chartPadding * 2);

    return {
      ...item,
      x,
      y,
    };
  });
  const chartPath = chartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const getExamStatus = (confidence = 0) => {
    if (confidence >= 0.8) return "Valid";
    if (confidence >= 0.6) return "Perlu Validasi";
    return "Scan Ulang";
  };

  const getExamStatusClass = (confidence = 0) => {
    if (confidence >= 0.8) return "bg-emerald-100 text-emerald-700";
    if (confidence >= 0.6) return "bg-amber-100 text-amber-700";
    return "bg-red-100 text-red-700";
  };

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
    blue: {
      card: "bg-blue-50 border-blue-200",
      text: "text-blue-600",
      dot: "bg-blue-500",
      icon: "bg-blue-100 text-blue-600",
      badge: "bg-blue-100 text-blue-700",
      ring: "#2563eb",
    },
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

  const healthTone = conditionToneClass[healthScore.tone] || conditionToneClass.blue;
  const conditionTone = conditionToneClass[conditionStatus.tone] || conditionToneClass.blue;
  const reminderTone = conditionToneClass[monitoringReminder.tone] || conditionToneClass.blue;

  const renderRecommendationIcon = (priority) => {
    if (priority === "utama") return <Sparkles size={20} />;
    if (priority === "tambahan") return <PlusCircle size={20} />;
    return <Activity size={20} />;
  };

  const renderActivityIcon = (type) => {
    if (type === "warning") return <AlertTriangle size={18} />;
    if (type === "session") return <PlusCircle size={18} />;
    if (type === "status") return renderTrendIcon(conditionStatus.trend, 18);
    return <CheckCircle2 size={18} />;
  };

  return (
    <AnimatedPage>
    <div className="page-enter space-y-6 min-w-0">
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
            {exportingPdf ? "Membuat PDF..." : "Export PDF"}
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

      {/* TOP SUMMARY */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {/* TOTAL SESSION */}
        <div className="premium-card bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="min-w-0">
              <p className="text-sm text-slate-400 font-medium">
                Total Session
              </p>

              <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mt-2">
                {sessions.length}
              </h2>
            </div>

            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
              <span className="text-2xl">{"\u{1F4CA}"}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <p className="text-sm text-slate-500">
              Monitoring pemeriksaan pasien
            </p>
          </div>
        </div>

        {/* PACKAGE */}
        <div className="premium-card bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="min-w-0">
              <p className="text-sm text-slate-400 font-medium">
                Paket Monitoring
              </p>

              <h2 className="text-2xl sm:text-3xl font-bold text-violet-600 mt-2 capitalize break-words">
                {patient?.paket_type}
              </h2>
            </div>

            <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center">
              <span className="text-2xl">{"\u{1F9EC}"}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <p className="text-sm text-slate-500">
              Tracking kondisi kulit berkala
            </p>
          </div>
        </div>

        {/* LAST SCAN */}
        <div className="premium-card bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="min-w-0">
              <p className="text-sm text-slate-400 font-medium">Last Scan</p>

              <div className="mt-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-800 break-words">
                  {formatDate(latestSession?.created_at)}
                </h2>

                <p className="text-sm text-slate-400 mt-1">
                  {formatTime(latestSession?.created_at)}
                </p>
              </div>
            </div>

            <div className="w-14 h-14 rounded-2xl bg-cyan-50 flex items-center justify-center">
              <span className="text-2xl">{"\u{1F4F7}"}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <p className="text-sm text-slate-500">
              Pemeriksaan terakhir pasien
            </p>
          </div>
        </div>

        {/* STATUS */}
        <div
          className={`premium-card rounded-3xl p-6 border shadow-sm transition-all duration-300 ${conditionTone.card}`}
        >
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="min-w-0">
              <p className="text-sm text-slate-500 font-medium">
                Status Kondisi
              </p>

              <div className="flex items-center gap-2 mt-2">
                <div className={`w-3 h-3 rounded-full ${conditionTone.dot}`} />

                <h2
                  className={`text-2xl sm:text-3xl font-bold break-words ${conditionTone.text}`}
                >
                  {conditionStatus.label}
                </h2>
              </div>
            </div>

            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center ${conditionTone.icon}`}
            >
              {renderTrendIcon(conditionStatus.trend, 26)}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Tingkat Akurasi</span>

              <span className="font-semibold text-slate-700">
                {(latestSession?.confidence * 100).toFixed(0)}%
              </span>
            </div>

            <div className="w-full bg-white/70 rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${conditionTone.dot}`}
                style={{
                  width: `${(latestSession?.confidence * 100).toFixed(0)}%`,
                }}
              />
            </div>

            <p className="text-sm text-slate-500 pt-1">
              {conditionStatus.description}
            </p>
          </div>
        </div>
      </div>

      {/* REMINDER + ACTIVITY */}
      <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-6">
        <div className={`premium-card rounded-3xl border p-5 sm:p-6 shadow-sm ${reminderTone.card}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-500">Reminder Monitoring</p>
              <h2 className={`mt-2 text-2xl font-bold ${reminderTone.text}`}>
                {monitoringReminder.title}
              </h2>
            </div>

            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${reminderTone.icon}`}>
              <CalendarDays size={24} />
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            {monitoringReminder.message}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold capitalize ${reminderTone.badge}`}>
              <Bell size={15} />
              {monitoringReminder.urgency}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Berdasarkan trend, confidence, dan status kondisi terbaru
            </span>
          </div>
        </div>

        <div className="premium-card rounded-3xl border border-slate-100 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-400">Patient Activity</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-800">Activity Feed</h2>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Activity size={24} />
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {activityFeed.map((item, index) => {
              const feedTone = conditionToneClass[item.tone] || conditionToneClass.blue;

              return (
                <div
                  key={`${item.title}-${index}`}
                  className="monitoring-feed-item relative flex gap-3 pl-1"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <div className={`z-10 h-9 w-9 shrink-0 rounded-2xl flex items-center justify-center ${feedTone.icon}`}>
                    {renderActivityIcon(item.type)}
                  </div>
                  <div className="min-w-0 rounded-2xl bg-slate-50 border border-slate-100 p-3 flex-1">
                    <p className="font-bold text-slate-800">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">
                      {item.description}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-slate-400">
                      {formatDate(item.date)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* HEALTH SCORE */}
      <div className="premium-card bg-white rounded-3xl border border-slate-100 p-5 sm:p-7 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 items-center">
          <div className="flex items-center justify-center">
            <div
              className="health-score-ring relative h-40 w-40 rounded-full flex items-center justify-center"
              style={{
                background: `conic-gradient(${healthTone.ring} ${healthScore.score * 3.6}deg, #e2e8f0 0deg)`,
              }}
            >
              <div className="absolute inset-4 rounded-full bg-white shadow-inner" />
              <div className="relative text-center">
                <p className={`text-4xl font-bold ${healthTone.text}`}>{healthScore.score}</p>
                <p className="text-xs font-semibold text-slate-400">Health Score</p>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${healthTone.icon}`}>
                <HeartPulse size={24} />
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-400">Patient Health Score</p>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">
                  {healthScore.label}
                </h2>
              </div>

              <span className={`ml-0 lg:ml-auto inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${conditionTone.badge}`}>
                {renderTrendIcon(conditionStatus.trend, 16)}
                {conditionStatus.label}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-4 gap-3">
              {[
                ["Trend", conditionStatus.label],
                ["Confidence", `${Math.round((latestSession?.confidence || 0) * 100)}%`],
                ["Stability", hasEnoughSessions ? "Terbaca" : "Menunggu"],
                ["Consistency", `${sessions.length} Session`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs font-semibold text-slate-400">{label}</p>
                  <p className="mt-1 font-bold text-slate-700">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

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
        {/* IDENTITAS */}
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-5">
            Informasi Pasien
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-slate-400">Nama Pasien</p>

              <p className="font-semibold text-slate-700 mt-1">
                {patient?.nama_pasien || "Tanpa Nama"}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-400">Kode Pasien</p>

              <p className="font-semibold text-slate-700 mt-1">
                {patient?.kode_pasien || "-"}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-400">Jenis Kulit Dominan</p>

              <p className="font-semibold capitalize text-slate-700 mt-1">
                {selectedSession?.dominant_skin_type}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-400">Tingkat Akurasi</p>

              <p className="font-semibold text-slate-700 mt-1">
                {Math.round(selectedSession?.confidence * 100)}%
              </p>
            </div>
          </div>
        </div>

        {/* TIMELINE */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div className="min-w-0">
              <h3 className="text-2xl font-bold text-slate-800">
                Timeline Pemeriksaan
              </h3>

              <p className="text-slate-400 mt-1">
                Riwayat monitoring kondisi kulit pasien
              </p>
            </div>

            <div className="w-fit px-4 py-2 rounded-2xl bg-blue-50 text-blue-600 text-sm font-semibold">
              {sessions.length} Session
            </div>
          </div>

          <div className="flex items-center gap-4 overflow-x-auto pb-3">
            {sessions.map((session, index) => {
              const isSelected = selectedSession?.id === session.id;
              const isLatest = latestSession?.id === session.id;
              const sessionStatus = getSessionQualityStatus(session);
              const sessionTone = conditionToneClass[sessionStatus.tone] || conditionToneClass.blue;

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
                      min-w-[190px]
                      rounded-3xl
                      p-5
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
                        Latest
                      </div>
                    )}

                    {/* SESSION NUMBER */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`
                            h-9 w-9 rounded-2xl flex items-center justify-center
                            ${isSelected ? "bg-white/20 text-white" : sessionTone.icon}
                          `}
                        >
                          {renderSessionIcon(sessionStatus)}
                        </div>

                        <div
                          className={`
                            text-sm font-bold
                            ${isSelected ? "text-white" : "text-slate-700"}
                          `}
                        >
                          Session {session.session_number}
                        </div>
                      </div>

                      <div
                        className={`w-3 h-3 rounded-full ${sessionTone.dot}`}
                      />
                    </div>

                    <div
                      className={`
                        mb-3
                        inline-flex
                        px-3
                        py-1
                        rounded-full
                        text-xs
                        font-bold
                        ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : sessionTone.badge
                        }
                      `}
                    >
                      {sessionStatus.label}
                    </div>

                    {/* DATE */}
                    <div
                      className={`
                        text-xs mb-3
                        ${isSelected ? "text-blue-100" : "text-slate-400"}
                      `}
                    >
                      {formatDate(session.created_at)}
                    </div>

                    {/* RESULT */}
                    <div
                      className={`
                        text-lg font-bold capitalize mb-4
                        ${isSelected ? "text-white" : "text-slate-800"}
                      `}
                    >
                      {session.dominant_skin_type}
                    </div>

                    {/* CONFIDENCE */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span
                          className={`
                            ${isSelected ? "text-blue-100" : "text-slate-400"}
                          `}
                        >
                          Tingkat Akurasi
                        </span>

                        <span
                          className={`
                            font-semibold
                            ${isSelected ? "text-white" : "text-slate-700"}
                          `}
                        >
                          {(session.confidence * 100).toFixed(0)}%
                        </span>
                      </div>

                      <div className="w-full h-2 rounded-full bg-white/20 overflow-hidden">
                        <div
                          className={`
                            h-2 rounded-full
                            ${isSelected ? "bg-white" : sessionTone.dot}
                          `}
                          style={{
                            width: `${(session.confidence * 100).toFixed(0)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* STATUS */}
                    <div className="mt-4">
                      <span
                        className={`
                          px-3 py-1 rounded-full text-xs font-semibold

                          ${isSelected ? "bg-white/20 text-white" : sessionTone.badge}
                        `}
                      >
                        {sessionStatus.description}
                      </span>
                    </div>
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

        {/* WARNING ALERT */}

        {selectedSession?.low_confidence && (
          <div
            className="
                bg-yellow-50
                border
                border-yellow-200
                rounded-3xl
                p-6
            "
          >
            <div className="flex gap-4">
              <div
                className="
                        w-12
                        h-12
                        rounded-2xl
                        bg-yellow-100
                        flex
                        items-center
                        justify-center
                        text-2xl
                    "
              >
                ⚠
              </div>

              <div>
                <h2
                  className="
                            text-lg
                            font-bold
                            text-yellow-800
                        "
                >
                  Kualitas Pemeriksaan Kurang Optimal
                </h2>

                <p
                  className="
                            text-sm
                            text-yellow-700
                            mt-1
                        "
                >
                  Hasil pemeriksaan memiliki tingkat akurasi rendah. Disarankan
                  melakukan scan ulang dengan pencahayaan yang lebih baik.
                </p>

                <div
                  className="
                        mt-4
                        grid
                        grid-cols-1
                        sm:grid-cols-2
                            gap-3
                        "
                >
                  <div className="bg-white rounded-xl p-3 text-sm">
                    💡 Pencahayaan cukup
                  </div>

                  <div className="bg-white rounded-xl p-3 text-sm">
                    📷 Kamera stabil
                  </div>

                  <div className="bg-white rounded-xl p-3 text-sm">
                    🙂 Wajah terlihat jelas
                  </div>

                  <div className="bg-white rounded-xl p-3 text-sm">
                    🔍 Hindari blur
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TREND */}
        {sessionTrend.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  Grafik Monitoring Kulit
                </h2>

                <p className="text-sm text-slate-400 mt-1">
                  Perkembangan kualitas pemeriksaan pada setiap session
                </p>
              </div>

              <div className="px-4 py-2 rounded-2xl bg-blue-50 text-blue-600 text-sm font-bold">
                {sessionTrend.length} Titik Data
              </div>
            </div>

            <div className="overflow-x-auto">
              <MonitoringChart
                chartWidth={chartWidth}
                chartHeight={chartHeight}
                chartPadding={chartPadding}
                chartPath={chartPath}
                chartPoints={chartPoints}
              />
            </div>
          </div>
        )}

        {/* VISUAL TRACKING */}
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Visual Tracking Monitoring
          </h2>

          {hasEnoughSessions && (
            <div className="flex items-center gap-3 mt-2 mb-5">
              <div className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
                Session Awal
              </div>

              <div className="flex items-center text-slate-400">
                {"\u2192"}
              </div>

              <div className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold">
                Session Terbaru
              </div>
            </div>
          )}

          {hasEnoughSessions ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_auto_1fr] gap-6 items-start">
              {/* SESSION AWAL */}
              <div className="premium-card bg-slate-50 rounded-3xl p-5 border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800">Session Awal</h3>

                    <p className="text-sm text-slate-400">
                      Pemeriksaan pertama
                    </p>
                  </div>

                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-600">
                    Session 1
                  </span>
                </div>

                <div className="relative group overflow-hidden rounded-[28px] bg-slate-100 border border-slate-200">
                  <OptimizedImage
                    src={
                      firstSession?.image_path
                        ? `${API_URL}/uploads/${firstSession.image_path}`
                        : "/placeholder.jpg"
                    }
                    alt="Monitoring kulit"
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
                </div>

                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-slate-500">Tingkat Akurasi</span>

                  <span className="text-sm font-semibold text-slate-700">
                    {Math.round((firstSession?.confidence || 0) * 100)}%
                  </span>
                </div>

                <div className="w-full h-2 rounded-full bg-slate-200 mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                    style={{
                      width: `${Math.round(
                        (firstSession?.confidence || 0) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* PROGRESSION ARROW */}
              <div className="hidden xl:flex items-center justify-center pt-48">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-2xl shadow-lg">
                  {"\u2192"}
                </div>
              </div>

              {/* SESSION TERBARU */}
              <div className="premium-card bg-slate-50 rounded-3xl p-5 border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800">
                      Session Terbaru
                    </h3>

                    <p className="text-sm text-slate-400">
                      Pemeriksaan terakhir
                    </p>
                  </div>

                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-600">
                    Session {selectedSession?.session_number}
                  </span>
                </div>

                <div className="relative group overflow-hidden rounded-[28px] bg-slate-100 border border-slate-200">
                  <OptimizedImage
                    src={`${API_URL}/uploads/${selectedSession?.image_path}`}
                    alt="Monitoring kulit"
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
                </div>

                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-slate-500">Tingkat Akurasi</span>

                  <span className="text-sm font-semibold text-slate-700">
                    {Math.round((selectedSession?.confidence || 0) * 100)}%
                  </span>
                </div>

                <div className="w-full h-2 rounded-full bg-slate-200 mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                    style={{
                      width: `${Math.round(
                        (selectedSession?.confidence || 0) * 100
                      )}%`,
                    }}
                  />
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
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-600">
                  Session {selectedSession?.session_number}
                </span>
              </div>

              <div className="relative group overflow-hidden rounded-[28px] bg-slate-100 border border-slate-200">
                <OptimizedImage
                  src={`${API_URL}/uploads/${selectedSession?.image_path}`}
                  alt="Monitoring kulit"
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
                  Monitoring perubahan dari session awal hingga terbaru
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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

              {/* CONFIDENCE */}
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
                  Tingkat Akurasi
                </div>

                <div
                  className={`
                      text-3xl
                      font-bold
                      ${
                        confidenceDiff > 0
                          ? "text-blue-600"
                          : "text-orange-500"
                      }
                  `}
                >
                  {confidenceDiff > 0 ? "+" : ""}
                  {confidenceDiff}%
                </div>

                <div className="mt-2 text-sm text-slate-500">
                  {confidenceDiff > 0
                    ? "Kualitas scan meningkat"
                    : "Kualitas scan menurun"}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="premium-card bg-white rounded-3xl border border-slate-100 p-5 sm:p-8">
            <h3 className="text-2xl font-bold text-slate-800">
              Monitoring Perkembangan
            </h3>

            <p className="text-slate-400 mt-2">
              Monitoring perubahan kondisi kulit akan tersedia setelah minimal 2
              session pemeriksaan.
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
                  Insight Monitoring
                </h2>

                <p className="text-slate-500 text-sm">
                  Analisa perkembangan kondisi kulit berdasarkan session
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

        {/* HASIL PEMERIKSAAN */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">
                Hasil Pemeriksaan Kulit
              </h2>

              <p className="text-sm text-slate-400 mt-1">
                Komposisi hasil pemeriksaan berdasarkan session yang dipilih
              </p>
            </div>

            <div className="px-4 py-2 rounded-2xl bg-blue-50 text-blue-600 text-sm font-bold capitalize">
              {selectedSession?.dominant_skin_type || "-"}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {skinMetrics.map((metric) => {
              const percentage = Math.round(metric.value * 100);

              return (
                <div
                  key={metric.label}
                  className="premium-card rounded-3xl border border-slate-100 bg-slate-50 p-5"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <p className="text-sm text-slate-400 font-semibold">
                        Parameter
                      </p>

                      <h3 className="text-xl font-bold text-slate-800 mt-1">
                        {metric.label}
                      </h3>
                    </div>

                    <div
                      className={`w-12 h-12 rounded-2xl ${metric.bg} ${metric.text} flex items-center justify-center font-bold`}
                    >
                      {percentage}%
                    </div>
                  </div>

                  <div className="w-full h-3 rounded-full bg-white overflow-hidden border border-slate-100">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${metric.color}`}
                      style={{
                        width: `${percentage}%`,
                      }}
                    />
                  </div>

                  <p className="text-xs text-slate-400 mt-3">
                    Dibaca dari sistem klasifikasi kulit wajah.
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* REKOMENDASI */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800">
              Rekomendasi Perawatan
            </h2>

            <p className="text-sm text-slate-400 mt-1">
              Rekomendasi personal berdasarkan jenis kulit, trend monitoring, dan kualitas session
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


