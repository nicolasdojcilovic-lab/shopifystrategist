import type { Metadata } from 'next';
import './globals.css';

/**
 * Application metadata (SEO)
 */
export const metadata: Metadata = {
  title: 'ShopifyStrategist',
  description: 'Agency-grade PDP audit & battlecard generator',
};

/**
 * Root Layout (App Router)
 *
 * Next.js application root layout.
 * Aligns with SSOT structure defined in /docs.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
