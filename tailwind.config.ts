import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        comic: {
          teal: '#2E7D6E',
          'teal-dark': '#236357',
          'teal-light': '#3B9886',
          yellow: '#F6C945',
          'yellow-light': '#FFE17D',
          navy: '#2A4FCB',
          'navy-dark': '#1E3DA6',
          cream: '#F7F2E6',
          'cream-card': '#FAF7F0',
          dark: '#1A1A1A',
          gray: '#8C8C8C',
          'gray-light': '#E8E3D7',
          coral: '#E96379',
          orange: '#F07850',
          purple: '#9086F4',
          pink: '#FF7BB0',
        },
        bg: {
          base: '#F7F2E6',
          surface: '#FFFFFF',
          'surface-raised': '#FAF7F0',
        },
        border: {
          subtle: '#D9D3C5',
          comic: '#1A1A1A',
        },
        text: {
          primary: '#1A1A1A',
          secondary: '#7A756D',
          disabled: '#A6A095',
        },
        accent: {
          primary: '#2E7D6E',
          yellow: '#F6C945',
          navy: '#2A4FCB',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Nunito', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        comic: '3px 3px 0px #1A1A1A',
        'comic-sm': '2px 2px 0px #1A1A1A',
        'comic-lg': '4px 4px 0px #1A1A1A',
        'comic-teal': '0 4px 0px #1B4B42',
        'comic-yellow': '0 4px 0px #B89222',
        'comic-card': '0 6px 16px rgba(0, 0, 0, 0.07)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      aspectRatio: {
        '2/3': '2 / 3',
      },
    },
  },
  plugins: [],
};

export default config;
