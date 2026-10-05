import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Plus_Jakarta_Sans } from 'next/font/google';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plus-jakarta',
});

export const metadata: Metadata = {
  title: 'Chameleon Comics — Baca Manga, Manhwa, Manhua Bahasa Indonesia Cepat & Hemat Data',
  description: 'Platform baca komik online Manga, Manhwa, dan Manhua terjemahan Bahasa Indonesia gratis. Desain modern, loading cepat WebP, update chapter terbaru setiap hari.',
  keywords: ['baca komik', 'manga id', 'manhwa indonesia', 'manhua indo', 'baca manga', 'webtoon id', 'komik online'],
  authors: [{ name: 'Chameleon Comics Team' }],
  openGraph: {
    title: 'Chameleon Comics — Baca Manga, Manhwa, Manhua Bahasa Indonesia',
    description: 'Pengalaman baca komik tercepat di HP & Desktop. Format WebP hemat data, update chapter otomatis.',
    type: 'website',
    locale: 'id_ID',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#2E7D6E',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={plusJakartaSans.variable} suppressHydrationWarning>
      <head>
        {/* Preconnect to external image CDNs for ultra-fast LCP */}
        <link rel="preconnect" href="https://storage.westmanga.blog" />
        <link rel="preconnect" href="https://ik.imagekit.io" />
        <link rel="dns-prefetch" href="https://storage.westmanga.blog" />
        <link rel="dns-prefetch" href="https://ik.imagekit.io" />
        {/* Theme initialization script to prevent FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('chameleon_theme');
                  if (saved === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col font-sans transition-colors duration-200">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
