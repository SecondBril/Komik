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
        bg: {
          base: '#0F1115',
          surface: '#171A21',
          'surface-raised': '#1F232C',
        },
        border: {
          subtle: '#2A2F3A',
        },
        text: {
          primary: '#F2F3F5',
          secondary: '#9AA0AC',
          disabled: '#5B616D',
        },
        accent: {
          primary: '#7C5CFC',
          hover: '#6A47F0',
        },
        status: {
          ongoing: '#3DDC84',
          completed: '#5B8DEF',
          error: '#F0554A',
        },
        type: {
          manga: '#5B8DEF',
          manhwa: '#7C5CFC',
          manhua: '#F0A64E',
        },
        reader: {
          bg: '#0B0C0F',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      aspectRatio: {
        '2/3': '2 / 3',
      },
      animation: {
        'shimmer': 'shimmer 1.5s infinite linear',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
