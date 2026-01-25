import type { Metadata } from 'next';
import './globals.css';

/**
 * Metadata pour l'application (SEO)
 */
export const metadata: Metadata = {
  title: 'ShopifyStrategist',
  description: 'Agency-grade PDP audit & battlecard generator',
};

/**
 * Root Layout (App Router)
 * 
 * Layout racine de l'application Next.js.
 * Respecte la structure SSOT définie dans /docs.
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
