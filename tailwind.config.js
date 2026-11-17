/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: '#F8F5EF',
        cream: '#EFE7DC',
        walnut: '#4B2818',
        wood: '#9B6339',
        espresso: '#241810',
        gold: '#B58A58',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: { luxe: '0.28em' },
      boxShadow: {
        soft: '0 10px 40px -18px rgba(36,24,16,0.28)',
        lift: '0 24px 60px -28px rgba(36,24,16,0.45)',
      },
    },
  },
  plugins: [],
};
