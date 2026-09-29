import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  applicationName: 'QMaps',
  title: 'QMaps — Intelligent Route Optimization & Dispatch',
  description: 'Quantum-inspired vehicle routing, delivery dispatch, and benchmark research for Navi Mumbai.',
  icons: { icon: [{ url: '/qmaps-route-mark.svg', type: 'image/svg+xml' }] },
  openGraph: {
    title: 'QMaps — Intelligent Route Optimization & Dispatch',
    description: 'Quantum-inspired vehicle routing, delivery dispatch, and benchmark research for Navi Mumbai.',
    siteName: 'QMaps',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-sand-100 text-olive-950 flex flex-col">
        {children}
      </body>
    </html>
  );
}
