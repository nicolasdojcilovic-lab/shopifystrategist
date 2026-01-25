-- ============================================================================
-- Supabase Storage Setup: PDF Reports Bucket
-- ============================================================================
-- Ce script crée le bucket pour stocker les rapports PDF générés.
-- 
-- Bucket: pdf-reports
-- Public: true (lecture publique)
-- Max file size: 50MB
-- 
-- Usage:
--   Exécuter ce SQL dans le SQL Editor de Supabase Dashboard
-- ============================================================================

-- Créer le bucket pdf-reports (si non existant)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('pdf-reports', 'pdf-reports', true, 52428800)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Policy: Lecture publique (GET)
DROP POLICY IF EXISTS "Public read access for pdf-reports" ON storage.objects;
CREATE POLICY "Public read access for pdf-reports"
ON storage.objects FOR SELECT
USING (bucket_id = 'pdf-reports');

-- Policy: Insertion authentifiée (POST)
DROP POLICY IF EXISTS "Authenticated insert access for pdf-reports" ON storage.objects;
CREATE POLICY "Authenticated insert access for pdf-reports"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'pdf-reports' AND auth.role() = 'authenticated');

-- Policy: Mise à jour authentifiée (PUT/PATCH)
DROP POLICY IF EXISTS "Authenticated update access for pdf-reports" ON storage.objects;
CREATE POLICY "Authenticated update access for pdf-reports"
ON storage.objects FOR UPDATE
USING (bucket_id = 'pdf-reports' AND auth.role() = 'authenticated');

-- Policy: Suppression authentifiée (DELETE)
DROP POLICY IF EXISTS "Authenticated delete access for pdf-reports" ON storage.objects;
CREATE POLICY "Authenticated delete access for pdf-reports"
ON storage.objects FOR DELETE
USING (bucket_id = 'pdf-reports' AND auth.role() = 'authenticated');

-- ============================================================================
-- Service Role Bypass (pour server-side operations)
-- ============================================================================
-- Note: Le service role key bypass automatiquement les RLS policies.
-- Les opérations server-side utilisent SUPABASE_SERVICE_ROLE_KEY.
-- ============================================================================

-- Vérification
SELECT 
  id,
  name,
  public,
  file_size_limit,
  created_at
FROM storage.buckets
WHERE id = 'pdf-reports';
