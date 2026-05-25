import Sidebar from "../components/Sidebar";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../config";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

export default function MainLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { admin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const getTitle = () => {
    if (location.pathname === "/dashboard") return "Dashboard";
    if (location.pathname === "/analisis") return "Analisis Baru";
    if (location.pathname === "/rekam-medis") return "Rekam Medis";
    if (location.pathname === "/profile") return "Profile Admin";
    if (location.pathname.startsWith("/result")) return "Hasil Pemeriksaan";
    return "SkinAI";
  };

  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const profileImage = admin?.profile_image
    ? `${API_URL}/uploads/${admin.profile_image}`
    : "";

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
    <div className="flex flex-col lg:flex-row h-dvh bg-slate-100 overflow-hidden">

      {/* SIDEBAR */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div
        className={`fixed inset-0 z-[80] lg:hidden transition ${
          sidebarOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!sidebarOpen}
      >
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className={`absolute inset-0 bg-slate-950/45 transition-opacity duration-300 ${
            sidebarOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Tutup menu"
        />

        <div
          className={`relative h-full w-[min(82vw,320px)] bg-white shadow-2xl transition-transform duration-300 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar mobile onClose={() => setSidebarOpen(false)} />
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* HEADER */}
        <div className="min-h-20 lg:h-24 bg-white border-b sticky top-0 z-50 flex items-center justify-between gap-3 sm:gap-4 px-3 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-0">

          {/* LEFT */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((value) => !value)}
              className="lg:hidden w-11 h-11 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0"
              aria-label={sidebarOpen ? "Tutup menu" : "Buka menu"}
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-slate-800 truncate">
                {getTitle()}
              </h1>

              <p className="text-xs sm:text-sm text-slate-500 mt-1 truncate">
                {today}
              </p>
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">

            {/* PROFILE */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <p className="text-sm font-semibold text-slate-700">
                  {admin?.clinic || "Admin Klinik"}
                </p>
                <p className="text-xs text-slate-400">
                  Online
                </p>
              </div>

              <button
                onClick={() => navigate("/profile")}
                className="btn-premium w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-full overflow-hidden flex items-center justify-center text-white font-bold shrink-0"
              >
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="Admin"
                    className="image-fade w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  (admin?.clinic || "A").charAt(0).toUpperCase()
                )}
              </button>
            </div>
          </div>
        </div>

        {/* PAGE */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-6 min-w-0">
          <div className="mx-auto w-full max-w-[1680px] min-w-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}


