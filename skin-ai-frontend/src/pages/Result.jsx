import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Activity, ArrowLeft, CheckCircle2, FileDown, PlusCircle, Sparkles, UserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getHistoryById } from "../services/HistoryService";
import { API_URL } from "../config";
import { markResultFlow } from "../services/flowAudit";
import { AnimatedCard, AnimatedPage, ButtonSpinner, EmptyState, OptimizedImage, SkeletonCard } from "../components/ui";
import { generateSmartRecommendations, getConditionStatus } from "../utils/monitoring";

function CountUp({ value, suffix = "" }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const target = Number(value) || 0;
    const duration = 650;
    const startedAt = performance.now();
    let frameId;

    const tick = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      setDisplayValue(Math.round(target * progress));

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return (
    <>
      {displayValue}
      {suffix}
    </>
  );
}

export default function Result() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { admin, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const isPatientUser = admin?.role === "user";

  useEffect(() => {
    loadResult();
  }, [id]);

  const loadResult = async () => {
    try {
      setLoading(true);

      const result = await getHistoryById(id);

      if (!result) {
        toast.warning("Data hasil tidak tersedia");
        return;
      }

      setData(result);
      markResultFlow(result);
      toast.success("Analisis kulit berhasil diselesaikan");
    } catch (error) {
      console.error("ERROR LOAD RESULT:", error);
      toast.warning("Data hasil tidak tersedia");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const handleExport = useCallback(async () => {
    if (exporting || !data) return;

    try {
      setExporting(true);
      toast.info("Menyiapkan laporan PDF klinik...");
      const { exportSkinAiPdf } = await import("../services/pdfService");
      await exportSkinAiPdf(data);
      toast.success("Laporan PDF berhasil dibuat");
    } catch (error) {
      console.error("EXPORT PDF ERROR:", error);
      toast.error("PDF gagal dibuat. Coba beberapa saat lagi.");
    } finally {
      setExporting(false);
    }
  }, [data, exporting]);

  const smartRecommendations = useMemo(
    () => (data ? generateSmartRecommendations([data], data) : []),
    [data]
  );
  const conditionStatus = useMemo(
    () => (data ? getConditionStatus([data]) : null),
    [data]
  );

  const recommendationToneClass = useMemo(
    () => ({
      green: {
        badge: "bg-emerald-100 text-emerald-700",
        icon: "bg-emerald-100 text-emerald-600",
        text: "text-emerald-600",
        dot: "bg-emerald-500",
      },
      yellow: {
        badge: "bg-amber-100 text-amber-700",
        icon: "bg-amber-100 text-amber-600",
        text: "text-amber-600",
        dot: "bg-amber-500",
      },
      red: {
        badge: "bg-red-100 text-red-700",
        icon: "bg-red-100 text-red-600",
        text: "text-red-600",
        dot: "bg-red-500",
      },
      blue: {
        badge: "bg-blue-100 text-blue-700",
        icon: "bg-blue-100 text-blue-600",
        text: "text-blue-600",
        dot: "bg-blue-500",
      },
    }),
    []
  );

  const renderRecommendationIcon = useCallback((priority) => {
    if (priority === "utama") return <Sparkles size={20} />;
    if (priority === "tambahan") return <PlusCircle size={20} />;
    return <Activity size={20} />;
  }, []);

  if (loading) {
    return (
      <AnimatedPage>
        <SkeletonCard />
      </AnimatedPage>
    );
  }

  if (!data) {
    return (
      <AnimatedPage>
      <div className="page-enter bg-white rounded-3xl p-8 border border-slate-100 text-center">
        <EmptyState
          title="Data hasil tidak tersedia"
          subtitle="Hasil pemeriksaan belum dapat ditampilkan. Silakan kembali ke rekam medis atau lakukan analisis baru."
        />
      </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
    <div className={isPatientUser ? "min-h-dvh bg-[linear-gradient(180deg,#eff6ff_0%,#f8fafc_48%,#ecfeff_100%)] px-4 py-6 sm:px-6 sm:py-8" : ""}>
    {isPatientUser && (
      <>
        <div className="mx-auto mb-5 flex w-full max-w-4xl items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/user/history")}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/95 text-slate-700 shadow-lg shadow-slate-200/70 ring-1 ring-white transition hover:bg-blue-50 hover:text-blue-700"
            aria-label="Kembali"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-500">Detail Pemeriksaan</p>
            <h1 className="truncate text-xl font-black text-slate-900">Hasil SkinAI</h1>
          </div>
        </div>

        <div className="mx-auto mb-5 grid w-full max-w-4xl grid-cols-4 gap-2 rounded-[24px] bg-white/90 p-2 shadow-[0_18px_48px_rgba(15,23,42,0.08)] ring-1 ring-white/80">
          <button type="button" onClick={() => navigate("/user/dashboard")} className="min-h-11 rounded-2xl px-2 text-xs font-black text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 sm:text-sm">Dashboard</button>
          <button type="button" onClick={() => navigate("/user/history")} className="min-h-11 rounded-2xl bg-blue-600 px-2 text-xs font-black text-white shadow-lg shadow-blue-200 sm:text-sm">Riwayat</button>
          <button type="button" onClick={() => navigate("/user/profile")} className="min-h-11 rounded-2xl px-2 text-xs font-black text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 sm:text-sm">Profile</button>
          <button type="button" onClick={logout} className="min-h-11 rounded-2xl bg-red-600 px-2 text-xs font-black text-white shadow-lg shadow-red-200 transition hover:bg-red-700 sm:text-sm">Logout</button>
        </div>
      </>
    )}
    <motion.div
      className={`page-enter space-y-6 min-w-0 ${isPatientUser ? "mx-auto w-full max-w-4xl" : ""}`}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: 0.09,
          },
        },
      }}
    >
      <motion.div
        className={`${isPatientUser ? "rounded-[30px] bg-white/95 shadow-[0_24px_70px_rgba(15,23,42,0.10)] ring-1 ring-slate-100 p-5 sm:p-7" : "bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-6"} flex flex-col xl:flex-row gap-6 min-w-0`}
        variants={{
          hidden: { opacity: 0, y: 18 },
          show: { opacity: 1, y: 0 },
        }}
      >
        <div className={`w-full min-w-0 ${isPatientUser ? "xl:w-[500px]" : "xl:w-[420px]"}`}>
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45 }}
          >
          <OptimizedImage
            src={
              data.image_path
                ? `${API_URL}/uploads/${data.image_path}`
                : "/placeholder.jpg"
            }
            alt="Hasil scan"
            className={`image-fade w-full object-cover rounded-3xl bg-slate-50 border border-slate-100 ${isPatientUser ? "h-[320px] sm:h-[420px]" : "h-[260px] sm:h-[320px]"}`}
            eager
          />
          </motion.div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-slate-400 font-semibold">
                Hasil Pemeriksaan Kulit
              </p>

              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1 break-words">
                {data.nama_pasien || "Tanpa Nama"}
              </h1>

              <p className="text-slate-500 mt-1 break-words">
                {data.kode_pasien || "-"} • {formatDate(data.exam_date || data.created_at)}
              </p>
            </div>

            <span className="w-fit px-4 py-2 rounded-2xl bg-purple-50 text-purple-700 text-sm font-bold capitalize">
              {data.paket_type || "basic"}
            </span>
          </div>

          <div className={`grid grid-cols-1 gap-4 mt-6 ${isPatientUser ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
            <div className="rounded-3xl bg-blue-50 p-5 border border-blue-100 shadow-sm">
              <p className="text-sm text-blue-500 font-semibold">
                Jenis Kulit
              </p>

              <h2 className="text-3xl font-bold text-blue-700 capitalize mt-2">
                {data.dominant_skin_type || "-"}
              </h2>
            </div>

            <div className="rounded-3xl bg-emerald-50 p-5 border border-emerald-100 shadow-sm">
              <p className="text-sm text-emerald-500 font-semibold">
                Tingkat Akurasi
              </p>

              <h2 className="text-3xl font-bold text-emerald-700 mt-2">
                <CountUp value={Math.round((data.confidence || 0) * 100)} suffix="%" />
              </h2>

              <div className="mt-4 h-2.5 rounded-full bg-emerald-100 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round((data.confidence || 0) * 100)}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
              </div>
            </div>

            {isPatientUser && conditionStatus && (
              <div className="rounded-3xl bg-violet-50 p-5 border border-violet-100 shadow-sm">
                <p className="text-sm text-violet-500 font-semibold">
                  Kondisi Kulit
                </p>

                <h2 className="text-2xl font-black text-violet-700 mt-2">
                  {conditionStatus.label}
                </h2>

                <p className="mt-2 text-sm leading-relaxed text-violet-700/80">
                  {conditionStatus.description}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-3 mt-6">
            {!isPatientUser && (
              <button
                onClick={() => navigate(`/detail/${data.patient_id}`)}
                className="btn-premium inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 text-white font-semibold w-full sm:w-auto"
              >
                <UserRound size={18} />
                Lihat Detail
              </button>
            )}

            <button
              onClick={handleExport}
              disabled={exporting}
              className="btn-premium inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-800 text-white font-semibold w-full sm:w-auto"
            >
              {exporting ? <ButtonSpinner /> : <FileDown size={18} />}
              {exporting ? "Membuat PDF..." : "Export PDF"}
            </button>

            {!isPatientUser && (
              <button
                onClick={() => navigate("/analisis")}
                className="btn-premium inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 text-white font-semibold w-full sm:w-auto"
              >
                <PlusCircle size={18} />
                Analisis Baru
              </button>
            )}
          </div>
        </div>
      </motion.div>

      <div>
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-slate-800">Rekomendasi Personal</h2>
          <p className="mt-1 text-sm text-slate-400">
            Disusun dari jenis kulit, confidence pemeriksaan, dan kebutuhan monitoring lanjutan.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {smartRecommendations.map((group) => {
          const tone = recommendationToneClass[group.tone] || recommendationToneClass.blue;

          return (
          <AnimatedCard
            key={group.priority}
            className={`monitoring-polish premium-card relative overflow-hidden bg-white rounded-3xl border border-slate-100 p-4 sm:p-6 ${isPatientUser ? "shadow-[0_18px_48px_rgba(15,23,42,0.08)]" : "shadow-sm"}`}
          >
            <div className={`absolute left-0 right-0 top-0 h-1 ${tone.dot}`} />

            <div className="flex items-start justify-between gap-3">
              <div>
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold capitalize ${tone.badge}`}>
                  {group.priority}
                </span>
                <h3 className="mt-3 text-xl font-bold text-slate-800">
                  {group.title}
                </h3>
              </div>

              <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${tone.icon}`}>
                {renderRecommendationIcon(group.priority)}
              </div>
            </div>

            <div className="space-y-3 mt-4">
              {group.items.map((item, index) => (
                <motion.div
                  key={index}
                  className="rounded-2xl bg-slate-50 border border-slate-100 p-3 flex items-start gap-2"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                >
                  <CheckCircle2 size={16} className={`mt-0.5 shrink-0 ${tone.text}`} />
                  <p className="text-sm leading-relaxed text-slate-600">{item}</p>
                </motion.div>
              ))}
            </div>
          </AnimatedCard>
          );
        })}
        </div>
      </div>
    </motion.div>
    </div>
    </AnimatedPage>
  );
}


