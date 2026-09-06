import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { BingoCardView } from "@/components/bingo/BingoCard";
import { api } from "@/lib/api";
import { winnerMarks } from "@/lib/bingo";
import { money } from "@/lib/format";
import type { BingoCard } from "@/types/api";

/** One co-winner listed on the split-pot result (name, share, and card). */
export interface CoWinner {
  name: string;
  prize: number;
  cardId?: number;
  marked?: number[];
}

/**
 * Shows the winner's card with the exact cells they marked, so every player in
 * the game can verify the win is legitimate after it ends. The card is fetched
 * by id; `marked` are the actual card NUMBERS the winner daubed (the WINNER
 * event payload), which we map back to board positions for highlighting. The
 * winning line is recomputed locally and spotlighted in green.
 *
 * When several cards completed on the same draw (`winners.length > 1`), every
 * co-winner is listed with their share of the pot; tapping a row switches the
 * displayed card so each win can be verified.
 */
export function WinnerCardModal({
  open,
  onClose,
  cardId,
  marked,
  drawn,
  winnerName,
  winners,
  closeLabel,
  youWon,
}: {
  open: boolean;
  onClose: () => void;
  cardId: number;
  marked: number[];
  /** All numbers called this game — for context (called-but-unmarked cells). */
  drawn?: Set<number>;
  winnerName: string;
  /** Every co-winner of a split pot — listed when there is more than one. */
  winners?: CoWinner[];
  /** Label for the single action button (defaults to a plain "Close"). */
  closeLabel?: string;
  /** When the viewer is the winner, the amount they won — shown as a banner. */
  youWon?: number;
}) {
  const { t } = useTranslation();
  const [card, setCard] = useState<BingoCard | null>(null);
  const [error, setError] = useState(false);

  // Which co-winner's card is on display. Defaults to the primary winner from
  // the props; tapping a listed co-winner (with a verifiable card) switches.
  const [sel, setSel] = useState<CoWinner | null>(null);
  const shownCardId = sel?.cardId ?? cardId;
  const shownMarked = sel?.marked ?? marked;
  const shownName = sel?.name ?? winnerName;
  const split = (winners?.length ?? 0) > 1;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCard(null);
    setError(false);
    api
      .card(shownCardId)
      .then((r) => !cancelled && setCard(r.card))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [open, shownCardId]);

  // Map the winner's marked numbers to board positions (0-24), then recompute
  // the winning line from those positions.
  const { daubed, winLine } = useMemo(() => {
    if (!card) return { daubed: new Set<number>(), winLine: null as number[] | null };
    const { positions, winLine } = winnerMarks(card, shownMarked);
    return { daubed: positions, winLine };
  }, [card, shownMarked]);

  return (
    <Modal open={open} onClose={onClose}>
      {/* Headline: the winner's NAME front and center (or the winner count
          when the pot split — the names are right below in the list). */}
      <h2 className="break-words font-display text-2xl font-extrabold">
        🏆{" "}
        {split
          ? t("result.winnersLabel", { n: winners!.length })
          : t("result.winnerHeadline", { name: shownName })}
      </h2>
      {/* Single winner: the winning card's number sits directly under the name,
          so the announcement says who won AND on which card. When the pot split
          this is omitted here — the number belongs on each co-winner's row
          below, since the headline is a count rather than one person. */}
      {!split && (
        <p className="mt-1.5 inline-block rounded-lg bg-neon-cyan/10 px-2.5 py-1 text-sm font-bold text-neon-cyan ring-1 ring-neon-cyan/30">
          {t("card.selectId", { id: shownCardId })}
        </p>
      )}
      {split && (
        <p className="mt-0.5 text-sm font-semibold text-neon-gold">
          {t("result.potSplit", { n: winners!.length })}
        </p>
      )}
      {split && (
        <div className="mt-2 flex flex-col gap-1.5">
          {winners!.map((w, i) => {
            const verifiable = typeof w.cardId === "number" && !!w.marked;
            const active = verifiable && w.cardId === shownCardId;
            return (
              <button
                key={`${w.cardId ?? "?"}-${i}`}
                disabled={!verifiable}
                onClick={() => setSel(w)}
                className={[
                  "flex items-center justify-between rounded-xl px-3 py-2 text-sm",
                  active
                    ? "bg-neon-cyan/10 ring-1 ring-neon-cyan"
                    : "bg-white/5 ring-1 ring-white/10",
                  verifiable ? "active:scale-[0.98]" : "opacity-70",
                ].join(" ")}
              >
                <span className="min-w-0 truncate font-semibold">
                  {w.name}
                  {typeof w.cardId === "number" && (
                    <span className="ml-1.5 font-normal text-ink-faint">
                      #{w.cardId}
                    </span>
                  )}
                </span>
                <span className="ml-3 shrink-0 font-bold text-neon-gold">
                  {money(w.prize)}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <p className={`${split ? "mt-2" : "mt-0.5"} text-sm text-ink-faint`}>
        {t("result.winnerCardSub", { name: shownName })}
        {/* On a split pot the grid below shows whichever co-winner is selected,
            so name the card here too — the single-winner badge above already
            covers the other case. */}
        {split && (
          <span className="ml-1 font-semibold text-neon-cyan">
            · {t("card.selectId", { id: shownCardId })}
          </span>
        )}
      </p>
      {youWon != null && youWon > 0 && (
        <p className="mt-2 text-lg font-bold text-neon-gold">
          {t("result.wonAmount", { amount: money(youWon) })}
        </p>
      )}

      <div className="mt-4">
        {error ? (
          <p className="py-8 text-sm text-neon-red">{t("result.cardLoadError")}</p>
        ) : !card ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <Spinner size={36} />
            <p className="text-sm text-ink-muted">{t("common.loading")}</p>
          </div>
        ) : (
          <>
            <BingoCardView card={card} daubed={daubed} drawn={drawn} showCalled winLine={winLine} />
            <div
              className={[
                "mt-3 rounded-xl px-3 py-2 text-sm font-semibold",
                winLine
                  ? "border border-neon-green/30 bg-neon-green/10 text-neon-green"
                  : "border border-neon-red/30 bg-neon-red/10 text-neon-red",
              ].join(" ")}
            >
              {winLine ? `✓ ${t("result.validLine")}` : `⚠ ${t("result.noLine")}`}
            </div>
          </>
        )}
      </div>

      <div className="mt-5">
        <Button variant="gold" fullWidth onClick={onClose}>
          {closeLabel ?? t("common.close")}
        </Button>
      </div>
    </Modal>
  );
}
