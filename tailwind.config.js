/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.{ejs,html}",
    "./public/**/*.{js,html}",
    "./routes/**/*.{js}",
    "./**/*.{js,ejs,html}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
