/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#F7F9FC",
        panel: "#FFFFFF",
        panelRaised: "#F9FAFB",
        line: "#E5EAF2",
        mute: "#64748B",
        paper: "#172033",
        accent: "#4F46E5",
        accentDim: "#EEF2FF",
        accentText: "#4338CA",
        warn: "#B45309",
        danger: "#B91C1C",
        ok: "#059669",
      },
      boxShadow: {
        card: "0 1px 2px rgba(23, 32, 51, 0.04), 0 8px 24px rgba(23, 32, 51, 0.04)",
      },
    },
  },
  plugins: [],
};
