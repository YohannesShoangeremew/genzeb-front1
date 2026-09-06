import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#f4f6f8",
        panel: "#ffffff",
        panel2: "#f7f8fa",
        panel3: "#edf1f3",
        edge: "#d7dce2",
        edgeSoft: "#e8ebef",
        brand: "#0f766e",
        brandDark: "#115e59",
        success: "#15803d",
        danger: "#c2413b",
        warning: "#a16207",
        info: "#2563eb",
        txt: "#17212f",
        "txt-2": "#455265",
        "txt-3": "#6d7888",
        "txt-4": "#98a1ad",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 1px 2px rgba(15, 23, 42, 0.08), 0 8px 22px rgba(15, 118, 110, 0.12)",
        panel: "0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 20px rgba(15, 23, 42, 0.04)",
      },
    },
  },
  plugins: [],
} satisfies Config;
