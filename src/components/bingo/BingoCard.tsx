import { motion } from "framer-motion";
import { LETTERS } from "@/lib/constants";
import { CENTER } from "@/lib/bingo";
import type { BingoCard as Card } from "@/types/api";

interface Props {
  card: Card;
  /** Positions (0-24) the player has daubed. */
  daubed?: Set<number>;
  /** Numbers that have been drawn. */
  drawn?: Set<number>;
  /**
   * Tint called-but-unmarked cells as a hint. OFF by default. In live play the
   * app auto-marks every called number, so a card never has called-but-unmarked
   * cells; this is used (true) only for the read-only winner-card review, where
   * showing which numbers were called aids verifying the win.
   */
  showCalled?: boolean;
  /** Winning line positions to spotlight. */
  winLine?: number[] | null;
  /** Tap handler for daubing. Omit for read-only / auto-marked cards. */
  onDaub?: (pos: number) => void;
  size?: "sm" | "lg";
}

export function BingoCardView({ card, daubed, drawn, showCalled = false, winLine, onDaub, size = "lg" }: Props) {
  const winSet = new Set(winLine ?? []);
  const flat = card.numbers.flat();

  return (
    <div className={size === "lg" ? "mx-auto w-full max-w-[9.5rem]" : "w-44"}>
      <div className="mb-0.5 grid grid-cols-5 gap-0.5">
        {LETTERS.map((l, i) => (
          <div
            key={l}
            className="rounded-md bg-bg-elevated py-0.5 text-center font-display text-[10px] font-extrabold leading-none text-white"
            style={{ opacity: 0.9 + i * 0.02 }}
          >
            {l}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-0.5">
        {flat.map((num, pos) => {
          const isCenter = pos === CENTER;
          const isDaubed = isCenter || daubed?.has(pos);
          const inWin = winSet.has(pos);
          // Only hint called-but-unmarked cells when explicitly enabled.
          const calledHint =
            showCalled && !isCenter && !isDaubed && !inWin && (drawn?.has(num) ?? false);
          const tappable = !!onDaub && !isCenter;

          return (
            <motion.button
              key={pos}
              disabled={!tappable}
              onClick={() => tappable && onDaub?.(pos)}
              whileTap={tappable ? { scale: 0.88 } : undefined}
              animate={inWin ? { scale: [1, 1.12, 1] } : {}}
              transition={inWin ? { repeat: Infinity, duration: 1 } : {}}
              className={[
                "relative flex aspect-square items-center justify-center rounded-md font-display font-bold",
                size === "lg" ? "text-[11px]" : "text-xs",
                isCenter
                  ? "bg-grad-gold text-bg"
                  : inWin
                    ? "bg-neon-green text-bg shadow-glow-cyan"
                    : isDaubed
                      ? "bg-grad-cyan text-white"
                      : calledHint
                        ? "bg-neon-blue/25 text-ink ring-1 ring-neon-blue/60"
                        : "bg-white/5 text-ink-muted",
              ].join(" ")}
            >
              {isCenter ? (size === "lg" ? "★" : "★") : num}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
