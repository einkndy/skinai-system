import { useEffect, useState } from "react";
import { Mail, Phone, Save, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import UserPortalShell from "../components/UserPortalShell";
import { ButtonSpinner } from "../components/ui";
import { getUserProfile, updateUserProfile } from "../services/HistoryService";
import { useAuth } from "../context/AuthContext";

export default function UserProfile() {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { admin, updateAdmin } = useAuth();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const profile = await getUserProfile();
        setForm({
          full_name: profile.full_name || admin?.username || "",
          email: profile.email || admin?.email || "",
          phone: profile.phone || "",
          password: "",
        });
      } catch (error) {
        toast.error(error.message || "Profile gagal dimuat");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [admin?.email, admin?.username]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.full_name.trim()) {
      toast.warning("Nama wajib diisi");
      return;
    }

    if (!form.email.trim() || !form.email.includes("@")) {
      toast.warning("Email tidak valid");
      return;
    }

    if (form.password && form.password.length < 6) {
      toast.warning("Password minimal 6 karakter");
      return;
    }

    try {
      setSaving(true);
      const response = await updateUserProfile({
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        password: form.password,
      });

      updateAdmin({
        username: response.full_name || admin?.username,
        email: response.email,
        phone: response.phone,
      });
      setForm((prev) => ({ ...prev, password: "" }));
      toast.success("Profile berhasil diperbarui");
    } catch (error) {
      toast.error(error.message || "Profile gagal disimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <UserPortalShell>
      <section className="rounded-[30px] bg-white/95 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] ring-1 ring-white/80 sm:p-7">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-[24px] bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-200">
            <UserRound size={30} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-500">Profile Pasien</p>
            <h1 className="truncate text-2xl font-black text-slate-900">
              {form.full_name || "User SkinAI"}
            </h1>
          </div>
        </div>

        <div className="mt-6 rounded-[24px] bg-blue-50 p-4 text-sm font-semibold text-blue-800 ring-1 ring-blue-100">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck size={18} /> Profile ini hanya dapat diubah oleh akun Anda sendiri.
          </span>
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="rounded-[30px] bg-white/95 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.10)] ring-1 ring-slate-100 sm:p-7"
      >
        {loading ? (
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <ButtonSpinner /> Memuat profile...
          </div>
        ) : (
          <div className="space-y-5">
            <label className="block">
              <span className="text-sm font-bold text-slate-600">Nama</span>
              <input
                type="text"
                value={form.full_name}
                onChange={(event) => updateField("full_name", event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                placeholder="Nama pasien"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-600">Email</span>
              <div className="relative mt-2">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder="email@domain.com"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-600">Nomor HP</span>
              <div className="relative mt-2">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder="08xxxxxxxxxx"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-600">Password Baru</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                placeholder="Kosongkan jika tidak diubah"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60"
            >
              {saving ? <ButtonSpinner /> : <Save size={18} />}
              {saving ? "Menyimpan..." : "Simpan Profile"}
            </button>
          </div>
        )}
      </form>
    </UserPortalShell>
  );
}
