import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        lavender: '#EFF0FB',
        mint: '#D2FAFA',
        aqua: '#9FE4EC',
        mutedSlate: '#8182A4',
        slateDark: '#343653',
        lilac: '#CBA2D6',
        pink: '#FCE3EC',
      },
    },
  },
  plugins: [],
} satisfies Config;
