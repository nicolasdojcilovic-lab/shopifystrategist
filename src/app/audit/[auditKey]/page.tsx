'use client';

/**
 * Page /audit/[auditKey]
 *
 * - Polls every 2s via GET /api/audit/[auditKey]
 * - Displays status message (Capture..., PDF generation..., etc.)
 * - When COMPLETED: HTML report iframe + "Download PDF" button
 */

import { useEffect, useState, useCallback } from 'react';

interface StatusData {
  status: string;
  message?: string;
  reportUrls?: { html?: string; pdf?: string };
}

export default function AuditPage({
  params,
}: {
  params: { auditKey: string };
}) {
  const auditKey = params.auditKey;
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!auditKey) return;
    try {
      const res = await fetch(`/api/audit/${encodeURIComponent(auditKey)}`);
      const json = await res.json();

      if (!res.ok) {
        if (res.status === 404 && json.status === 'PENDING') {
          setData({ status: 'PENDING', message: json.message || 'Démarrage...' });
          return;
        }
        setError(json?.error || `Error ${res.status}`);
        return;
      }

      setData({
        status: json.status,
        message: json.message,
        reportUrls: json.reportUrls,
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    }
  }, [auditKey]);

  // Poll every 2s until COMPLETED
  useEffect(() => {
    fetchStatus();

    const isDone = data?.status === 'COMPLETED';
    if (isDone) return;

    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [auditKey, fetchStatus, data?.status]);

  const isCompleted = data?.status === 'COMPLETED';
  const htmlUrl = data?.reportUrls?.html;
  const pdfUrl = data?.reportUrls?.pdf;

  return (
    <main className="min-h-screen bg-[#0a0a0b] flex flex-col">
      {/* Page header */}
      <header className="border-b border-zinc-800/80 px-4 py-3 flex items-center justify-between">
        <a
          href="/"
          className="text-sm text-zinc-400 hover:text-white transition"
        >
          ← Retour
        </a>
        <span className="text-zinc-500 text-sm font-mono truncate max-w-[200px]">
          {auditKey}
        </span>
      </header>

      <div className="flex-1 flex flex-col p-4 md:p-6">
        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          >
            {error}
          </div>
        )}

        {!data && !error && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Spinner />
              <p className="text-zinc-400">Chargement du statut…</p>
            </div>
          </div>
        )}

        {data && !isCompleted && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Spinner />
              <p className="text-white font-medium">{data.message || data.status}</p>
              <p className="text-zinc-500 text-sm">Updates every 2 s</p>
            </div>
          </div>
        )}

        {data && isCompleted && (
          <div className="flex-1 flex flex-col gap-4">
            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Télécharger le PDF
                </a>
              )}
            </div>

            {/* HTML report iframe */}
            {htmlUrl ? (
              <div className="flex-1 min-h-[480px] rounded-xl border border-zinc-800/80 overflow-hidden bg-white">
                <iframe
                  src={htmlUrl}
                  title="Rapport d'audit"
                  className="w-full h-full min-h-[600px] border-0"
                  sandbox="allow-same-origin"
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center rounded-xl border border-zinc-800/80 bg-zinc-900/50">
                <div className="text-center p-8">
                  <div className="inline-flex p-3 rounded-full bg-zinc-800/80 mb-3">
                    <svg
                      className="w-8 h-8 text-zinc-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"
                      />
                    </svg>
                  </div>
                  <p className="text-zinc-400 font-medium">Rapport HTML non disponible</p>
                  <p className="text-zinc-500 text-sm mt-1">
                    L’URL du rapport n’a pas été enregistrée.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-8 w-8 text-emerald-500"
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
