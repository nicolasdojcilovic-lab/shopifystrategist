/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode pour détecter les problèmes potentiels
  reactStrictMode: true,

  // TypeScript strict checking
  typescript: {
    // Ne pas ignorer les erreurs TypeScript en production
    ignoreBuildErrors: false,
  },

  // ESLint strict checking
  eslint: {
    // Ne pas ignorer les erreurs ESLint en production
    ignoreDuringBuilds: false,
  },

  // Output standalone pour déploiement optimisé
  output: 'standalone',

};

export default nextConfig;
