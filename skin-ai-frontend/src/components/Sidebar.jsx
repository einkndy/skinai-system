import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ScanFace,
  FileText,
  Sparkles,
  UserCircle,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../config";

export default function Sidebar({ mobile = false, onClose }) {
  const navigate = useNavigate();
  const { admin, logout } = useAuth();

  const menu =
    "flex items-center gap-3 px-5 py-3 rounded-xl font-medium transition-all whitespace-nowrap shrink-0";

  const handleLogout = () => {
    logout();
    onClose?.();
    navigate("/");
  };

  const handleNavigateProfile = () => {
    onClose?.();
    navigate("/profile");
  };

  const profileImage = admin?.profile_image
    ? `${API_URL}/uploads/${admin.profile_image}`
    : "";

  return (
    <div
      className={`skin-sidebar ${mobile ? "skin-sidebar-mobile" : ""} w-full bg-white flex flex-col justify-between shrink-0 ${
        mobile
          ? "h-full border-r"
          : "lg:w-72 lg:h-screen lg:sticky lg:top-0 lg:border-r"
      }`}
    >

      {/* TOP */}
      <div>
        {/* LOGO */}
        <div className="px-4 sm:px-6 py-4 lg:py-6 border-b">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-xl">
              <Sparkles size={20} />
            </div>

            <div>
              <h1 className="text-xl font-bold text-slate-800">SkinAI</h1>
              <p className="text-xs text-slate-400">
                Sistem Monitoring Kulit Klinik
              </p>
            </div>
          </div>
        </div>

        {/* MENU */}
        <div
          className={`skin-sidebar-menu p-3 sm:p-4 gap-2 max-w-full ${
            mobile ? "space-y-2" : "lg:space-y-2 flex lg:block overflow-x-auto"
          }`}
        >

          <NavLink
            to="/dashboard"
            onClick={onClose}
            className={({ isActive }) =>
              `${menu} ${
                isActive
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-700 hover:bg-slate-100"
              }`
            }
          >
            <LayoutDashboard size={20} />
            Dashboard
          </NavLink>

          <NavLink
            to="/analisis"
            onClick={onClose}
            className={({ isActive }) =>
              `${menu} ${
                isActive
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-700 hover:bg-slate-100"
              }`
            }
          >
            <ScanFace size={20} />
            Analisis Baru
          </NavLink>

          <NavLink
            to="/rekam-medis"
            onClick={onClose}
            className={({ isActive }) =>
              `${menu} ${
                isActive
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-700 hover:bg-slate-100"
              }`
            }
          >
            <FileText size={20} />
            Rekam Medis
          </NavLink>

          <NavLink
            to="/profile"
            onClick={onClose}
            className={({ isActive }) =>
              `${menu} ${
                isActive
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-700 hover:bg-slate-100"
              }`
            }
          >
            <UserCircle size={20} />
            Profile
          </NavLink>

          <button
            onClick={handleLogout}
            className={`${mobile ? "flex" : "lg:hidden flex"} items-center gap-3 px-5 py-3 rounded-xl font-medium transition-all text-red-600 bg-red-50 hover:bg-red-100 whitespace-nowrap`}
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </div>

      {/* FOOTER */}
      <div className="skin-sidebar-footer p-3 sm:p-4 border-t space-y-3">
        <button
          onClick={handleNavigateProfile}
          className="btn-premium w-full flex items-center gap-3 bg-slate-50 hover:bg-slate-100 rounded-xl p-3 text-left transition"
        >
          <div className="w-12 h-12 bg-blue-500 rounded-full overflow-hidden flex items-center justify-center text-white font-bold">
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
          </div>

          <div className="min-w-0">
            <p className="font-semibold text-slate-800 text-sm truncate">
              {admin?.clinic || "Admin Klinik"}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {admin?.email || "Administrator"}
            </p>
          </div>
        </button>

        <button
          onClick={handleLogout}
          className="btn-premium w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 font-semibold hover:bg-red-100 transition"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );
}


