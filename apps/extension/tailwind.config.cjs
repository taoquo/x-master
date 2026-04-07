/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx,js,jsx,html}"],
  theme: {
    extend: {
      colors: {
        surface: "#f7f2e9",
        ink: "#161412",
        mist: "#edf3ee",
        cobalt: "#3b82f6",
        sand: "#e8d7b2"
      },
      boxShadow: {
        glass: "0 24px 60px -28px rgba(44, 55, 72, 0.22), inset 0 1px 0 rgba(255,255,255,0.62)",
        soft: "0 18px 44px -26px rgba(28, 36, 51, 0.16)"
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem"
      },
      fontFamily: {
        sans: ['"Geist"', '"Avenir Next"', '"Segoe UI"', "sans-serif"],
        display: ['"Iowan Old Style"', '"Palatino Linotype"', "Georgia", "serif"],
        mono: ['"Geist Mono"', '"IBM Plex Mono"', '"SFMono-Regular"', "monospace"]
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
