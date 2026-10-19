import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth, type Module } from "../auth";

interface NavItem {
  label: string;
  to: string;
  module: Module;
  icon: React.ReactNode;
}

const I = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5 shrink-0" width="18" height="18" aria-hidden>
    <path d={d} />
  </svg>
);

const NAV: NavItem[] = [
  { label: "Dashboard", to: "/", module: "dashboard", icon: I("M3 12h4M11 4v16M17 8h4M3 4h4a1 1 0 0 1 1 1v14H4a1 1 0 0 1-1-1V4zM15 8v10h5V9a1 1 0 0 0-1-1h-4a0 0 0 0 0 0 0z") },
  { label: "Students", to: "/students", module: "students", icon: I("M12 3 2 8l10 5 10-5-10-5zM6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5") },
  { label: "Programmes", to: "/programmes", module: "programmes", icon: I("M4 6h16M4 6v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2") },
  { label: "Finance", to: "/finance", module: "finance", icon: I("M3 7h18M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7M3 7l2-3h14l2 3M8 12h8") },
  { label: "Human Resources", to: "/hr/employees", module: "hr", icon: I("M17 8a5 5 0 1 1-10 0 5 5 0 0 1 10 0zM3 21a9 9 0 0 1 18 0") },
  { label: "Import / Export", to: "/import-export", module: "import", icon: I("M4 12a8 8 0 0 1 13.6-5.7M20 12a8 8 0 0 1-13.6 5.7M17 3v3h-3M7 21v-3h3") },
  { label: "User Management", to: "/users", module: "users", icon: I("M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 21a4 4 0 0 0-8 0M16 11a3 3 0 1 0 0-6") },
  { label: "Settings", to: "/settings", module: "settings", icon: I("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z") },
];

const ROLE_LABEL: Record<string, string> = {
  administrator: "Administrator",
  finance_officer: "Finance Officer",
  student_affairs_officer: "Student Affairs Officer",
  hr_officer: "HR Officer",
};

export function Layout() {
  const { user, logout, can } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const initials = user
    ? user.fullName
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-gray-200 bg-white transition-transform duration-150 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:w-16"
        }`}
      >
        <div className="flex h-14 items-center gap-2 border-b border-gray-200 px-4">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-700 text-xs font-bold text-white">UN</span>
          {sidebarOpen && <span className="text-sm font-semibold tracking-tight">UniCore</span>}
          <button
            type="button"
            className="ml-auto rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3" aria-label="Main navigation">
          {NAV.filter((item) => can(item.module)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-primary-50 text-primary-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`
              }
              title={item.label}
            >
              {item.icon}
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-gray-200 p-3 text-xs text-gray-400">
          {sidebarOpen ? <p>v0.1 · learning build</p> : <p className="text-center">v0.1</p>}
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle navigation"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <p className="text-sm text-gray-500">UniCore University</p>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-100 text-[11px] font-semibold text-primary-700">
                {initials}
              </span>
              <span className="hidden text-sm font-medium sm:block">{user?.fullName}</span>
              <span className="hidden badge-navy sm:inline-flex">{ROLE_LABEL[user?.roleCode ?? ""] ?? user?.roleCode}</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-lg" role="menu">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-gray-900">{user?.fullName}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <div className="my-1 border-t border-gray-100" />
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/settings");
                  }}
                >
                  Account & settings
                </button>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                    navigate("/login");
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-gray-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
