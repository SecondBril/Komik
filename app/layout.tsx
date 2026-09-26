import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SecretEightClickListener } from '@/components/mature/SecretEightClickListener';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Plus_Jakarta_Sans, Nunito } from 'next/font/google';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-plus-jakarta',
});

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-nunito',
});

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
    <html lang="id" className={`dark ${plusJakartaSans.variable} ${nunito.variable}`}>
      <head>
        {/* Preconnect to external image CDNs for ultra-fast LCP */}
        <link rel="preconnect" href="https://storage.westmanga.blog" />
        <link rel="preconnect" href="https://ik.imagekit.io" />
        <link rel="dns-prefetch" href="https://storage.westmanga.blog" />
        <link rel="dns-prefetch" href="https://ik.imagekit.io" />
      </head>
      <body className="bg-[#0F1115] text-[#F2F3F5] antialiased selection:bg-[#7C5CFC]/30 selection:text-white min-h-screen flex flex-col font-sans">
        <SecretEightClickListener />
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
