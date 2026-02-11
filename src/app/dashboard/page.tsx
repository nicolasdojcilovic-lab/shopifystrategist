/**
 * Dashboard — Main page
 *
 * Audit list, new audit creation, statistics.
 * Aligns with Gold tree structure.
 */
export default function DashboardPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Stats cards */}
          <div className="border rounded-lg p-6">
            <h2 className="text-sm font-medium text-gray-500 mb-2">
              Audits Totaux
            </h2>
            <p className="text-3xl font-bold">0</p>
          </div>
          
          <div className="border rounded-lg p-6">
            <h2 className="text-sm font-medium text-gray-500 mb-2">
              En Cours
            </h2>
            <p className="text-3xl font-bold">0</p>
          </div>
          
          <div className="border rounded-lg p-6">
            <h2 className="text-sm font-medium text-gray-500 mb-2">
              Complétés
            </h2>
            <p className="text-3xl font-bold">0</p>
          </div>
        </div>

        {/* Actions block */}
        <div className="mb-8">
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            + Nouvel Audit
          </button>
        </div>

        {/* Audit list */}
        <div className="border rounded-lg">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Audits Récents</h2>
            <p className="text-gray-500">Aucun audit pour le moment.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
