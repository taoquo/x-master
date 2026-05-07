/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx,js,jsx,html}"],
  theme: {
    extend: {
      colors: {
        surface: "#FBF7F3",
        ink: "#191514",
        mist: "#F3EBE4",
        brand: "#B83D2E",
        sand: "#E9DED4"
      },
      boxShadow: {
        glass: "0 18px 36px -28px rgba(58, 49, 45, 0.22), inset 0 1px 0 rgba(255,253,249,0.72)",
        soft: "0 14px 28px -24px rgba(58, 49, 45, 0.18)"
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem"
      },
      fontFamily: {
        sans: ['"SF Pro Text"', '"PingFang SC"', '"Noto Sans SC"', '"Segoe UI"', "sans-serif"],
        display: ['"Iowan Old Style"', '"Palatino Linotype"', '"Source Han Serif SC"', "Georgia", "serif"],
        mono: ['"SFMono-Regular"', '"JetBrains Mono"', '"IBM Plex Mono"', "monospace"]
      },
      animation: {
        "glass-shimmer": "glass-shimmer 7s linear infinite",
        "soft-pulse": "soft-pulse 2.6s ease-in-out infinite",
        "float-card": "float-card 6s ease-in-out infinite"
      },
      keyframes: {
        "glass-shimmer": {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" }
        },
        "soft-pulse": {
          "0%, 100%": { transform: "scale(0.92)", opacity: "0.42" },
          "50%": { transform: "scale(1)", opacity: "1" }
        },
        "float-card": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-4px)" }
        }
      }
    }
  },
  plugins: []
}
