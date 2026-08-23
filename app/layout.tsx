import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
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
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
