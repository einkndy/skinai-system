import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Download, FileText, History, Pencil, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { getUserDashboard } from "../services/HistoryService";
import { API_URL } from "../config";
import { ButtonSpinner } from "../components/ui";
import UserPortalShell from "../components/UserPortalShell";

const formatDate = (value) => {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function UserDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const navigate = useNavigate();
  const { admin } = useAuth();

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const response = await getUserDashboard();
        setData(response);
      } catch (error) {
        toast.error(error.message || "Dashboard user gagal dimuat");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const latest = data?.latest;

  const handleDownloadPdf = async () => {
    if (!latest || exportingPdf) return;

    try {
      setExportingPdf(true);
      const { exportSkinAiPdf } = await import("../services/pdfService");
      await exportSkinAiPdf(latest);
      toast.success("PDF berhasil dibuat");
    } catch (error) {
      console.error("USER PDF EXPORT ERROR:", error);
      toast.error("PDF gagal dibuat");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <UserPortalShell>
        <section className="rounded-[28px] bg-white/90 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] ring-1 ring-white/80 backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-200">
              <UserRound size={24} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xl font-black text-slate-900">
                {data?.profile?.full_name || data?.profile?.username || admin?.username || "User"}
              </p>
              <p className="truncate text-sm text-slate-500">
                {data?.profile?.email || admin?.email}
              </p>
            </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/user/profile")}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 active:scale-[0.99] sm:w-auto"
            >
              <Pencil size={16} /> Edit Profile
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-[24px] bg-white/95 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-100">
            <div className="flex items-center gap-3 text-slate-500">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                <FileText size={20} />
              </span>
              <span className="text-sm font-semibold">Jumlah Pemeriksaan</span>
            </div>
            <p className="mt-5 text-4xl font-black text-slate-900">
              {loading ? "-" : data?.total || 0}
            </p>
          </div>

          <div className="rounded-[24px] bg-white/95 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-100">
            <div className="flex items-center gap-3 text-slate-500">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CalendarDays size={20} />
              </span>
              <span className="text-sm font-semibold">Pemeriksaan Terakhir</span>
            </div>
            <p className="mt-5 text-2xl font-black text-slate-900">
              {formatDate(latest?.exam_date || latest?.created_at)}
            </p>
          </div>
        </section>

        <section className="rounded-[28px] bg-white/95 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.10)] ring-1 ring-slate-100">
          <h2 className="text-xl font-black text-slate-900">Hasil Terakhir</h2>

          {loading ? (
            <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-slate-500">
              <ButtonSpinner /> Memuat data...
            </div>
          ) : latest ? (
            <div className="mt-4 flex flex-col gap-4">
              <img
                src={`${API_URL}/uploads/${latest.image_path}`}
                alt={latest.nama_pasien || "Hasil pemeriksaan"}
                className="aspect-[4/3] w-full rounded-[24px] object-cover shadow-inner"
              />
              <div>
                <p className="text-sm text-slate-500">Status kulit</p>
                <p className="text-3xl font-black capitalize text-slate-900">
                  {latest.dominant_skin_type || "-"}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Belum ada hasil pemeriksaan.</p>
          )}
        </section>

        <section className="grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={() => navigate("/user/history")}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 active:scale-[0.99]"
          >
            <History size={18} /> Lihat Riwayat
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!latest || exportingPdf}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 font-bold text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50"
          >
            {exportingPdf ? <ButtonSpinner /> : <Download size={18} />} Download PDF
          </button>
        </section>
    </UserPortalShell>
  );
}
