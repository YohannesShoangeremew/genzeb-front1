interface Props {
  seconds: number;
  total: number;
  label?: string;
}

/** Circular countdown indicator. */
export function CountdownRing({ seconds, total, label }: Props) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.max(0, Math.min(1, seconds / total)) : 0;
  return (
    <div className="relative flex size-16 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="#fbbf24"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <div className="text-center">
        <div className="font-display text-xl font-extrabold leading-none text-neon-gold">
          {seconds}
        </div>
        {label && <div className="text-[8px] text-ink-faint">{label}</div>}
      </div>
    </div>
  );
}
