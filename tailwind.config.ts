import type { Config } from "tailwindcss";

// Neon / gradient dark theme — bold and premium to stand out from competitor
// bingo apps. Colors are exposed as CSS-var friendly tokens.
export default {
  // Apply hover: styles only on devices that truly hover (mouse/trackpad).
  // Without this, mobile browsers keep a tapped element in :hover until the
  // next touch — e.g. an unselected card kept its hover ring, looking still
  // half-selected.
  future: { hoverOnlyWhenSupported: true },
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep navy-blue theme (EDL design). Body → tiles → raised surfaces.
        bg: {
          DEFAULT: "#0a1526",
          soft: "#0f2038",
          card: "#14273f",
          elevated: "#1c3355",
        },
        // Single brand accent (DESIGN.md). Used sparingly: primary CTAs and
        // active states only. Press = active, faded = disabled. A deep cyan so
        // white text stays readable; the bright neon.cyan is for glows only.
        accent: {
          DEFAULT: "#0e7490",
          active: "#155e75",
          disabled: "#334a63",
        },
        neon: {
          purple: "#a855f7",
          blue: "#3b82f6",
          pink: "#ec4899",
          cyan: "#22d3ee",
          green: "#34d399",
          gold: "#fbbf24",
          red: "#f87171",
        },
        ink: {
          DEFAULT: "#eef3ff",
          muted: "#93a4c4",
          faint: "#5a6d8f",
        },
      },
      fontFamily: {
        display: ["'Baloo 2'", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px -4px rgba(168,85,247,0.6)",
        "glow-cyan": "0 0 24px -4px rgba(34,211,238,0.6)",
        "glow-gold": "0 0 28px -2px rgba(251,191,36,0.7)",
        // Airbnb caps elevation at one soft tier (DESIGN.md) — used on raised
        // cards/menus, never on buttons (those stay flat).
        soft: "rgba(0,0,0,0.04) 0 0 0 1px, rgba(0,0,0,0.12) 0 2px 6px, rgba(0,0,0,0.18) 0 4px 8px",
      },
      backgroundImage: {
        "grad-purple": "linear-gradient(135deg,#a855f7 0%,#ec4899 100%)",
        // Primary brand accent — cyan → blue (no purple, per client).
        "grad-cyan": "linear-gradient(135deg,#22d3ee 0%,#3b82f6 100%)",
        "grad-gold": "linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%)",
        "grad-dark": "radial-gradient(1200px 600px at 50% -10%,#16305a 0%,#0a1526 60%)",
      },
      keyframes: {
        "ball-pop": {
          "0%": { transform: "scale(0.4) rotate(-20deg)", opacity: "0" },
          "60%": { transform: "scale(1.15) rotate(6deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        "pulse-ring": {
          "0%,100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "ball-pop": "ball-pop 0.5s cubic-bezier(0.18,0.89,0.32,1.28)",
        "pulse-ring": "pulse-ring 1.5s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
