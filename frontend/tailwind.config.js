/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sand: {
          50: '#fcfaf5',
          100: '#f5f0e4',
          200: '#e9dfca',
          300: '#d8c9a9',
          400: '#bea980',
          500: '#a48c61',
          600: '#88734e',
          700: '#6d5b40',
          800: '#504430',
          900: '#332b20',
        },
        olive: {
          50: '#f3f5ed',
          100: '#e7ebd9',
          200: '#d0d8b7',
          300: '#b5c291',
          400: '#96a66c',
          500: '#798b4e',
          600: '#63743d',
          700: '#4e5e31',
          800: '#3d4a28',
          900: '#303a21',
          950: '#202817',
        },
        brand: {
          50: '#f3f5ed',
          100: '#e7ebd9',
          200: '#d0d8b7',
          300: '#b5c291',
          400: '#96a66c',
          500: '#798b4e',
          600: '#63743d',
          700: '#4e5e31',
          800: '#3d4a28',
          900: '#303a21',
          950: '#202817',
        },
        quantum: {
          teal: '#06b6d4',
          cyan: '#22d3ee',
          purple: '#8b5cf6',
          violet: '#7c3aed',
          navy: '#0f172a',
        }
      },
    },
  },
  plugins: [],
};
