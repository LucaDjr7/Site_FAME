import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        fame: {
          blue:      '#2f4486',
          'blue-dark': '#1d2b56',
          'blue-mid': '#1f2e5c',
          navy:      '#15203f',
          'navy-light': '#18244c',
          sand:      '#fbf9f3',
          'sand-bg': '#F9F9FA',
          'sand-sidebar': 'rgba(244,243,236,0.92)',
          ecru:      '#eceadf',
          slate:     '#5768ac',
          teal:      '#1e9b7e',
          gold:      '#e8b149',
          coral:     '#ff6f61',
          red:       '#c0473b',
          'text-light': '#eef3ff',
          'text-muted': '#7e95d6',
          'text-dim':   '#9fb2e6',
          'text-body':  '#2a3457',
          'text-dark':  '#15203f',
        },
      },
      fontFamily: {
        serif: ['"Roboto Slab"', 'Georgia', 'serif'],
        mono:  ['"IBM Plex Mono"', 'monospace'],
      },
      backgroundImage: {
        'fame-gradient': [
          'radial-gradient(110% 80% at 50% 12%, rgba(181,157,135,0.32) 0%, rgba(181,157,135,0) 52%)',
          'radial-gradient(120% 110% at 50% 116%, rgba(113,120,132,0.28) 0%, rgba(113,120,132,0) 60%)',
          'radial-gradient(140% 120% at 86% 48%, rgba(47,68,134,0.08) 0%, rgba(47,68,134,0) 55%)',
          '#F9F9FA',
        ].join(', '),
      },
    },
  },
  plugins: [],
}

export default config
