import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        "surface-muted": "var(--surface-muted)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          dark: "var(--primary-dark)",
          soft: "var(--primary-soft)",
        },
        success: {
          DEFAULT: "var(--success)",
          soft: "var(--success-soft)",
        },
        error: {
          DEFAULT: "var(--error)",
          soft: "var(--error-soft)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          soft: "var(--warning-soft)",
        },
        info: {
          DEFAULT: "var(--info)",
          soft: "var(--info-soft)",
        },
        dcnet: {
          background: "var(--background)",
          surface: "var(--surface)",
          "surface-muted": "var(--surface-muted)",
          border: "var(--border)",
          "border-strong": "var(--border-strong)",
          900: "var(--text-primary)",
          text: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          primary: "var(--primary)",
          "primary-dark": "var(--primary-dark)",
          "primary-soft": "var(--primary-soft)",
          accent: "var(--primary)",
          "accent-dark": "var(--primary-dark)",
          soft: "var(--primary-soft)",
          success: "var(--success)",
          "success-soft": "var(--success-soft)",
          error: "var(--error)",
          "error-soft": "var(--error-soft)",
          warning: "var(--warning)",
          "warning-soft": "var(--warning-soft)",
          info: "var(--info)",
          "info-soft": "var(--info-soft)",
          nav: "var(--nav-background)",
          "nav-text": "var(--nav-text)",
          "nav-border": "var(--nav-border)",
          topbar: "var(--topbar-bg)",
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
      boxShadow: {
        "xp-card": "var(--shadow-sm)",
        "xp-card-strong": "var(--shadow-md)",
        "xp-nav": "0 1px 3px 0 rgb(15 23 42 / 0.06)",
        "xp-xs": "var(--shadow-xs)",
      },
    },
  },
  plugins: [],
} satisfies Config;
