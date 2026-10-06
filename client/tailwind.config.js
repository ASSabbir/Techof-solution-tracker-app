const c = (v) => `rgb(var(--${v}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}', './lib/**/*.{js,jsx}', './hooks/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: c('bg'), surface: c('surface'), 'surface-2': c('surface-2'), line: c('line'),
        ink: c('ink'), muted: c('muted'), accent: c('accent'), 'accent-2': c('accent-2'),
        success: c('success'), warning: c('warning'), danger: c('danger'), info: c('info'),
      },
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgb(0 0 0 / 0.05), 0 12px 32px -12px rgb(0 0 0 / 0.25)',
        glow: '0 0 0 1px rgb(var(--accent) / 0.45), 0 12px 40px -12px rgb(var(--accent) / 0.55)',
      },
      opacity: { 8: '0.08', 12: '0.12' },
      borderRadius: { '2xl': '1.1rem', '3xl': '1.5rem' },
    },
  },
  plugins: [],
};
