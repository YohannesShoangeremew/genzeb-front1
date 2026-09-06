import { AnimatePresence, motion } from "framer-motion";
import { letterForNumber } from "@/lib/bingo";

const LETTER_COLOR: Record<string, string> = {
  B: "from-neon-cyan to-blue-500",
  I: "from-neon-blue to-blue-600",
  N: "from-neon-pink to-rose-500",
  G: "from-neon-green to-emerald-500",
  O: "from-neon-gold to-amber-500",
};

/**
 * The big animated "ball" showing the current called number.
 *
 * Before the first call of a round there is a deliberate ~5s gap (the server
 * waits so a client still connecting cannot miss a number). `countdown` fills
 * it: rather than an idle ball that makes the game look hung, the seconds tick
 * down in the same spot and the first real number simply takes over.
 */
export function BallCallout({
  number,
  countdown = 0,
}: {
  number: number | null;
  /** Seconds until the first call; 0 when not waiting. */
  countdown?: number;
}) {
  const letter = number ? letterForNumber(number) : "";
  const waiting = !number && countdown > 0;
  return (
    <div className="flex size-14 shrink-0 items-center justify-center">
      <AnimatePresence mode="popLayout">
        {number ? (
          <motion.div
            key={number}
            initial={{ scale: 0.3, rotate: -25, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: "spring", damping: 12, stiffness: 280 }}
            className={`relative flex size-14 flex-col items-center justify-center rounded-full bg-gradient-to-br ${LETTER_COLOR[letter] ?? "from-neon-cyan to-neon-blue"}`}
          >
            <span className="absolute inset-1 rounded-full ring-2 ring-white/30" />
            <span className="font-display text-[10px] font-bold leading-none text-white/90">{letter}</span>
            <span className="font-display text-xl font-extrabold leading-none text-white">
              {number}
            </span>
          </motion.div>
        ) : waiting ? (
          // Keyed on the second so each tick re-animates — a number that pops
          // in place reads as a live count, where a silently changing digit
          // reads as a frozen screen, which is the impression being fixed.
          <motion.div
            key={`cd-${countdown}`}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.3, opacity: 0 }}
            transition={{ type: "spring", damping: 14, stiffness: 300 }}
            className="flex size-14 items-center justify-center rounded-full bg-white/5 ring-2 ring-neon-cyan/40"
          >
            <span className="font-display text-2xl font-extrabold leading-none text-neon-cyan">
              {countdown}
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            className="flex size-20 items-center justify-center rounded-full bg-white/5 text-3xl"
          >
            🎱
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
