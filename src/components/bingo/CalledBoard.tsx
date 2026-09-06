// The full 75-number B·I·N·G·O board shown at the top of the game room. Every
// number 1–75 is laid out in its letter row; called numbers light up gold and
// the most recent call gets a ring — so players can see the whole draw at a
// glance (like the reference bingo apps).

const ROWS: { letter: string; start: number }[] = [
  { letter: "B", start: 1 },
  { letter: "I", start: 16 },
  { letter: "N", start: 31 },
  { letter: "G", start: 46 },
  { letter: "O", start: 61 },
];

export function CalledBoard({
  drawn,
  last,
}: {
  drawn: Set<number>;
  last: number | null;
}) {
  return (
    <div className="mb-2 rounded-xl border border-white/10 bg-bg-soft/60 p-1">
      <div className="flex flex-col gap-px">
        {ROWS.map((row) => (
          <div key={row.letter} className="flex items-center gap-0.5">
            <span className="w-3 shrink-0 text-center font-display text-[10px] font-extrabold text-neon-cyan">
              {row.letter}
            </span>
            <div
              className="grid flex-1 gap-px"
              style={{ gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }}
            >
              {Array.from({ length: 15 }, (_, i) => row.start + i).map((n) => {
                const called = drawn.has(n);
                const isLast = n === last;
                return (
                  <span
                    key={n}
                    className={[
                      "flex h-3 items-center justify-center rounded-[2px] text-[7px] font-bold leading-none tabular-nums transition-colors",
                      isLast
                        ? "bg-neon-gold text-bg ring-1 ring-white"
                        : called
                          ? "bg-neon-gold/90 text-bg"
                          : "bg-white/[0.03] text-ink-faint/60",
                    ].join(" ")}
                  >
                    {n}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
