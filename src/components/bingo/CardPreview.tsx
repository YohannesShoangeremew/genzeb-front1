import { LETTERS } from "@/lib/constants";
import { getCard } from "@/lib/cards";

// Column accent per BINGO letter — a compact, legible palette for the mini
// preview (distinct from the live board so the two never read as the same UI).
const LETTER_TONE: Record<string, string> = {
  B: "bg-sky-500",
  I: "bg-rose-500",
  N: "bg-amber-500",
  G: "bg-violet-500",
  O: "bg-emerald-500",
};

/**
 * A compact, read-only preview of a fixed card (by id), rendered from the local
 * card table — no network. Used in the picker's "your cards" strip so a player
 * sees exactly the grid they're buying before they join.
 */
export function CardPreview({ id, onRemove }: { id: number; onRemove?: () => void }) {
  const card = getCard(id);
  if (!card) return null;
  const flat = card.numbers.flat();

  return (
    <div className="w-28 shrink-0 rounded-xl bg-bg-card p-1.5 ring-1 ring-white/10">
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <span className="font-display text-xs font-bold text-ink">#{id}</span>
        {onRemove && (
          <button
            onClick={onRemove}
            aria-label="Remove card"
            className="grid size-4 place-items-center rounded-full bg-white/10 text-[10px] leading-none text-ink-muted transition-colors hover:bg-neon-red/30 hover:text-neon-red"
          >
            ✕
          </button>
        )}
      </div>
      <div className="grid grid-cols-5 gap-1">
        {LETTERS.map((l) => (
          <div
            key={l}
            className={`rounded-md ${LETTER_TONE[l]} py-0.5 text-center text-[11px] font-extrabold text-white`}
          >
            {l}
          </div>
        ))}
        {flat.map((n, i) => (
          <div
            key={i}
            className={[
              "rounded-md py-1 text-center text-[10px] font-semibold tabular-nums",
              n === 0 ? "bg-neon-gold/25 text-neon-gold" : "bg-white/[0.04] text-ink-muted",
            ].join(" ")}
          >
            {n === 0 ? "★" : n}
          </div>
        ))}
      </div>
    </div>
  );
}
