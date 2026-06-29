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
        brand: {
          50:  "#e6f1fb",
          100: "#b5d4f4",
          500: "#185FA5",
          600: "#0c447c",
          900: "#042c53",
        },
      },
    },
  },
  plugins: [],
};
export default config;
