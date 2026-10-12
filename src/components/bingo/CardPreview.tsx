import { LETTERS } from "@/lib/constants";
import { getCard } from "@/lib/cards";

const LETTER_TONE: Record<string, string> = {
  B: "bg-sky-500",
  I: "bg-rose-500",
  N: "bg-amber-500",
  G: "bg-violet-500",
  O: "bg-emerald-500",
};

export function CardPreview({ id, onRemove }: { id: number; onRemove?: () => void }) {
  const card = getCard(id);
  if (!card) return null;
  const flat = card.numbers.flat();

  return (
    <div className="w-20 shrink-0 rounded-xl bg-bg-card p-1 ring-1 ring-white/10">
      <div className="mb-1 flex items-center justify-between px-0.5">
        <span className="font-display text-[10px] font-bold text-ink">#{id}</span>
        {onRemove && (
          <button
            onClick={onRemove}
            aria-label="Remove card"
            className="grid size-3.5 place-items-center rounded-full bg-white/10 text-[9px] leading-none text-ink-muted transition-colors hover:bg-neon-red/30 hover:text-neon-red"
          >
            ✕
          </button>
        )}
      </div>
      <div className="grid grid-cols-5 gap-0.5">
        {LETTERS.map((l) => (
          <div
            key={l}
            className={`rounded ${LETTER_TONE[l]} py-0.2 text-center text-[9px] font-extrabold text-white`}
          >
            {l}
          </div>
        ))}
        {flat.map((n, i) => (
          <div
            key={i}
            className={[
              "rounded py-0.5 text-center text-[8px] font-semibold tabular-nums",
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