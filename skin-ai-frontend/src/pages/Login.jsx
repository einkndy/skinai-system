import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../config";
import { AnimatedPage, ButtonSpinner } from "../components/ui";

export default function Login() {
  const [activeTab, setActiveTab] = useState("login");
  const [clinicName, setClinicName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      toast.warning("Email dan kata sandi wajib diisi");
      return;
    }

    try {
      setAuthLoading(true);
      const res = await axios.post(`${API_URL}/login`, {
        email: email.trim().toLowerCase(),
        password,
      });

      login(res.data);
      toast.success("Login berhasil. Membuka dashboard...");
      navigate(res.data.role === "user" ? "/user/dashboard" : "/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Email atau kata sandi tidak sesuai");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!clinicName.trim() || !email.trim() || !password) {
      toast.warning("Nama klinik, email, dan kata sandi wajib diisi");
      return;
    }

    if (password.length < 6) {
      toast.warning("Kata sandi minimal 6 karakter");
      return;
    }

    try {
      setAuthLoading(true);
      await axios.post(`${API_URL}/register`, {
        clinic_name: clinicName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      toast.success("Akun berhasil dibuat. Silakan masuk.");
      setActiveTab("login");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Akun tidak dapat dibuat");
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <AnimatedPage>
    <div className="min-h-dvh flex items-center justify-center bg-[#eaf1fb] px-4 py-6 sm:py-8 overflow-y-auto">

      {/* CARD */}
      <div className="bg-white w-full max-w-xl p-6 sm:p-8 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.08)]">

        {/* LOGO */}
        <div className="text-center mb-7">
          <div className="relative mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 via-cyan-500 to-emerald-400 shadow-[0_18px_42px_rgba(37,99,235,0.28)]">
            <div className="absolute inset-2 rounded-xl border border-white/35"></div>
            <div className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-white shadow-sm"></div>
            <span className="relative text-2xl font-black text-white tracking-normal">
              S
            </span>
          </div>

          <h1 className="text-3xl font-bold text-gray-800">
            SkinAI
          </h1>

          <p className="text-gray-500 text-sm mt-1">
            Sistem Monitoring Kulit Klinik
          </p>
        </div>

        {/* TAB */}
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab("login")}
            disabled={authLoading}
            className={`h-11 rounded-xl text-sm font-bold transition-all ${
              activeTab === "login"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Masuk Sekarang
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("register")}
            disabled={authLoading}
            className={`h-11 rounded-xl text-sm font-bold transition-all ${
              activeTab === "register"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Daftar Akun
          </button>
        </div>

        {/* LOGIN */}
        {activeTab === "login" && (
          <motion.form
            key="login"
            onSubmit={handleLogin}
            className="space-y-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >

            <div>
              <label className="text-sm font-medium text-gray-700">
                Username atau Email
              </label>
              <input
                type="text"
                placeholder="username atau email"
                value={email}
                required
                disabled={authLoading}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 mt-2 px-4 rounded-2xl bg-gray-100 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Kata Sandi
              </label>
              <input
                type="password"
                placeholder="********"
                value={password}
                required
                disabled={authLoading}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 mt-2 px-4 rounded-2xl bg-gray-100 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="btn-premium w-full h-12 bg-blue-600 text-white rounded-2xl mt-3 hover:bg-blue-700 transition font-bold shadow-md inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {authLoading && <ButtonSpinner />}
              {authLoading ? "Memproses..." : "Masuk Sekarang"}
            </button>
          </motion.form>
        )}

        {/* REGISTER */}
        {activeTab === "register" && (
          <motion.form
            key="register"
            onSubmit={handleRegister}
            className="space-y-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >

            <div>
              <label className="text-sm font-medium text-gray-700">
                Nama Klinik
              </label>
              <input
                type="text"
                placeholder="Klinik Estetika"
                value={clinicName}
                required
                disabled={authLoading}
                onChange={(e) => setClinicName(e.target.value)}
                className="w-full h-12 mt-2 px-4 rounded-2xl bg-gray-100 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Email Admin
              </label>
              <input
                type="email"
                placeholder="admin@klinik.com"
                value={email}
                required
                disabled={authLoading}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 mt-2 px-4 rounded-2xl bg-gray-100 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Kata Sandi
              </label>
              <input
                type="password"
                placeholder="Minimal 6 karakter"
                value={password}
                required
                minLength={6}
                disabled={authLoading}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 mt-2 px-4 rounded-2xl bg-gray-100 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="btn-premium w-full h-12 bg-blue-600 text-white rounded-2xl mt-3 hover:bg-blue-700 transition font-bold shadow-md inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {authLoading && <ButtonSpinner />}
              {authLoading ? "Mendaftarkan..." : "Daftar Akun Klinik"}
            </button>
          </motion.form>
        )}
      </div>
    </div>
    </AnimatedPage>
  );
}


