import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { haptic } from "@/lib/telegram";

const TABS = [
  { to: "/", key: "play", icon: "🎯" },
  { to: "/wallet", key: "wallet", icon: "💰" },
  { to: "/profile", key: "profile", icon: "👤" },
  { to: "/report", key: "report", icon: "🛟" },
] as const;

export function TabBar() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="pointer-events-none sticky bottom-0 z-40 mt-auto bg-gradient-to-t from-bg via-bg to-transparent pt-6">
      <div className="glass pointer-events-auto mx-3 mb-3 flex items-center justify-around rounded-3xl bg-bg-card/95 px-2 py-2">
        {TABS.map((tab) => {
          const active = tab.to === "/" ? pathname === "/" : pathname.startsWith(tab.to);
          return (
            <button
              key={tab.to}
              onClick={() => {
                haptic.select();
                nav(tab.to);
              }}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 transition-colors ${
                active ? "text-accent" : "text-ink-faint"
              }`}
            >
              <span className={`text-xl ${active ? "drop-shadow-[0_0_8px_rgba(34,211,238,0.85)]" : ""}`}>
                {tab.icon}
              </span>
              <span className="text-[11px] font-semibold">{t(`nav.${tab.key}`)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
