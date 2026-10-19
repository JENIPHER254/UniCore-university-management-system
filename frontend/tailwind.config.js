/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eef4fb",
          100: "#d8e5f4",
          200: "#b3cbe9",
          300: "#84a9db",
          400: "#5485ca",
          500: "#2c5f9e",
          600: "#1e4675",
          700: "#16355a",
          800: "#122846",
          900: "#0d1c32",
        },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(16 24 40 / 0.06), 0 1px 3px 0 rgb(16 24 40 / 0.08)",
      },
    },
  },
  plugins: [],
};
