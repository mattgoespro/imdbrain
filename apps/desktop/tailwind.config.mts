import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";
import typography from "@tailwindcss/typography";
import plugin from "tailwindcss/plugin";

const palette = {
  canvas: "#0e0e10",
  ink: "#f5f5f7",
  muted: "#9a9aa2",
  faint: "#6c6c74",
  line: "rgba(255, 255, 255, 0.08)",
  accent: "#CEAA34",
  accent2: "#FFD727",
  accentSoft: "rgba(255, 122, 60, 0.14)",
  accentInk: "#1a0c06",
  danger: "#E25E5A",
  dangerFg: "#f3c2ba",
  raised: "#17171b",
  rail: "#16161a",
  track: "#2c2c32",
  thumb: "#3f3f46",
  thumbActive: "#8A5F1E",
  input: "rgba(8, 8, 10, 0.55)",
  poster: "#1c1c24",
} as const;

const imdbrain = plugin(({ addUtilities }) => {
  addUtilities({
    ".app-drag": {
      "-webkit-app-region": "drag",
    },
    ".app-no-drag": {
      "-webkit-app-region": "no-drag",
    },
    ".scrollbar-none": {
      "scrollbar-width": "none",
      "&::-webkit-scrollbar": {
        display: "none",
        width: "0",
        height: "0",
      },
    },
  });
});

export default {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      screens: {
        inspect: "1181px",
      },
      colors: {
        canvas: palette.canvas,
        ink: palette.ink,
        muted: palette.muted,
        faint: palette.faint,
        line: palette.line,
        accent: {
          DEFAULT: palette.accent,
          2: palette.accent2,
          soft: palette.accentSoft,
          ink: palette.accentInk,
        },
        danger: {
          DEFAULT: palette.danger,
          fg: palette.dangerFg,
        },
        raised: palette.raised,
        rail: palette.rail,
        track: palette.track,
        thumb: palette.thumb,
        "thumb-active": palette.thumbActive,
        input: palette.input,
        poster: palette.poster,
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      fontWeight: {
        650: "650",
      },
      borderRadius: {
        app: "10px",
      },
      boxShadow: {
        panel: "0 12px 32px rgba(0, 0, 0, 0.38)",
        accent: "0 6px 16px rgba(255, 122, 60, 0.28)",
      },
      letterSpacing: {
        title: "-0.04em",
        tightish: "-0.02em",
        kicker: "0.18em",
      },
      transitionDuration: {
        140: "140ms",
        160: "160ms",
      },
      keyframes: {
        "result-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "none" },
        },
        fade: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        catalog: "spin 0.7s linear infinite",
        "result-in": "result-in 160ms ease both",
        fade: "fade 200ms ease",
      },
    },
  },
  plugins: [forms({ strategy: "class" }), typography, imdbrain],
} satisfies Config;
