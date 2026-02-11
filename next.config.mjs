/** @type {import('next').NextConfig} */
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  output: "standalone",

  // Fix: évite que Next “remonte” au mauvais workspace root (ex: ~/)
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
