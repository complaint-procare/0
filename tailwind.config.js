/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(30 8% 90%)',
        background: 'hsl(40 12% 95%)',
        foreground: 'hsl(0 0% 9%)',
        muted: 'hsl(40 10% 93%)',
        'muted-foreground': 'hsl(0 0% 45%)',
        surface: 'hsl(0 0% 100%)',
        'surface-2': 'hsl(40 10% 96%)',
        sidebar: 'hsl(0 0% 100%)',
        primary: 'hsl(0 0% 8%)',
        'primary-foreground': 'hsl(0 0% 100%)',
        accent: 'hsl(40 10% 93%)',
        'accent-foreground': 'hsl(0 0% 9%)',
        destructive: 'hsl(355 70% 55%)',
        'destructive-foreground': 'hsl(0 0% 100%)',
        success: 'hsl(150 55% 38%)',
        'success-foreground': 'hsl(0 0% 100%)',
        warning: 'hsl(36 90% 50%)',
        'warning-foreground': 'hsl(0 0% 100%)',
        'pill-good-bg': 'hsl(150 55% 92%)',
        'pill-good-fg': 'hsl(150 55% 26%)',
        'pill-warn-bg': 'hsl(40 95% 90%)',
        'pill-warn-fg': 'hsl(30 70% 32%)',
        'pill-bad-bg': 'hsl(8 75% 94%)',
        'pill-bad-fg': 'hsl(8 65% 42%)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.03)',
        'card-lg': '0 2px 6px -1px rgb(0 0 0 / 0.06), 0 4px 14px -2px rgb(0 0 0 / 0.05)',
      },
    },
  },
  plugins: [],
}
