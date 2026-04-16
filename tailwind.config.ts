import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          50: "#effefb",
          100: "#c7fff3",
          200: "#90ffe7",
          300: "#51f7d8",
          400: "#1de4c3",
          500: "#05c8aa",
          600: "#00a28c",
          700: "#058171",
          800: "#0a665b",
          900: "#0d544c",
        },
        accent: {
          50: "#eef7ff",
          100: "#d9edff",
          200: "#bce0ff",
          300: "#8ecdff",
          400: "#59b0ff",
          500: "#3b8eff",
          600: "#1f6bf5",
          700: "#1a57e1",
          800: "#1c46b6",
          900: "#1c3d8f",
        },
        surface: {
          light: "#ffffff",
          DEFAULT: "#f4f7fa",
          dark: "#0f1729",
          "dark-alt": "#162032",
          "dark-card": "#1a2538",
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
      boxShadow: {
        glass: "0 4px 24px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.03)",
        "glass-lg": "0 8px 32px 0 rgba(0, 0, 0, 0.06), 0 2px 4px 0 rgba(0, 0, 0, 0.03)",
        "glass-hover": "0 8px 32px 0 rgba(5, 200, 170, 0.08), 0 2px 8px 0 rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [],
};
export default config;
