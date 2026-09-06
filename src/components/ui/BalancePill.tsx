import { useTranslation } from "react-i18next";
import { useWallet } from "@/store/walletStore";
import { money } from "@/lib/format";
import { haptic } from "@/lib/telegram";
import { useToast } from "@/components/ui/Toast";

/** Shows the player's cash balance and, when they have it, their play-only bonus. */
export function BalancePill() {
  const { t } = useTranslation();
  const push = useToast((s) => s.push);
  const wallet = useWallet((s) => s.wallet);
  const bonus = useWallet((s) => s.bonus);

  return (
    <div className="flex items-center gap-2">
      <div className="glass rounded-full px-4 py-2">
        <div className="text-[10px] uppercase tracking-wide text-ink-faint">
          {t("lobby.balance")}
        </div>
        <div className="font-display text-lg font-extrabold leading-none text-neon-gold">
          {money(wallet?.balance)}
        </div>
      </div>

      {/* Bonus sits beside the cash balance rather than added into it: it is
          spent first but cannot be withdrawn, so merging the two would overstate
          what the player can cash out. Tappable — the ⓘ invites a tap that
          explains what the bonus is, since a lone figure that behaves unlike
          cash is exactly what confuses players. */}
      {bonus > 0 && (
        <button
          type="button"
          onClick={() => {
            haptic.impact("light");
            push(t("wallet.bonusHint"), "info");
          }}
          className="glass flex items-center gap-2 rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-3.5 py-2 shadow-glow-cyan transition active:scale-95"
        >
          <span className="text-lg leading-none">🎁</span>
          <div className="text-left leading-none">
            <div className="text-[10px] uppercase tracking-wide text-neon-cyan/70">
              {t("lobby.bonus")}
            </div>
            <div className="mt-0.5 font-display text-lg font-extrabold leading-none text-neon-cyan">
              {money(bonus)}
            </div>
          </div>
          <span className="self-start text-[11px] leading-none text-neon-cyan/50">ⓘ</span>
        </button>
      )}
    </div>
  );
}
