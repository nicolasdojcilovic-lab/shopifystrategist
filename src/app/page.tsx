'use client';

/**
 * Page d'accueil — Premium Dark
 *
 * Design minimaliste Stripe/Linear : fond sombre, typographie soignée.
 * Input URL Shopify + bouton "Lancer l'Audit", état de chargement, redirect /audit/[auditKey].
 */

import { useState, FormEvent } from 'react';

export default function HomePage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim() || loading) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || `Erreur ${res.status}`);
        setLoading(false);
        return;
      }

      if (data.auditKey) {
        window.location.href = `/audit/${encodeURIComponent(data.auditKey)}`;
        return;
      }

      setError('Réponse invalide (auditKey manquant)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xl">
        {/* Brand */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            ShopifyStrategist
          </h1>
          <p className="mt-2 text-[15px] text-zinc-400">
            Audit PDP agency-grade — capture, analyse, rapport
          </p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="url" className="sr-only">
              URL de la page produit Shopify
            </label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://exemple.myshopify.com/products/..."
              disabled={loading}
              className="w-full h-12 px-4 rounded-lg bg-zinc-900/80 border border-zinc-700/80 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition disabled:opacity-60"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="w-full h-12 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
          >
            {loading ? (
              <>
                <Spinner />
                <span>Audit en cours…</span>
              </>
            ) : (
              'Lancer l\'Audit'
            )}
          </button>
        </form>

        {/* Barre de progression (pendant chargement) */}
        {loading && (
          <div className="mt-6 h-1 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full w-[40%] bg-emerald-500/80 rounded-full animate-pulse"
            />
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div
            role="alert"
            className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          >
            {error}
          </div>
        )}

        <p className="mt-6 text-center text-zinc-500 text-sm">
          Collez l’URL d’une page produit Shopify (PDP). L’audit peut prendre 30–60 s.
        </p>
      </div>
    </main>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-5 w-5 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
