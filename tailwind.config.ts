import type { Config } from "tailwindcss";

/**
 * Tailwind CSS Configuration
 *
 * This configuration centralizes all theme colors for the mini app.
 * To change the app's color scheme, simply update the 'primary' color value below.
 *
 * Example theme changes:
 * - Blue theme: primary: "#3182CE"
 * - Green theme: "#059669"
 * - Red theme: primary: "#DC2626"
 * - Orange theme: primary: "#EA580C"
 */
export default {
  darkMode: "media",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Enhanced premium trading app color scheme
        primary: "#0EA5E9", // Sky blue
        "primary-light": "#38BDF8", // Light sky blue
        "primary-dark": "#0369A1", // Dark sky blue

        // Accent colors for different signal types
        accent: {
          buy: "#10B981", // Emerald green
          sell: "#EF4444", // Red
          hold: "#F59E0B", // Amber
          neutral: "#6B7280", // Gray
        },

        // Enhanced background gradients
        background: {
          primary: "#0A0A0F", // Deep space black
          secondary: "#111827", // Dark slate
          tertiary: "#1F2937", // Lighter slate
          card: "rgba(17, 24, 39, 0.8)", // Semi-transparent card
        },

        // Text colors
        text: {
          primary: "#F9FAFB", // Almost white
          secondary: "#D1D5DB", // Light gray
          muted: "#9CA3AF", // Muted gray
          accent: "#60A5FA", // Blue accent
        },

        // Border colors
        border: {
          primary: "rgba(59, 130, 246, 0.3)", // Blue border
          secondary: "rgba(156, 163, 175, 0.2)", // Gray border
          accent: "rgba(16, 185, 129, 0.3)", // Green border
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // Custom spacing for consistent layout
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
      },
      // Custom container sizes
      maxWidth: {
        xs: "20rem",
        sm: "24rem",
        md: "28rem",
        lg: "32rem",
        xl: "36rem",
        "2xl": "42rem",
      },
      // Enhanced animations
      animation: {
        "fade-in-up": "fadeInUp 0.6s ease-out",
        "fade-in-down": "fadeInDown 0.6s ease-out",
        "slide-in-right": "slideInRight 0.5s ease-out",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeInDown: {
          "0%": { opacity: "0", transform: "translateY(-20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(14, 165, 233, 0.3)" },
          "50%": { boxShadow: "0 0 30px rgba(14, 165, 233, 0.6)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
