import { LayoutDashboard, LogOut, UserRound, ClipboardList } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/user/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/user/history", label: "Riwayat", icon: ClipboardList },
  { to: "/user/profile", label: "Profile", icon: UserRound },
];

export default function UserPortalShell({ children, compact = false, wide = false }) {
  const { logout } = useAuth();
  const widthClass = wide ? "max-w-6xl" : compact ? "max-w-4xl" : "max-w-3xl";

  return (
    <main className="min-h-dvh bg-[linear-gradient(180deg,#eff6ff_0%,#f8fafc_46%,#ecfeff_100%)] px-4 py-6 sm:px-6 sm:py-8">
      <div className={`mx-auto flex w-full flex-col gap-5 ${widthClass}`}>
        <nav className="rounded-[26px] bg-white/90 p-2 shadow-[0_20px_56px_rgba(15,23,42,0.09)] ring-1 ring-white/80 backdrop-blur">
          <div className="grid grid-cols-4 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-black transition sm:flex-row sm:text-sm ${
                      isActive
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                        : "text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                    }`
                  }
                >
                  <Icon size={17} />
                  {item.label}
                </NavLink>
              );
            })}

            <button
              type="button"
              onClick={logout}
              className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl bg-red-600 px-2 py-2 text-[11px] font-black text-white shadow-lg shadow-red-200 transition hover:bg-red-700 active:scale-[0.99] sm:flex-row sm:text-sm"
            >
              <LogOut size={17} />
              Logout
            </button>
          </div>
        </nav>

        {children}
      </div>
    </main>
  );
}
