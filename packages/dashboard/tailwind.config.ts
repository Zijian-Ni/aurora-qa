import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        aurora: {
          bg: '#0a0a1a',
          purple: '#a277ff',
          cyan: '#00d9ff',
          green: '#61ffca',
          orange: '#ffca85',
          red: '#ff6767',
        },
      },
    },
  },
  plugins: [],
};

export default config;
