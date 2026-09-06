import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import confetti from "canvas-confetti";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { WinnerCardModal } from "@/components/bingo/WinnerCardModal";
import { money } from "@/lib/format";
import { haptic } from "@/lib/telegram";

export type GameResult =
  | { type: "win"; prize: number }
  | { type: "lose" }
  | { type: "eliminated" }
  | { type: "cancelled" }
  | null;

/** One winner on the result screen (its owner, split share, and marks). */
export interface WinnerEntry {
  userId?: string;
  name: string;
  prize: number;
  /** Winner's card id + the numbers they marked — lets anyone verify the win. */
  cardId?: number;
  marked?: number[];
}

export interface WinnerInfo {
  /** Every winning card. More than one means the pot was split. */
  winners: WinnerEntry[];
  /** True when there are multiple co-winners sharing the pot. */
  split: boolean;
  /** The full pot before splitting (for context). */
  prizePool?: number;
}

export function ResultOverlay({
  result,
  winner,
  drawn,
  onPlayAgain,
}: {
  result: GameResult;
  /** Who won this game — shown to everyone (losers/eliminated) for transparency. */
  winner?: WinnerInfo | null;
  /** All numbers called this game — passed through for winner-card context. */
  drawn?: Set<number>;
  onPlayAgain: () => void;
}) {
  const { t } = useTranslation();
  const isWin = result?.type === "win";
  const winners = winner?.winners ?? [];
  const prize = result?.type === "win" ? result.prize : 0;

  // The primary winner whose card we can show and verify (id + marks known).
  const firstVerifiable = winners.find(
    (w) => typeof w.cardId === "number" && !!w.marked,
  );

  useEffect(() => {
    if (isWin) {
      haptic.notify("success");
      const end = Date.now() + 1200;
      const frame = () => {
        confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 } });
        confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 } });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    } else if (result) {
      haptic.notify("error");
    }
  }, [isWin, result]);

  // Auto-return to the lobby after the celebration so players don't have to tap.
  // Ref keeps the latest callback without restarting the timer on every re-render.
  const onPlayAgainRef = useRef(onPlayAgain);
  onPlayAgainRef.current = onPlayAgain;
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => onPlayAgainRef.current(), 6000);
    return () => clearTimeout(timer);
  }, [result]);

  if (!result) return null;

  // Primary path: a single popup showing the winner's marked card (auto-opened
  // for everyone, so any player can verify the win), with one "Back to lobby"
  // button. No stacked results modal.
  if (
    result.type !== "cancelled" &&
    firstVerifiable?.cardId != null &&
    firstVerifiable.marked
  ) {
    return (
      <WinnerCardModal
        open
        onClose={onPlayAgain}
        closeLabel={t("result.backToLobby")}
        cardId={firstVerifiable.cardId}
        marked={firstVerifiable.marked}
        drawn={drawn}
        winnerName={firstVerifiable.name}
        winners={winners}
        youWon={isWin ? prize : undefined}
      />
    );
  }

  // Fallback: cancelled game, or a result with no card to display. A minimal
  // popup so the player always has a clear way back to the lobby.
  return (
    <Modal open onClose={onPlayAgain}>
      <div className="text-6xl">
        {isWin
          ? "🏆"
          : result.type === "eliminated"
            ? "❌"
            : result.type === "cancelled"
              ? "↩️"
              : "🎲"}
      </div>
      <h2 className="mt-3 font-display text-2xl font-extrabold">
        {isWin
          ? t("result.winTitle")
          : result.type === "eliminated"
            ? t("result.eliminatedTitle")
            : result.type === "cancelled"
              ? t("result.cancelledTitle")
              : t("result.loseTitle")}
      </h2>
      {isWin && (
        <p className="mt-1 text-lg font-bold text-neon-gold">
          {t("result.wonAmount", { amount: money(prize) })}
        </p>
      )}
      {result.type === "cancelled" && (
        <p className="mt-1 text-sm text-ink-faint">{t("result.cancelledBody")}</p>
      )}
      <div className="mt-5">
        <Button variant="gold" fullWidth onClick={onPlayAgain}>
          {t("result.backToLobby")}
        </Button>
      </div>
    </Modal>
  );
}
