import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ScreenShell } from "@/components/layout/ScreenShell";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { LangToggle } from "@/components/ui/LangToggle";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { fullName, money, shortDate } from "@/lib/format";
import { haptic } from "@/lib/telegram";
import { useAuth } from "@/store/authStore";
import { useSettings } from "@/store/settingsStore";

export function Profile() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { user, setUser } = useAuth();
  const push = useToast((s) => s.push);
  const settings = useSettings();
  const [editing, setEditing] = useState(false);
  const [first, setFirst] = useState(user?.first_name ?? "");
  const [last, setLast] = useState(user?.last_name ?? "");
  const [saving, setSaving] = useState(false);

  const history = useQuery({
    queryKey: ["my-games"],
    queryFn: async () => (await api.myGames(15)).games ?? [],
  });

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.updateName(first.trim(), last.trim() || null);
      setUser(updated);
      push(t("profile.nameSaved"), "success");
      setEditing(false);
    } catch {
      push("error", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell>
      <Header title={t("profile.title")} />

      <Card className="flex items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-full bg-bg-elevated text-2xl font-extrabold">
          {(user?.first_name ?? "?").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="font-display text-lg font-bold">
            {fullName(user?.first_name ?? "", user?.last_name)}
          </div>
          <div className="text-xs text-ink-faint">{user?.phone_number}</div>
        </div>
        <Button variant="ghost" className="!px-3 !py-2 text-sm" onClick={() => setEditing(true)}>
          ✏️
        </Button>
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Button variant="cyan" onClick={() => nav("/referral")}>
          🎁 {t("profile.referral")}
        </Button>
        <Button variant="ghost" onClick={() => nav("/leaderboard")}>
          🏅 {t("profile.leaderboard")}
        </Button>
      </div>

      {/* Settings */}
      <Card className="mt-3">
        <Row label={t("profile.language")}>
          <LangToggle />
        </Row>
        <Toggle label={t("profile.haptics")} on={settings.hapticsEnabled} onClick={settings.toggleHaptics} />
      </Card>

      {/* History */}
      <h2 className="mb-2 mt-5 font-display text-lg font-bold">{t("profile.history")}</h2>
      <div className="flex flex-col gap-2">
        {history.data?.length ? (
          history.data.map((entry: any, i: number) => {
            // Backend returns { game, is_winner, card_id, ... }; tolerate a flat
            // shape too just in case.
            const g = entry.game ?? entry;
            const when = g.finished_at ?? g.created_at;
            const won =
              entry.is_winner === true || (!!user?.id && g.winner_id === user.id);
            const cards = entry.cards_held ?? 1;
            // What the player actually spent (all cards). Fall back to the
            // single bet for older entries without total_stake.
            const spent = entry.total_stake ?? g.bet_amount;
            // The exact amount this player was paid across their winning cards
            // (backend field win_amount). Shown only when they actually won.
            const wonAmount = Number(entry.win_amount ?? 0);
            return (
              <Card key={g.id ?? i} className="flex items-center justify-between !py-3">
                <div>
                  <div className="font-bold">
                    {g.game_type ?? "—"}
                    {spent ? ` · ${money(spent)}` : ""}
                  </div>
                  <div className="text-xs text-ink-faint">
                    {cards > 1 ? `${t("profile.cards", { count: cards })} · ` : ""}
                    {when ? shortDate(when) : ""}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Outcome won={won} />
                  {won && wonAmount > 0 && (
                    <span className="text-sm font-bold text-neon-gold">
                      +{money(wonAmount)}
                    </span>
                  )}
                </div>
              </Card>
            );
          })
        ) : (
          <p className="py-6 text-center text-sm text-ink-faint">{t("wallet.empty")}</p>
        )}
      </div>

      <Sheet open={editing} onClose={() => setEditing(false)} title={t("profile.editName")}>
        <div className="flex flex-col gap-3">
          <input
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            placeholder={t("profile.firstName")}
            className="w-full rounded-xl bg-bg-soft px-4 py-3 outline-none ring-1 ring-white/10 focus:ring-accent"
          />
          <input
            value={last ?? ""}
            onChange={(e) => setLast(e.target.value)}
            placeholder={t("profile.lastName")}
            className="w-full rounded-xl bg-bg-soft px-4 py-3 outline-none ring-1 ring-white/10 focus:ring-accent"
          />
          <Button variant="gold" fullWidth loading={saving} onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      </Sheet>
    </ScreenShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="font-semibold">{label}</span>
      {children}
    </div>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <Row label={label}>
      <button
        onClick={() => {
          haptic.select();
          onClick();
        }}
        className={`relative h-7 w-12 rounded-full transition-colors ${on ? "bg-neon-green" : "bg-white/10"}`}
      >
        <span
          className={`absolute top-1 size-5 rounded-full bg-white transition-all ${on ? "left-6" : "left-1"}`}
        />
      </button>
    </Row>
  );
}

function Outcome({ won }: { won: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={`rounded-full px-3 py-1 text-[11px] font-bold ${
        won ? "bg-neon-gold/20 text-neon-gold" : "bg-white/5 text-ink-faint"
      }`}
    >
      {won ? "🏆 " + t("result.winTitle") : t("game.finished")}
    </span>
  );
}
