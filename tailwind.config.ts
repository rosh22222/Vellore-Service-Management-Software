import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "rgb(var(--color-primary) / <alpha-value>)",
          "primary-hover": "rgb(var(--color-primary-hover) / <alpha-value>)",
          deep: "rgb(var(--color-brand-deep) / <alpha-value>)",
          soft: "rgb(var(--color-primary-soft) / <alpha-value>)",
          faint: "rgb(var(--color-primary-faint) / <alpha-value>)",
          accent: "rgb(var(--color-accent) / <alpha-value>)",
          highlight: "oklch(var(--palette-violet) / <alpha-value>)",
          warm: "oklch(var(--palette-apricot) / <alpha-value>)",
          "warm-soft": "rgb(var(--color-warm-soft) / <alpha-value>)",
          "warm-ink": "rgb(var(--color-warm-ink) / <alpha-value>)",
          cool: "oklch(var(--palette-grey) / <alpha-value>)",
          "cool-ink": "rgb(var(--color-cool-ink) / <alpha-value>)",
          ice: "oklch(var(--palette-ice) / <alpha-value>)",
          sidebar: "rgb(var(--color-sidebar) / <alpha-value>)",
          "chart-violet": "rgb(var(--color-chart-violet) / <alpha-value>)",
          "chart-warm": "rgb(var(--color-chart-warm) / <alpha-value>)",
          "chart-cool": "rgb(var(--color-chart-cool) / <alpha-value>)",
          ink: "rgb(var(--color-ink) / <alpha-value>)",
          secondary: "rgb(var(--color-secondary) / <alpha-value>)",
          subtle: "rgb(var(--color-surface-muted) / <alpha-value>)",
          input: "rgb(var(--color-input-border) / <alpha-value>)",
          navy: "rgb(var(--color-primary) / <alpha-value>)",
          "navy-hover": "rgb(var(--color-primary-hover) / <alpha-value>)",
          sky: "rgb(var(--color-accent) / <alpha-value>)",
          background: "rgb(var(--color-paper) / <alpha-value>)",
          surface: "#FFFFFF",
          text: "rgb(var(--color-ink) / <alpha-value>)",
          muted: "rgb(var(--color-muted) / <alpha-value>)",
          border: "rgb(var(--color-line) / <alpha-value>)",
          success: "#16A34A",
          warning: "#F59E0B",
          danger: "#DC2626",
        },
      },
      boxShadow: {
        panel: "0 2px 5px rgba(43, 40, 55, 0.025), 0 10px 26px rgba(105, 66, 186, 0.035)",
      },
    },
  },
  plugins: [],
} satisfies Config;
