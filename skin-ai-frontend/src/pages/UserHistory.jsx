import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, CalendarDays, Download, Eye, FileText } from "lucide-react";
import { toast } from "sonner";
import UserPortalShell from "../components/UserPortalShell";
import { ButtonSpinner } from "../components/ui";
import { getUserHistory } from "../services/HistoryService";
import { API_URL } from "../config";
import { generateMonitoringInsight } from "../utils/monitoring";
import { buildFaceCondition, formatConditionLabel } from "../utils/conditionAnalysis";

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
  const selectedCondition = buildFaceCondition(selectedSession);
  const insights = useMemo(
    () => generateMonitoringInsight(orderedHistory).slice(0, 4),
    [orderedHistory]
  );

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
          Daftar sesi pemeriksaan kulit Anda dalam tampilan yang ringkas.
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
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-400">Total Sesi</p>
                  <h2 className="mt-2 text-4xl font-black text-slate-800">{orderedHistory.length}</h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <FileText size={24} />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-400">Scan Terakhir</p>
                  <h2 className="mt-2 text-xl font-black text-slate-800">
                    {formatDate(latest?.exam_date || latest?.created_at)}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">{formatTime(latest?.created_at)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                  <CalendarDays size={24} />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-400">Wawasan Pemantauan</p>
                <h2 className="mt-1 text-2xl font-black text-slate-800">Catatan Perkembangan</h2>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Activity size={24} />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {insights.map((item, index) => (
                <div key={`${item}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-sm leading-relaxed text-slate-600">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5">
              <h2 className="text-2xl font-black text-slate-800">Sesi Pemeriksaan</h2>
              <p className="mt-1 text-sm text-slate-400">
                Pilih sesi untuk melihat ringkasan dan aksi pemeriksaan.
              </p>
            </div>

            <div className="-mx-1 overflow-x-auto px-1 pb-2">
              <div className="flex min-w-max gap-3">
                {orderedHistory.map((session, index) => {
                  const isSelected = Number(selectedSession?.id) === Number(session.id);
                  const isLatest = Number(latest?.id) === Number(session.id);
                  const sessionCondition = buildFaceCondition(session);
                  const conditionLabel = formatConditionLabel(sessionCondition?.dominant_condition);

                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => setSelectedId(session.id)}
                      className={`relative w-[210px] shrink-0 overflow-hidden rounded-3xl border p-4 text-left transition-all duration-300 ${
                        isSelected
                          ? "border-blue-500 bg-gradient-to-br from-blue-600 to-indigo-600 shadow-xl shadow-blue-100"
                          : "border-slate-200 bg-white hover:border-blue-200 hover:shadow-lg"
                      }`}
                    >
                      {isLatest && (
                        <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold uppercase text-blue-600 shadow-sm">
                          Terbaru
                        </div>
                      )}

                      <p className={`text-sm font-black ${isSelected ? "text-white" : "text-slate-700"}`}>
                        Sesi {session.session_number || index + 1}
                      </p>
                      <p className={`mt-2 text-xs ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                        {formatDate(session.exam_date || session.created_at)}
                      </p>
                      <p className={`mt-3 text-lg font-black capitalize ${isSelected ? "text-white" : "text-slate-800"}`}>
                        {session.dominant_skin_type || "-"}
                      </p>
                      <p className={`mt-1 text-sm font-bold ${isSelected ? "text-blue-100" : "text-violet-600"}`}>
                        {conditionLabel !== "-" ? conditionLabel : "Kondisi belum tersedia"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {selectedSession && (
            <section className="grid grid-cols-1 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
                <img
                  src={
                    selectedSession.image_path
                      ? `${API_URL}/uploads/${selectedSession.image_path}`
                      : "/placeholder.jpg"
                  }
                  alt={selectedSession.nama_pasien || "Foto pemeriksaan"}
                  className="h-[220px] w-full object-cover sm:h-[360px]"
                />
              </div>

              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-400">Sesi Terpilih</p>
                    <h2 className="mt-1 text-2xl font-black text-slate-800">
                      Sesi {selectedSession.session_number || "-"}
                    </h2>
                    <p className="mt-1 text-sm font-bold text-blue-600">
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

                  <div className="rounded-2xl bg-violet-50 p-4">
                    <p className="text-sm font-bold text-violet-500">Kondisi Wajah</p>
                    <p className="mt-2 text-xl font-black capitalize text-violet-800">
                      {formatConditionLabel(selectedCondition?.dominant_condition)}
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
                    Unduh PDF
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
