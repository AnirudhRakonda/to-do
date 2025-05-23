/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors:{
        bg:'#06090F',
        accent:'#90B0D5',
        box :'#C76B9D',
        text :'#EBF1F7'
      }
    },
  },
  plugins: [],
}