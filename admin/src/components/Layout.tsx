import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { Icon, type IconName } from "@/components/Icon";
import { initials } from "@/lib/format";

type NavItem = { to: string; label: string; icon: IconName; end?: boolean };

const groups: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: "dashboard", end: true },
      { to: "/transactions", label: "Transactions", icon: "transactions" },
      { to: "/users", label: "Users", icon: "users" },
      { to: "/games", label: "Games", icon: "games" },
    ],
  },
  {
    heading: "Operations",
    items: [
      { to: "/bots", label: "Filler bots", icon: "bots" },
      { to: "/bonus", label: "Bonus", icon: "bonus" },
      { to: "/promo", label: "Promo codes", icon: "promo" },
      { to: "/verification", label: "Verification", icon: "shield" },
      { to: "/reports", label: "Reports", icon: "reports" },
      { to: "/staff", label: "Staff", icon: "staff" },
      { to: "/settings", label: "Settings", icon: "coins" },
    ],
  },
];

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2 py-1">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-[15px] font-extrabold text-white shadow-glow">
        B
      </div>
      <div className="leading-tight">
        <div className="text-[14px] font-bold text-txt">EDL Bingo</div>
        <div className="text-[11px] font-medium text-txt-3">Operations</div>
      </div>
    </div>
  );
}

export function Layout() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [location.pathname]);

  const navBody = (
    <>
      <div className="px-3 pb-6 pt-1">
        <Brand />
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-3">
        {groups.map((g) => (
          <div key={g.heading}>
            <div className="px-2.5 pb-2 text-[10px] font-bold uppercase text-txt-4">
              {g.heading}
            </div>
            <div className="space-y-0.5">
              {g.items.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    `flex min-h-10 items-center gap-3 rounded-lg border-l-[3px] px-2.5 py-2 text-[13px] font-medium transition ${
                      isActive
                        ? "border-brand bg-brand/10 font-semibold text-brand"
                        : "border-transparent text-txt-2 hover:bg-panel2 hover:text-txt"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon name={n.icon} size={17} className={isActive ? "text-brand" : "text-txt-3"} />
                      {n.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-3 flex items-center gap-2.5 border-t border-edgeSoft px-4 pb-1 pt-4">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand/10 text-xs font-bold text-brand">
          {initials(user?.first_name, undefined)}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-semibold text-txt">{user?.first_name ?? "Admin"}</div>
          <div className="text-[11px] font-medium text-txt-3">Administrator</div>
        </div>
        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          title="Log out"
          className="grid h-9 w-9 place-items-center rounded-lg text-txt-3 transition hover:bg-danger/10 hover:text-danger"
        >
          <Icon name="logout" size={16} />
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen lg:flex">
      {open && (
        <div className="fixed inset-0 z-30 bg-txt/35 lg:hidden" onClick={() => setOpen(false)} aria-hidden />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-edge bg-panel py-4 shadow-xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {navBody}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-edge bg-panel/95 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="grid h-9 w-9 place-items-center rounded-lg text-txt-2 hover:bg-panel2 hover:text-txt">
            <Icon name="menu" size={22} />
          </button>
          <Brand />
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
