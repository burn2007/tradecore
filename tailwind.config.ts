import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Dusk Design Language ──────────────────────────────────────────
        // Page backgrounds
        bg: "var(--color-bg)",           // #111827
        surface: "var(--color-surface)", // #0F1623
        deep: "var(--color-deep)",       // #0A0F1A  (sidebar, topbar)

        // Borders
        border: {
          DEFAULT: "var(--color-border)",       // #1A2640
          subtle: "var(--color-border-subtle)", // #0F1A2A
        },

        // Accent palette
        gold: "var(--color-gold)",   // #E2B96F  phantom P&L, discipline, best perf
        jade: "var(--color-jade)",   // #50E3B8  profitable, passed rules, positive
        rose: "var(--color-rose)",   // #F07C7C  losing, broken rules, negative
        ice: "var(--color-ice)",     // #8BA8C4  neutral stats (win rate, count)

        // Card base
        card: "#111C2E",

        // Text scale (use as text-primary, text-secondary, text-muted)
        primary: "var(--color-text-primary)",     // #C9C2AE
        secondary: "var(--color-text-secondary)", // #6B8AAA
        muted: "var(--color-text-muted)",         // #2E4060
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "DM Sans", "sans-serif"],
      },
      borderRadius: {
        card: "11px",
      },
      height: {
        topbar: "var(--topbar-height)", // 50px
      },
      width: {
        sidebar: "var(--sidebar-width)", // 52px
      },
      minWidth: {
        sidebar: "var(--sidebar-width)",
      },
    },
  },
  plugins: [],
};

export default config;
