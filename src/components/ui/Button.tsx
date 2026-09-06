import { ButtonHTMLAttributes, forwardRef } from "react";
import { haptic } from "@/lib/telegram";
import { useSettings } from "@/store/settingsStore";

type Variant = "primary" | "gold" | "ghost" | "danger" | "cyan";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
}

// Button language per DESIGN.md (Claude): flat fills, no glow, 8px radius,
// modest 500-weight label, state changes carried by color (press = darker,
// disabled = faded). `accent` (coral) is the single accent, used sparingly —
// gold is kept only for the celebratory jackpot/BINGO win moment.
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-active active:bg-accent-active disabled:bg-accent-disabled",
  gold: "bg-grad-gold text-bg font-semibold hover:brightness-95 active:brightness-90",
  cyan: "bg-transparent text-ink border border-white/20 hover:bg-white/5 active:bg-white/10",
  ghost: "bg-transparent text-ink border border-white/15 hover:bg-white/5 active:bg-white/10",
  danger: "bg-transparent text-neon-red border border-neon-red/40 hover:bg-neon-red/10",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", loading, fullWidth, className = "", children, onClick, disabled, ...rest },
  ref,
) {
  const hapticsEnabled = useSettings((s) => s.hapticsEnabled);
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      onClick={(e) => {
        if (hapticsEnabled) haptic.impact("medium");
        onClick?.(e);
      }}
      className={[
        "relative inline-flex select-none items-center justify-center gap-2 rounded-lg px-5 py-3",
        "font-sans text-[15px] font-medium leading-none",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        VARIANTS[variant],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
      {...rest}
    >
      {loading ? <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : children}
    </button>
  );
});
