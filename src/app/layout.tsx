import type { Metadata } from 'next';
import '@fontsource/geist-sans/latin.css';
import '@fontsource/geist-mono/latin.css';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.BETTER_AUTH_URL || 'https://hkgpipi.com'),
  title: { default: 'HKGpipi — AWS Cloud Margin Recovery', template: '%s | HKGpipi' },
  description:
    'Reduce AWS cloud waste through validated engineering changes, customer-controlled deployment and bill-based savings verification.',
  icons: { icon: '/favicon.png' },
  openGraph: {
    title: 'HKGpipi — AWS Cloud Margin Recovery',
    description: 'Find the waste. Make the approved change. Verify the saving.',
    type: 'website',
  },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
