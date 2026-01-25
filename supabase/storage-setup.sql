-- ⚠️ SUPABASE STORAGE SETUP — Buckets & Policies (SSOT)
-- 
-- Script de configuration pour les buckets Supabase Storage.
-- À exécuter dans le SQL Editor de Supabase.
-- 
-- Référence: src/adapters/storage/supabase.service.ts
-- 
-- @version STORAGE_VERSION = 1.0

-- ============================================================
-- ÉTAPE 1 : Créer les Buckets
-- ============================================================

-- Bucket: screenshots (PNG)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'screenshots',
  'screenshots',
  true,  -- Public read
  10485760,  -- 10 MB max
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket: html-reports (HTML)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'html-reports',
  'html-reports',
  true,  -- Public read
  5242880,  -- 5 MB max
  ARRAY['text/html', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ÉTAPE 2 : Policies — Screenshots
-- ============================================================

-- Supprimer les policies existantes si besoin
DROP POLICY IF EXISTS "Public read screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated write screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Prevent delete screenshots" ON storage.objects;

-- Lecture publique (tout le monde peut voir les screenshots)
CREATE POLICY "Public read screenshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'screenshots');

-- Écriture authentifiée (seuls les utilisateurs auth peuvent uploader)
CREATE POLICY "Authenticated write screenshots"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'screenshots' 
  AND auth.role() = 'authenticated'
);

-- Update autorisé pour overwrite
CREATE POLICY "Authenticated update screenshots"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'screenshots' 
  AND auth.role() = 'authenticated'
);

-- Empêcher suppression (préserver historique SSOT)
CREATE POLICY "Prevent delete screenshots"
ON storage.objects FOR DELETE
USING (false);

-- ============================================================
-- ÉTAPE 3 : Policies — HTML Reports
-- ============================================================

-- Supprimer les policies existantes si besoin
DROP POLICY IF EXISTS "Public read html-reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated write html-reports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update html-reports" ON storage.objects;
DROP POLICY IF EXISTS "Prevent delete html-reports" ON storage.objects;

-- Lecture publique (tout le monde peut voir les rapports)
CREATE POLICY "Public read html-reports"
ON storage.objects FOR SELECT
USING (bucket_id = 'html-reports');

-- Écriture authentifiée
CREATE POLICY "Authenticated write html-reports"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'html-reports' 
  AND auth.role() = 'authenticated'
);

-- Update autorisé pour overwrite
CREATE POLICY "Authenticated update html-reports"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'html-reports' 
  AND auth.role() = 'authenticated'
);

-- Empêcher suppression (préserver historique SSOT)
CREATE POLICY "Prevent delete html-reports"
ON storage.objects FOR DELETE
USING (false);

-- ============================================================
-- VÉRIFICATION : Lister les Buckets
-- ============================================================

SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE id IN ('screenshots', 'html-reports')
ORDER BY created_at DESC;

-- ============================================================
-- VÉRIFICATION : Lister les Policies
-- ============================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND (
    policyname LIKE '%screenshots%' 
    OR policyname LIKE '%html-reports%'
  )
ORDER BY policyname;

-- ============================================================
-- TEST : Upload Fictif (optionnel)
-- ============================================================

-- Note: L'upload réel se fait via l'API JavaScript
-- Ce test vérifie uniquement que les policies sont actives

-- Si vous êtes connecté en tant qu'utilisateur authentifié:
-- 1. Allez dans Storage > screenshots
-- 2. Uploadez un fichier manuellement
-- 3. Vérifiez que l'URL publique fonctionne
