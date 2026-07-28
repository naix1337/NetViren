import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#0A0B0E',
        surface: '#111316',
        elevated: '#181B20',
        inset: '#0D0F12',
        hover: '#1F232A',
        'border-default': '#1E2128',
        'border-hover': '#2A2E38',
        'border-active': '#22D3EE',
        'text-primary': '#EDEEF0',
        'text-secondary': '#8B8F9B',
        'text-muted': '#5A5E6A',
        'accent-cyan': '#22D3EE',
        'accent-emerald': '#34D399',
        'accent-violet': '#A78BFA',
        'accent-amber': '#FBBF24',
        'accent-red': '#F87171',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: { xl: '12px', '2xl': '16px' },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
