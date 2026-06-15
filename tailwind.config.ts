import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream:       '#FAF7F2',
        'cream-dark':'#F2EDE4',
        sage: {
          DEFAULT: '#7A9E8E',
          light:   '#A8C5B5',
          dark:    '#5A7D6E',
        },
        rose: {
          DEFAULT: '#D4897A',
          light:   '#E8B4A8',
          dark:    '#B86A5A',
        },
        charcoal: {
          DEFAULT: '#2C2C2C',
          mid:     '#4A4A4A',
        },
        muted: '#8A8A8A',
        border: '#E8E2D8',
      },
      fontFamily: {
        serif: ['var(--font-lora)', 'Georgia', 'serif'],
        sans:  ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.75rem',
      },
      boxShadow: {
        soft: '0 4px 12px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.05)',
        card: '0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)',
      },
    },
  },
  plugins: [],
}
export default config
