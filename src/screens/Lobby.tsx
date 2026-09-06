import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ScreenShell } from "@/components/layout/ScreenShell";
import { BalancePill } from "@/components/ui/BalancePill";
import { LangToggle } from "@/components/ui/LangToggle";
import { Card } from "@/components/ui/Card";
import { STAKES } from "@/lib/constants";
import { money } from "@/lib/format";
import { api } from "@/lib/api";
import { haptic } from "@/lib/telegram";
import type { Game, GameType } from "@/types/api";
import { PromoTicker } from "@/components/lobby/PromoTicker";
import { DailyStreak } from "@/components/lobby/DailyStreak";

export function Lobby() {
  const { t } = useTranslation();
  const nav = useNavigate();

  // Fetch all available games (no `type` → no game is auto-created).
  const { data } = useQuery({
    queryKey: ["games"],
    queryFn: () => api.games(),
    refetchInterval: 5000,
  });

  const byType = useMemo(() => groupByType(data?.games ?? []), [data]);

  // Returning to a live game (including one that's already DRAWING, which the
  // open-game cards below no longer list) is handled by the persistent
  // LiveGamePill, shown on every screen — so there's no inline banner here.

  return (
    <ScreenShell>
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold neon-text">
            {t("app.name")}
          </h1>
          <p className="text-xs text-neon-cyan">{t("app.tagline")}</p>
        </div>
        <LangToggle />
      </header>

      <div className="mb-3">
        <BalancePill />
      </div>

      <PromoTicker />
      <DailyStreak />

      <div className="mb-2 mt-4 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-bold">{t("lobby.pickRoom")}</h2>
        <span className="text-xs text-ink-faint">{t("lobby.higherBigger")}</span>
      </div>

      <div className="flex flex-col gap-3">
        {STAKES.map((s, i) => {
          const agg = byType[s.type];
          const live = (agg?.players ?? 0) > 0;
          const vip = s.vip;
          return (
            <motion.button
              key={s.type}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => {
                haptic.impact(vip ? "heavy" : "medium");
                nav(`/play/${s.type}`);
              }}
              className="text-left"
            >
              <Card
                className={[
                  "relative overflow-hidden !p-4 transition-transform active:scale-[0.98]",
                  vip
                    ? "border-neon-gold/50 bg-gradient-to-br from-neon-gold/20 via-bg-card to-bg-card shadow-glow-gold ring-1 ring-neon-gold/30"
                    : "",
                ].join(" ")}
              >
                {/* corner glow */}
                <div
                  className={[
                    "pointer-events-none absolute -right-8 -top-8 size-24 rounded-full blur-2xl",
                    vip ? "bg-neon-gold opacity-30" : "bg-accent opacity-20",
                  ].join(" ")}
                />
                {/* VIP shine sweep */}
                {vip && (
                  <span className="pointer-events-none absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                )}

                <div className="relative flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {vip && <span className="text-lg leading-none">👑</span>}
                      <span
                        className={[
                          "font-display text-sm font-bold uppercase tracking-wide",
                          vip ? "text-neon-gold" : "text-ink-muted",
                        ].join(" ")}
                      >
                        {t(`lobby.tier.${s.type}`)}
                      </span>
                      {vip && (
                        <span className="rounded-full bg-neon-gold px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-bg">
                          {t("lobby.vipTag")}
                        </span>
                      )}
                      {live && (
                        <span className="flex items-center gap-1 rounded-full bg-neon-green/20 px-2 py-0.5 text-[9px] font-bold text-neon-green">
                          <span className="size-1.5 animate-pulse rounded-full bg-neon-green" />
                          {t("lobby.liveNow")}
                        </span>
                      )}
                    </div>
                    <div
                      className={[
                        "mt-1 font-display text-3xl font-extrabold",
                        vip
                          ? "text-neon-gold drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]"
                          : "text-ink",
                      ].join(" ")}
                    >
                      {money(s.bet)}
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-ink-muted">
                      <span>
                        👥 {agg?.players ?? 0} {t("common.players")}
                      </span>
                      <span className="text-neon-cyan">
                        🏆 {money(agg?.prize ?? 0)}
                      </span>
                    </div>
                  </div>

                  <div
                    className={[
                      "shrink-0 rounded-xl px-5 py-2.5 text-center font-display text-sm font-bold",
                      vip
                        ? "bg-grad-gold text-bg shadow-glow-gold"
                        : "bg-accent text-white",
                    ].join(" ")}
                  >
                    {vip ? t("lobby.vipRoom") : t("lobby.playBingo")} →
                  </div>
                </div>
              </Card>
            </motion.button>
          );
        })}
      </div>
    </ScreenShell>
  );
}

function groupByType(games: Game[]): Record<string, { players: number; prize: number }> {
  const out: Record<GameType, { players: number; prize: number }> = {} as any;
  for (const g of games) {
    const cur = out[g.game_type] ?? { players: 0, prize: 0 };
    cur.players += g.player_count;
    cur.prize = Math.max(cur.prize, g.prize_pool);
    out[g.game_type] = cur;
  }
  return out;
}
