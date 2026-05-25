import { useNavigate } from "react-router-dom";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { deleteHistory, getHistory } from "../services/HistoryService";
import Swal from "sweetalert2";
import { toast } from "sonner";
import { markRekamMedisFlow } from "../services/flowAudit";
import { AnimatedCard, AnimatedPage, ButtonSpinner, EmptyState, SkeletonCard } from "../components/ui";
import { getConditionStatus } from "../utils/monitoring";

export default function RekamMedis() {

  const navigate = useNavigate();

  const [historyData, setHistoryData] = useState([]);
  const [search, setSearch] = useState("");
  const [packageFilter, setPackageFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDelete = useCallback(async (id) => {

    const result = await Swal.fire({
      title: "Hapus Data?",
      text: "Data rekam medis akan dihapus permanen",
      icon: "warning",

      showCancelButton: true,

      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",

      confirmButtonText: "Ya, Hapus",
      cancelButtonText: "Batal",

      reverseButtons: true,

      background: "#ffffff",

      customClass: {
        popup: "rounded-3xl",
        confirmButton: "rounded-xl px-5 py-2",
        cancelButton: "rounded-xl px-5 py-2",
      },
    });

    if (!result.isConfirmed) return;

    try {
      setDeletingId(id);

      await deleteHistory(id);

      await loadHistory();

      toast.success("Data rekam medis berhasil dihapus");

    } catch (error) {

      console.error(error);

      toast.error("Gagal menghapus data rekam medis");

    } finally {
      setDeletingId(null);
    }
  }, []);

  const loadHistory = async () => {

    try {
      setLoading(true);
      setErrorMessage("");

      const data = await getHistory();

      console.log("HISTORY:", data);
      console.log("MEDICAL RECORD DATA", data);
      markRekamMedisFlow(data);

      // =========================
      // FILTER TRACKING
      // =========================

      const trackingPatients = {};
      const finalData = [];
      const sessionsByPatient = data.reduce((grouped, item) => {
        const key = item.patient_id || item.id;

        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
        return grouped;
      }, {});

      data.forEach((item) => {

        // BASIC
        if (item.paket_type !== "tracking") {

          finalData.push(item);

        }

        // TRACKING
        else {

          // simpan session terbaru saja
          if (
            !trackingPatients[item.patient_id] ||
            item.session_number >
              trackingPatients[item.patient_id].session_number
          ) {

            trackingPatients[item.patient_id] = item;

          }

        }

      });

      // GABUNGKAN
      const trackingOnly = Object.values(trackingPatients);

      const combined = [
        ...trackingOnly,
        ...finalData
      ].map((item) => ({
        ...item,
        session_history: sessionsByPatient[item.patient_id || item.id] || [item],
      }));

      // SORT TERBARU
      combined.sort(
        (a, b) =>
          new Date(b.created_at) -
          new Date(a.created_at)
      );

      setHistoryData(combined);

    } catch (error) {

      console.error(
        "ERROR LOAD HISTORY:",
        error
      );

      setErrorMessage(error.message || "Gagal memuat rekam medis dari database.");
      setHistoryData([]);

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

  const filteredHistoryData = useMemo(() => historyData.filter((item) => {
    const keyword = search.toLowerCase();

    const matchesSearch = `
      ${item.kode_pasien || ""}
      ${item.nama_pasien || ""}
      ${item.paket_type || ""}
      ${item.hasil_prediksi || item.dominant_skin_type || ""}
    `
      .toLowerCase()
      .includes(keyword);

    const matchesPackage =
      packageFilter === "all" || item.paket_type === packageFilter;

    const recordDate = item.exam_date || item.created_at
      ? new Date(item.exam_date || item.created_at)
      : null;

    const matchesDate =
      !dateFilter ||
      (recordDate &&
        !Number.isNaN(recordDate.getTime()) &&
        recordDate.toISOString().slice(0, 10) === dateFilter);

    return matchesSearch && matchesPackage && matchesDate;
  }), [dateFilter, historyData, packageFilter, search]);

  const conditionToneClass = useMemo(() => ({
    green: "bg-emerald-100 text-emerald-700",
    yellow: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
  }), []);

  const renderTrendIcon = useCallback((trend) => {
    if (trend === "up") return <TrendingUp size={15} />;
    if (trend === "down") return <TrendingDown size={15} />;
    return <Minus size={15} />;
  }, []);

  return (
    <AnimatedPage>
    <div className="page-enter space-y-6 min-w-0">

      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">
          Rekam Medis
        </h1>

        <p className="text-slate-400 mt-1">
          Riwayat hasil pemeriksaan kulit wajah
        </p>
      </div>

      {/* FILTER */}
      <div className="premium-card bg-white rounded-3xl shadow-sm border border-slate-100 p-4 sm:p-5 min-w-0">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="text-sm font-semibold text-slate-500">
              Cari Pasien
            </label>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, kode, paket, atau jenis kulit..."
              className="
                w-full
                mt-2
                px-4
                py-3
                rounded-2xl
                bg-slate-50
                border
                border-slate-100
                outline-none
                focus:ring-2
                focus:ring-blue-500
              "
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-500">
              Paket
            </label>

            <select
              value={packageFilter}
              onChange={(e) => setPackageFilter(e.target.value)}
              className="
                w-full
                mt-2
                px-4
                py-3
                rounded-2xl
                bg-slate-50
                border
                border-slate-100
                outline-none
                focus:ring-2
                focus:ring-blue-500
              "
            >
              <option value="all">Semua Paket</option>
              <option value="basic">Basic</option>
              <option value="tracking">Tracking</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-500">
              Tanggal
            </label>

            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="
                w-full
                mt-2
                px-4
                py-3
                rounded-2xl
                bg-slate-50
                border
                border-slate-100
                outline-none
                focus:ring-2
                focus:ring-blue-500
              "
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t border-slate-100">
          <p className="text-sm text-slate-500">
            Menampilkan{" "}
            <span className="font-bold text-slate-700">
              {filteredHistoryData.length}
            </span>{" "}
            dari {historyData.length} data rekam medis
          </p>

          {(search || packageFilter !== "all" || dateFilter) && (
            <button
              onClick={() => {
                setSearch("");
                setPackageFilter("all");
                setDateFilter("");
              }}
              className="btn-premium text-sm font-semibold text-blue-600"
            >
              Reset filter
            </button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="premium-card bg-white rounded-3xl shadow overflow-hidden min-w-0">
        <div className="overflow-x-auto">

        {loading ? (
          <div className="p-6">
            <SkeletonCard />
          </div>
        ) : errorMessage ? (
          <div className="py-16 text-center bg-red-50">
            <p className="font-semibold text-red-600">
              {errorMessage}
            </p>

            <button
              onClick={loadHistory}
              className="btn-premium mt-4 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold"
            >
              Muat Ulang
            </button>
          </div>
        ) : (
          <>
            {/* TABLE HEADER */}
            <div className="
              hidden
              md:grid
              grid
              grid-cols-8
              gap-4
              min-w-[1120px]
              px-6
              py-4
              bg-slate-50
              border-b
              text-sm
              font-semibold
              text-slate-500
            ">

              <p>Kode</p>
              <p>Nama Pasien</p>
              <p>Paket</p>
              <p>Jenis Kulit</p>
              <p>Tingkat Akurasi</p>
              <p>Status</p>
              <p>Tanggal</p>
              <p>Aksi</p>

            </div>

            {/* TABLE BODY */}
            {filteredHistoryData.length > 0 ? (

              filteredHistoryData.map((item) => {
                const skinType =
                  item.hasil_prediksi ||
                  item.dominant_skin_type ||
                  "-";

                const displaySkin =
                  skinType.charAt(0).toUpperCase() +
                  skinType.slice(1).toLowerCase();

                const confidence =
                  item.confidence > 1
                    ? item.confidence
                    : (item.confidence * 100).toFixed(2);
                const conditionStatus = getConditionStatus(item.session_history || [item]);
                const conditionTone =
                  conditionToneClass[conditionStatus.tone] || conditionToneClass.blue;

                return (
                <Fragment key={item.id}>
                  <div className="md:hidden p-4 border-b">
                    <AnimatedCard className="rounded-3xl bg-slate-50 border border-slate-100 p-4 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase text-slate-400">
                            Kode Pasien
                          </p>
                          <p className="font-bold text-slate-800 break-words">
                            {item.kode_pasien || "-"}
                          </p>
                        </div>

                        <span
                          className={`
                            inline-flex
                            items-center
                            px-3
                            py-1
                            rounded-full
                            text-xs
                            font-bold
                            capitalize
                            shrink-0
                            ${
                              item.paket_type === "tracking"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-emerald-100 text-emerald-700"
                            }
                          `}
                        >
                          {item.paket_type || "basic"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-slate-400 font-semibold">Nama</p>
                          <p className="font-bold text-slate-700 break-words">
                            {item.nama_pasien || "Tanpa Nama"}
                          </p>
                        </div>

                        <div>
                          <p className="text-slate-400 font-semibold">Jenis Kulit</p>
                          <p className="font-bold text-blue-600 capitalize">
                            {displaySkin}
                          </p>
                        </div>

                        <div>
                          <p className="text-slate-400 font-semibold">Tingkat Akurasi</p>
                          <p className="font-bold text-slate-700">{confidence}%</p>
                        </div>

                        <div>
                          <p className="text-slate-400 font-semibold">Status</p>
                          <span
                            className={`mt-1 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${conditionTone}`}
                          >
                            {renderTrendIcon(conditionStatus.trend)}
                            {conditionStatus.label}
                          </span>
                        </div>

                        <div>
                          <p className="text-slate-400 font-semibold">Tanggal</p>
                          <p className="font-bold text-slate-700">
                            {formatDate(item.exam_date || item.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => navigate(`/detail/${item.patient_id || item.id}`)}
                          className="btn-premium h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
                        >
                          Detail
                        </button>

                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="btn-premium h-11 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold"
                        >
                          {deletingId === item.id ? "Menghapus..." : "Hapus"}
                        </button>
                      </div>
                    </AnimatedCard>
                  </div>

                <div
                  className="
                    hidden
                    md:grid
                    grid-cols-8
                    gap-4
                    min-w-[1120px]
                    items-center
                    px-6
                    py-4
                    border-b
                    hover:bg-slate-50
                    transition
                  "
                >

              {/* KODE */}
              <div>
                <p className="font-bold text-slate-800">
                  {item.kode_pasien || "-"}
                </p>
              </div>

              {/* NAMA */}
              <div>
                <p className="font-semibold text-slate-700">
                  {item.nama_pasien || "Tanpa Nama"}
                </p>
              </div>

              {/* PAKET */}
              <div>

                <span
                  className={`
                    inline-flex
                    items-center
                    px-3
                    py-1
                    rounded-full
                    text-xs
                    font-bold
                    capitalize

                    ${
                      item.paket_type === "tracking"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-emerald-100 text-emerald-700"
                    }
                  `}
                >
                  {item.paket_type || "basic"}
                </span>

              </div>

              {/* JENIS KULIT */}
              <div>
                <span className="
                  px-3
                  py-1
                  rounded-full
                  text-xs
                  font-semibold
                  bg-blue-100
                  text-blue-600
                  capitalize
                ">
                  {displaySkin}
                </span>
              </div>

              {/* CONFIDENCE */}
              <div className="font-semibold text-slate-700">
                {confidence}%
              </div>

              {/* STATUS */}
              <div>
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${conditionTone}`}
                >
                  {renderTrendIcon(conditionStatus.trend)}
                  {conditionStatus.label}
                </span>
              </div>

              {/* TANGGAL */}
              <div className="text-sm text-slate-500">
                {formatDate(item.exam_date || item.created_at)}
              </div>

              {/* BUTTON */}
              <div className="flex gap-2">

                {/* DETAIL */}
                <button
                  onClick={() => navigate(`/detail/${item.patient_id || item.id}`)}
                  className="
                    px-4
                    py-2
                    rounded-xl
                    bg-blue-600
                    hover:bg-blue-700
                    text-white
                    text-sm
                    font-semibold
                    transition
                    btn-premium
                  "
                >
                  Detail
                </button>

                {/* DELETE */}
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  className="
                    px-4
                    py-2
                    rounded-xl
                    bg-red-500
                    hover:bg-red-600
                    text-white
                    text-sm
                    font-semibold
                    transition
                    btn-premium
                  "
                >
                  {deletingId === item.id ? (
                    <span className="inline-flex items-center gap-2">
                      <ButtonSpinner />
                      Menghapus
                    </span>
                  ) : (
                    "Hapus"
                  )}
                </button>

              </div>

                </div>
                </Fragment>

                );
              })

            ) : (

              <div className="p-4 sm:p-6">
                <EmptyState
                  title={
                    historyData.length === 0
                      ? "Belum ada data rekam medis"
                      : "Data tidak ditemukan"
                  }
                  subtitle={
                    historyData.length === 0
                      ? "Data akan muncul setelah hasil pemeriksaan disimpan ke database."
                      : "Coba ubah kata kunci, paket, atau tanggal pemeriksaan."
                  }
                />
              </div>

            )}
          </>
        )}

        </div>

      </div>

    </div>
    </AnimatedPage>
  );
}


