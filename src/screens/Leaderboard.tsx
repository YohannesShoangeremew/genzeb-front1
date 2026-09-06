import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ScreenShell } from "@/components/layout/ScreenShell";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { FullSpinner } from "@/components/ui/Spinner";
import { api } from "@/lib/api";
import { fullName } from "@/lib/format";
import { useAuth } from "@/store/authStore";

/**
 * The backend exposes no global leaderboard endpoint, so this is a best-effort
 * view built from the signed-in player's own recent games. It is clearly
 * labeled as such rather than fabricating other players' standings.
 */
export function Leaderboard() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: ["my-games-board"],
    queryFn: async () => (await api.myGames(100)).games ?? [],
  });

  const wins = (data ?? []).filter(
    (g: any) => user?.id && (g.winner_id === user.id || g.is_winner === true),
  ).length;

  return (
    <ScreenShell>
      <Header back title={t("leaderboard.title")} />
      <p className="mb-3 text-sm text-ink-muted">{t("leaderboard.subtitle")}</p>

      {isLoading ? (
        <FullSpinner />
      ) : (
        <Card className="flex items-center gap-4">
          <div className="font-display text-2xl font-extrabold text-neon-gold">#1</div>
          <div className="flex size-12 items-center justify-center rounded-full bg-bg-elevated text-xl font-bold">
            {(user?.first_name ?? "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="font-bold">
              {fullName(user?.first_name ?? "", user?.last_name)}{" "}
              <span className="text-xs text-neon-cyan">({t("leaderboard.you")})</span>
            </div>
            <div className="text-sm text-ink-faint">{t("leaderboard.wins", { n: wins })}</div>
          </div>
          <div className="text-2xl">🏆</div>
        </Card>
      )}

      <p className="mt-4 rounded-2xl bg-white/5 px-4 py-3 text-center text-xs text-ink-faint">
        {t("leaderboard.bestEffort")}
      </p>
    </ScreenShell>
  );
}
