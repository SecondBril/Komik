import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KomikIndo — Baca Manga, Manhwa, Manhua Bahasa Indonesia Cepat & Tanpa Lag',
  description: 'Platform baca komik online Manga, Manhwa, dan Manhua terjemahan Bahasa Indonesia gratis. Desain mobile-first, loading cepat WebP, update chapter terbaru setiap hari.',
  keywords: ['baca komik', 'manga id', 'manhwa indonesia', 'manhua indo', 'baca manga', 'webtoon id', 'komik online'],
  authors: [{ name: 'KomikIndo Team' }],
  openGraph: {
    title: 'KomikIndo — Baca Manga, Manhwa, Manhua Bahasa Indonesia',
    description: 'Pengalaman baca komik tercepat di HP. Format WebP hemat data, update chapter otomatis.',
    type: 'website',
    locale: 'id_ID',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0F1115',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#0F1115] text-[#F2F3F5] antialiased selection:bg-[#7C5CFC]/30 selection:text-white min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
