import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AnimatedCard, AnimatedPage, ButtonSpinner, LoadingScreen, SkeletonCard, StatusBadge } from "../components/ui";
import { getHistory } from "../services/HistoryService";
import {
  getActivityLogs,
  getDeviceArchitecture,
  getDevices,
  getModelStatus,
} from "../services/api";
import { ESP_IP } from "../config";

import {
  Users,
  Activity,
  CalendarCheck,
  Clock3,
  Cpu,
  Wifi,
  FolderOpen,
  PlusCircle,
  Download,
  HardDrive,
  ListChecks,
  Radio,
  ServerCog,
} from "lucide-react";

const CountUp = memo(function CountUp({ value }) {
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

  return displayValue;
});

const StatCard = memo(function StatCard({ title, value, icon, color }) {
  return (
    <AnimatedCard className="premium-card bg-white rounded-3xl shadow-sm border border-slate-100 p-5 sm:p-6 transition duration-300 min-w-0">
      <div className="flex justify-between items-center">
        <div className="min-w-0">
          <p className="text-slate-500 text-sm truncate">{title}</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mt-2">
            <CountUp value={value} />
          </h2>
        </div>

        <div className={`p-4 rounded-2xl ${color}`}>
          {icon}
        </div>
      </div>
    </AnimatedCard>
  );
});

export default function Dashboard() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [modelStatus, setModelStatus] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [devices, setDevices] = useState([]);
  const [deviceArchitecture, setDeviceArchitecture] = useState(null);
  const [minimumLoading, setMinimumLoading] = useState(true);
  const [csvExporting, setCsvExporting] = useState(false);
  const csvResetTimerRef = useRef(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMinimumLoading(false), 1000);
    // toast.info("ESP32_CAM_01 mencoba reconnect");

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const deviceRows = await getDevices();
        setDevices(deviceRows);

        if (deviceRows.some((device) => getDeviceUxStatus(device) === "reconnecting")) {
          // toast.warning("ESP32_CAM_01 mencoba reconnect");
        }
      } catch (error) {
        console.error("ERROR REFRESH DEVICES:", error);
      }
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [
        data,
        model,
        logs,
        deviceRows,
        architecture,
      ] = await Promise.all([
        getHistory(),
        getModelStatus().catch((error) => {
          console.error("ERROR LOAD MODEL STATUS:", error);
          return null;
        }),
        getActivityLogs(8).catch((error) => {
          console.error("ERROR LOAD ACTIVITY LOGS:", error);
          return [];
        }),
        getDevices().catch((error) => {
          console.error("ERROR LOAD DEVICES:", error);
          return [];
        }),
        getDeviceArchitecture().catch((error) => {
          console.error("ERROR LOAD DEVICE ARCHITECTURE:", error);
          return null;
        }),
      ]);

      const trackingPatients = {};
      const basicRecords = [];

      data.forEach((item) => {
        if (item.paket_type === "tracking") {
          if (
            !trackingPatients[item.patient_id] ||
            item.session_number > trackingPatients[item.patient_id].session_number
          ) {
            trackingPatients[item.patient_id] = item;
          }

          return;
        }

        basicRecords.push(item);
      });

      const combined = [
        ...Object.values(trackingPatients),
        ...basicRecords,
      ].sort(
        (a, b) =>
          new Date(b.exam_date || b.created_at) -
          new Date(a.exam_date || a.created_at)
      );

      setRecords(combined);
      setModelStatus(model);
      setActivityLogs(logs);
      setDevices(deviceRows);
      setDeviceArchitecture(architecture);
    } catch (error) {
      console.error("ERROR LOAD DASHBOARD:", error);
      setErrorMessage(error.message || "Gagal memuat data dashboard dari database.");
      setRecords([]);
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
      month: "short",
      year: "numeric",
    });
  };

  const dashboardStats = useMemo(() => {
    const uniquePatients = new Set(
      records.map((record) => record.patient_id || record.kode_pasien || record.id)
    );
    const today = new Date().toDateString();

    return {
      totalPatients: uniquePatients.size,
      trackingPatients: records.filter((record) => record.paket_type === "tracking").length,
      analisisSekali: records.filter((record) => record.paket_type !== "tracking").length,
      todayCount: records.filter((record) => {
        const sourceDate = record.exam_date || record.created_at;

        return sourceDate && new Date(sourceDate).toDateString() === today;
      }).length,
      averageAccuracy:
        records.length > 0
          ? Math.round(
              (records.reduce((total, record) => total + Number(record.confidence || 0), 0) /
                records.length) *
                100
            )
          : 0,
      latestPrediction: records[0]?.dominant_skin_type || "-",
    };
  }, [records]);

  const latestDevice = devices[0];
  const modelReady = modelStatus?.ready;
  const connectedDevices = useMemo(
    () => devices.filter((device) => device.status === "online"),
    [devices]
  );

  const filtered = useMemo(() => {
    const keyword = search.toLowerCase();

    return records.filter((record) =>
      `${record.nama_pasien || ""} ${record.kode_pasien || ""} ${record.paket_type || ""} ${record.dominant_skin_type || ""}`
        .toLowerCase()
        .includes(keyword)
    );
  }, [records, search]);

  const latest = useMemo(() => filtered.slice(0, 5), [filtered]);
  const formatRelativeHeartbeat = (device) => {

    if (device?.status === "online") {
      return "Online sekarang";
    }

    return "Menunggu heartbeat";
  };

  const getDeviceUxStatus = (device) => {

    if (!device) return "connecting";

    if (device.status === "online") {
      return "online";
    }

    if (device.status === "offline") {
      return "offline";
    }

    return "connecting";
  };

  const exportDashboardCsv = useCallback(async () => {
    if (csvExporting) return;

    setCsvExporting(true);

    const header = [
      "history_id",
      "patient_id",
      "session_number",
      "kode_pasien",
      "nama_pasien",
      "paket_type",
      "dominant_skin_type",
      "confidence",
      "exam_date",
      "created_at",
    ];

    const rows = records.map((record) =>
      header
        .map((field) => `"${String(record[field] ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );

    const blob = new Blob([[header.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "SkinAI_dashboard_export.csv";
    link.click();
    URL.revokeObjectURL(url);

    console.log("EXPORT DATA OK", {
      rows: records.length,
    });

    toast.success("Data dashboard berhasil diekspor");
    csvResetTimerRef.current = setTimeout(() => setCsvExporting(false), 300);
  }, [csvExporting, records]);

  useEffect(() => () => {
    if (csvResetTimerRef.current) {
      clearTimeout(csvResetTimerRef.current);
    }
  }, []);

  return (
    <AnimatedPage>
      <div className="page-enter space-y-6 min-w-0">

      {/* TOP STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">

        <StatCard
          title="Total Pasien"
          value={dashboardStats.totalPatients}
          icon={<Users className="text-white" />}
          color="bg-blue-500"
        />

        <StatCard
          title="Paket Tracking"
          value={dashboardStats.trackingPatients}
          icon={<Activity className="text-white" />}
          color="bg-emerald-500"
        />

        <StatCard
          title="Analisis Sekali"
          value={dashboardStats.analisisSekali}
          icon={<CalendarCheck className="text-white" />}
          color="bg-violet-500"
        />

        <StatCard
          title="Hari Ini"
          value={dashboardStats.todayCount}
          icon={<Clock3 className="text-white" />}
          color="bg-orange-500"
        />
      </div>

      {/* MIDDLE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">

        {/* PASIEN TERBARU */}
        <div className="premium-card lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 p-4 sm:p-5 min-w-0">

          <h2 className="text-2xl font-bold mb-5 text-slate-800">
            Pasien Terbaru
          </h2>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pasien..."
            className="
              w-full
              mb-4
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

          <div className="space-y-3">
            {loading || minimumLoading ? (
              <div className="space-y-4">
              <LoadingScreen
                compact
                title="Memuat Dashboard"
                subtitle="Mengambil ringkasan pasien dan status perangkat..."
              />
              <SkeletonCard />
              </div>
            ) : errorMessage ? (
              <div className="rounded-3xl border border-red-100 bg-red-50 p-8 text-center">
                <p className="font-semibold text-red-600">
                  {errorMessage}
                </p>

                <button
                  onClick={loadDashboard}
                  disabled={loading}
                  className="btn-premium mt-4 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold"
                >
                  {loading ? "Memuat..." : "Muat Ulang"}
                </button>
              </div>
            ) : latest.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <p className="font-semibold text-slate-600">
                  {records.length === 0
                    ? "Belum ada data rekam medis"
                    : "Belum ada data yang cocok"}
                </p>

                <p className="text-sm text-slate-400 mt-1">
                  {records.length === 0
                    ? "Data akan muncul otomatis setelah pemeriksaan tersimpan ke database."
                    : "Coba ubah kata kunci pencarian pasien."}
                </p>
              </div>
            ) : (
              latest.map((patient, index) => (
                <motion.div
                  key={patient.id}
                  onClick={() => navigate(`/detail/${patient.patient_id || patient.id}`)}
                  className="
                    flex
                    flex-col
                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                    gap-4
                    p-4
                    rounded-2xl
                    border
                    border-slate-100
                    bg-slate-50/70
                    hover:bg-white
                    hover:shadow-md
                    cursor-pointer
                    transition
                  "
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                >
                  <div className="min-w-0 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-slate-800 truncate">
                        {patient.nama_pasien || "Tanpa Nama"}
                      </h4>

                      <span
                        className={`
                          px-2.5
                          py-1
                          rounded-full
                          text-[11px]
                          font-bold
                          capitalize
                          ${
                            patient.paket_type === "tracking"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-emerald-100 text-emerald-700"
                          }
                        `}
                      >
                        {patient.paket_type || "basic"}
                      </span>
                    </div>

                    <p className="text-sm text-slate-400">
                      {patient.kode_pasien || "-"} •{" "}
                      {formatDate(patient.exam_date || patient.created_at)}
                    </p>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-sm font-bold text-blue-600 capitalize">
                      {patient.dominant_skin_type || "-"}
                    </p>

                    <p className="text-xs font-semibold text-slate-500">
                      {Math.round((patient.confidence || 0) * 100)}%
                    </p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* RINGKASAN PEMERIKSAAN */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 sm:p-6">

          <h2 className="text-2xl font-bold mb-5">
            Ringkasan Pemeriksaan
          </h2>

          <div className="space-y-5">

            <div>
              <div className="flex justify-between mb-2">
                <span>Tracking</span>
                <span>{dashboardStats.trackingPatients}</span>
              </div>

              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{
                    width: `${dashboardStats.totalPatients ? (dashboardStats.trackingPatients / dashboardStats.totalPatients) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span>Sekali</span>
                <span>{dashboardStats.analisisSekali}</span>
              </div>

              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-violet-500"
                  style={{
                    width: `${dashboardStats.totalPatients ? (dashboardStats.analisisSekali / dashboardStats.totalPatients) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div className="pt-4 border-t text-slate-500 text-sm">
              Dashboard terhubung langsung ke data Rekam Medis.
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">

        {/* ML */}
        <div className="premium-card bg-white rounded-3xl shadow-sm border border-slate-100 p-5 sm:p-6 space-y-3">

          <div className="flex items-center gap-3">
            <Cpu className="text-blue-500" />
            <h2 className="text-xl font-bold">
              Sistem Analisis
            </h2>
          </div>

          <div className="space-y-2 text-slate-600">
            <p>Database: {errorMessage ? "Perlu dicek" : "Terhubung"}</p>
            <p>Sistem: {modelReady ? "Siap" : "Perlu dicek"}</p>
            <p>Rata-rata Akurasi: {dashboardStats.averageAccuracy}%</p>
            <p>Prediksi Terbaru: {dashboardStats.latestPrediction}</p>
            <p>Dataset Tersimpan: {records.length}</p>
          </div>
        </div>

        {/* CONNECTED DEVICE */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 sm:p-6 space-y-4">

          <div className="flex items-center gap-3">
            <Wifi className="text-emerald-500" />
            <h2 className="text-xl font-bold">
              Perangkat Terhubung
            </h2>
          </div>

          <div className="space-y-3">
            {devices.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                Menunggu heartbeat ESP32.
              </div>
            ) : (
              devices.map((device) => (
                <motion.div
                  key={device.id || device.device_id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 border border-slate-100 p-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">
                      {device.device_id}
                    </p>

                    <p className="text-xs text-slate-500 truncate">
                      {formatRelativeHeartbeat(device)}
                    </p>
                  </div>

                  <motion.div
                    animate={{ scale: device.status === "online" ? [1, 1.04, 1] : 1 }}
                    transition={{ repeat: device.status === "online" ? Infinity : 0, duration: 2 }}
                  >
                    <StatusBadge
                      status={
                        getDeviceUxStatus(device)
                      }
                    />
                  </motion.div>
                </motion.div>
              ))
            )}

            <div className="pt-2 text-sm text-slate-500">
              Online: {connectedDevices.length} / {devices.length}
            </div>
          </div>
        </div>

        {/* QUICK ACTION */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 sm:p-6 space-y-4">

          <h2 className="text-xl font-bold">
            Aksi Cepat
          </h2>

          <button
            onClick={() => navigate("/analisis")}
            className="btn-premium w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-2xl flex items-center justify-center gap-2"
          >
            <PlusCircle size={18} />
            Analisis Baru
          </button>

          <button
            onClick={() => navigate("/rekam-medis")}
            className="btn-premium w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-2xl flex items-center justify-center gap-2"
          >
            <FolderOpen size={18} />
            Rekam Medis
          </button>

          <button
            onClick={exportDashboardCsv}
            disabled={csvExporting}
            className="btn-premium w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-2xl flex items-center justify-center gap-2"
          >
            {csvExporting ? <ButtonSpinner /> : <Download size={18} />}
            {csvExporting ? "Mengekspor..." : "Ekspor Data"}
          </button>

        </div>
      </div>

      {/* FEATURE COMPLETION */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 min-w-0">
        <div className="premium-card bg-white rounded-3xl shadow-sm border border-slate-100 p-5 sm:p-6 min-w-0">
          <div className="flex items-center gap-3 mb-5">
            <ServerCog className={modelReady ? "text-emerald-500" : "text-orange-500"} />
            <h2 className="text-xl font-bold text-slate-800">
              Status Sistem
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-slate-400">Status</p>
              <p className={`font-bold mt-1 ${modelReady ? "text-emerald-600" : "text-orange-600"}`}>
                {modelStatus?.status || "unknown"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-slate-400">Input</p>
              <p className="font-bold text-slate-700 mt-1">
                {modelStatus?.input_size?.join("x") || "224x224"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-slate-400">Kategori</p>
              <p className="font-bold text-slate-700 mt-1">
                {modelStatus?.classes?.length || 0}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-slate-400">Ukuran</p>
              <p className="font-bold text-slate-700 mt-1">
                {modelStatus?.model_size_mb ? `${modelStatus.model_size_mb} MB` : "-"}
              </p>
            </div>
          </div>

          {modelStatus?.error && (
            <p className="mt-4 text-sm text-red-600 break-words">
              {modelStatus.error}
            </p>
          )}
        </div>

        <div className="premium-card bg-white rounded-3xl shadow-sm border border-slate-100 p-5 sm:p-6 min-w-0">
          <div className="flex items-center gap-3 mb-5">
            <ListChecks className="text-blue-500" />
            <h2 className="text-xl font-bold text-slate-800">
              Aktivitas Terakhir
            </h2>
          </div>

          <div className="space-y-3">
            {activityLogs.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                Belum ada aktivitas sistem yang tercatat.
              </div>
            ) : (
              activityLogs.slice(0, 4).map((log, index) => (
                <motion.div
                  key={log.id}
                  className="rounded-2xl bg-slate-50 border border-slate-100 p-4"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.07 }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-slate-800 truncate">
                      {log.title}
                    </p>
                    <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 rounded-full px-2 py-1">
                      {log.event_type}
                    </span>
                  </div>

                  <p className="text-sm text-slate-500 mt-1 break-words">
                    {log.detail || "-"}
                  </p>
                </motion.div>
              ))
            )}
          </div>
        </div>

        <div className="premium-card bg-white rounded-3xl shadow-sm border border-slate-100 p-5 sm:p-6 min-w-0">
          <div className="flex items-center gap-3 mb-5">
            <Radio className="text-emerald-500" />
            <h2 className="text-xl font-bold text-slate-800">
              Persiapan Perangkat
            </h2>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                <HardDrive size={18} className="text-slate-500" />
                <p className="font-bold text-slate-800">
                  Endpoint Siap
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(deviceArchitecture?.prepared_endpoints || [
                  "GET /devices",
                  "POST /devices/heartbeat",
                  "GET /devices/{device_id}/status",
                ]).map((endpoint) => (
                  <span
                    key={endpoint}
                    className="rounded-full bg-white border border-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                  >
                    {endpoint}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-400">Perangkat Terdaftar</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {connectedDevices.length} / {devices.length}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                {latestDevice
                  ? `${latestDevice.device_id} - ${formatRelativeHeartbeat(latestDevice)}`
                  : "ESP32 heartbeat belum diterima"}
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </AnimatedPage>
  );
}



