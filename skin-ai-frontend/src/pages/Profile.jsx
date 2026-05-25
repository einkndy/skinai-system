import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Activity,
  Camera,
  Database,
  Mail,
  MapPin,
  MonitorCheck,
  Phone,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getHistory } from "../services/HistoryService";
import { API_URL } from "../config";
import { AnimatedPage, ButtonSpinner, SkeletonCard } from "../components/ui";

export default function Profile() {
  const { admin, updateAdmin } = useAuth();
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({
    clinic: "",
    email: "",
    phone: "",
    address: "",
  });
  const [profileFile, setProfileFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

  useEffect(() => {
    loadProfileStats();
    loadAdminProfile();
  }, []);

  const loadProfileStats = async () => {
    try {
      setStatsLoading(true);
      setStatsError("");

      const data = await getHistory();

      setRecords(data);
    } catch (error) {
      console.error("ERROR LOAD PROFILE STATS:", error);
      setStatsError(error.message || "Gagal memuat statistik rekam medis.");
      setRecords([]);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadAdminProfile = async () => {
    if (!admin?.id) return;

    try {
      const res = await axios.get(`${API_URL}/admin/${admin.id}`);

      updateAdmin(res.data);
      syncForm(res.data);
    } catch (error) {
      console.error("ERROR LOAD ADMIN PROFILE:", error);
      syncForm(admin);
    }
  };

  const syncForm = (data) => {
    setForm({
      clinic: data?.clinic || "",
      email: data?.email || "",
      phone: data?.phone || "",
      address: data?.address || "",
    });

    setPreview(
      data?.profile_image
        ? `${API_URL}/uploads/${data.profile_image}`
        : ""
    );
  };

  const handleProfileImage = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setProfileFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.clinic.trim() || !form.email.trim()) {
      toast.warning("Nama klinik dan email wajib diisi");
      return;
    }

    try {
      setSaving(true);

      const payload = new FormData();
      payload.append("clinic_name", form.clinic.trim());
      payload.append("email", form.email.trim().toLowerCase());
      payload.append("phone", form.phone.trim());
      payload.append("address", form.address.trim());

      if (profileFile) {
        payload.append("profile_image", profileFile);
      }

      const res = await axios.put(`${API_URL}/admin/${admin.id}`, payload, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      updateAdmin(res.data);
      syncForm(res.data);
      setProfileFile(null);

      toast.success("Profile berhasil diperbarui");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Profile gagal diperbarui. Coba beberapa saat lagi.");
    } finally {
      setSaving(false);
    }
  };

  const uniquePatients = new Set(
    records.map((record) => record.patient_id || record.kode_pasien || record.id)
  );

  const trackingPatients = new Set(
    records
      .filter((record) => record.paket_type === "tracking")
      .map((record) => record.patient_id || record.kode_pasien || record.id)
  ).size;

  const totalScans = records.length;

  return (
    <AnimatedPage>
    <div className="page-enter space-y-6 min-w-0">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 min-w-0">
        <div className="premium-card bg-white rounded-3xl p-5 sm:p-7 shadow-sm border border-slate-100">
          <div className="flex flex-col items-center text-center">
            <label className="relative cursor-pointer group">
              <div className="w-36 h-36 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 p-1">
                <div className="w-full h-full rounded-full bg-slate-100 overflow-hidden flex items-center justify-center">
                  {preview ? (
                      <img
                        src={preview}
                        alt="Profile admin"
                        className="image-fade w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                  ) : (
                    <span className="text-3xl sm:text-4xl font-bold text-blue-600">
                      {(form.clinic || "A").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>

              <div className="absolute bottom-2 right-2 w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg group-active:scale-95 transition">
                <Camera size={18} />
              </div>

              <input
                type="file"
                accept="image/*"
                onChange={handleProfileImage}
                className="hidden"
              />
            </label>

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mt-6">
              {form.clinic || "Admin Klinik"}
            </h1>

            <p className="text-slate-400 mt-1">
              {form.email || "-"}
            </p>

            <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 text-sm font-bold">
              <ShieldCheck size={16} />
              Administrator Aktif
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="premium-card xl:col-span-2 bg-white rounded-3xl p-5 sm:p-7 shadow-sm border border-slate-100 min-w-0"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">
                Informasi Klinik
              </h2>

              <p className="text-sm text-slate-400 mt-1">
                Data ini tersimpan di database admin klinik.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn-premium inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 text-white font-semibold disabled:opacity-60"
            >
              {saving ? <ButtonSpinner /> : <Save size={18} />}
              {saving ? "Menyimpan..." : "Simpan Profile"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 min-w-0">
            <div>
              <label className="text-sm font-semibold text-slate-500">
                Nama Klinik
              </label>

              <input
                value={form.clinic}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    clinic: e.target.value,
                  }))
                }
                className="w-full mt-2 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-500">
                Email Admin
              </label>

              <div className="relative mt-2">
                <Mail
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                  className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-500">
                Nomor Telepon
              </label>

              <div className="relative mt-2">
                <Phone
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                  placeholder="08xxxxxxxxxx"
                  className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-500">
                Alamat Klinik
              </label>

              <div className="relative mt-2">
                <MapPin
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={form.address}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      address: e.target.value,
                    }))
                  }
                  placeholder="Alamat klinik"
                  className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
        {statsError && (
          <div className="md:col-span-3 rounded-3xl border border-red-100 bg-red-50 p-5 text-red-600 font-semibold">
            {statsError}
          </div>
        )}

        {statsLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
        <div className="bg-white rounded-3xl p-5 sm:p-6 premium-card border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-400 font-semibold">
            Pasien Ditangani
          </p>

          <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mt-2">
            {uniquePatients.size}
          </h2>
        </div>

        <div className="bg-white rounded-3xl p-5 sm:p-6 premium-card border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-400 font-semibold">
            Tracking Aktif
          </p>

          <h2 className="text-3xl sm:text-4xl font-bold text-purple-600 mt-2">
            {trackingPatients}
          </h2>
        </div>

        <div className="bg-white rounded-3xl p-5 sm:p-6 premium-card border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-400 font-semibold">
            Total Scan
          </p>

          <h2 className="text-3xl sm:text-4xl font-bold text-blue-600 mt-2">
            {totalScans}
          </h2>
        </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              Informasi Sistem
            </h2>

            <p className="text-sm text-slate-400 mt-1">
              Ringkasan kesiapan sistem pemeriksaan dan penyimpanan data.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
            <div className="rounded-2xl bg-blue-50 p-4 min-w-[180px]">
              <div className="flex items-center gap-2 text-blue-600 font-bold">
                <MonitorCheck size={18} />
                Pemeriksaan
              </div>
              <p className="text-sm text-slate-500 mt-2">
                Siap digunakan
              </p>
            </div>

            <div className="rounded-2xl bg-emerald-50 p-4 min-w-[180px]">
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <Database size={18} />
                Database
              </div>
              <p className="text-sm text-slate-500 mt-2">
                {statsError ? "Perlu dicek" : "Tersinkron"}
              </p>
            </div>

            <div className="rounded-2xl bg-purple-50 p-4 min-w-[180px]">
              <div className="flex items-center gap-2 text-purple-600 font-bold">
                <Activity size={18} />
                Monitoring
              </div>
              <p className="text-sm text-slate-500 mt-2">
                {statsLoading ? "Memuat..." : `${records.length} pemeriksaan`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </AnimatedPage>
  );
}


