import type { Metadata } from 'next';
import { Inter, Montserrat, Poppins, Roboto, Bebas_Neue, Oswald } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-montserrat',
  display: 'swap',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-poppins',
  display: 'swap',
});

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-roboto',
  display: 'swap',
});

const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-bebas-neue',
  display: 'swap',
});

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-oswald',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'YouTube Viral Clipper',
  description:
    'Instantly transcribe any YouTube video with language selection and analyze viral clips. Powered by youtube-transcript-plus.',
  keywords: ['youtube transcript', 'video transcription', 'caption extractor', 'subtitle generator', 'ai analysis', 'viral clips'],
  openGraph: {
    title: 'YouTube Viral Clipper',
    description: 'Instantly transcribe any YouTube video with language selection and analyze viral clips.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${montserrat.variable} ${poppins.variable} ${roboto.variable} ${bebasNeue.variable} ${oswald.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
