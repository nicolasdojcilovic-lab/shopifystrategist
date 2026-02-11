/**
 * Individual Report Page — [id]
 *
 * Displays HTML report (SSOT) for a given audit.
 * HTML report is the source of truth (PDF/CSV are derived).
 *
 * Aligns with:
 * - docs/REPORT_OUTLINE.md (V3.1)
 * - docs/SPEC.md
 */

interface ReportPageProps {
  params: {
    id: string;
  };
}

export default function ReportPage({ params }: ReportPageProps) {
  const { id } = params;

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">Rapport #{id}</h1>
            <div className="flex gap-4">
              <button className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                Télécharger PDF
              </button>
              <button className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                Exporter CSV
              </button>
            </div>
          </div>
          <p className="text-gray-500">
            Rapport HTML (SSOT) — PDF/CSV dérivés uniquement
          </p>
        </div>

        {/* HTML report will be loaded here */}
        <div className="border rounded-lg p-8">
          <div className="text-center text-gray-500">
            <p className="mb-4">Chargement du rapport...</p>
            <p className="text-sm">
              Le rapport HTML est généré conformément à REPORT_OUTLINE.md (V3.1)
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
