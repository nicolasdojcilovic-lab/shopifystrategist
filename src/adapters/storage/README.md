# Storage Adapter — Supabase Service

**Module** : `src/adapters/storage/supabase.service.ts`  
**Référence SSOT** : `docs/DB_SCHEMA.md` (SnapshotSource.storage_refs)

---

## 🎯 Objectif

Service de stockage pour screenshots et HTML via Supabase Storage.
Gère les uploads avec support du cache (audit_key déterministe SSOT).

---

## 📦 Exports

### `SupabaseStorageService`

Classe principale pour le stockage de fichiers.

**Méthodes** :
- `initialize()` : Initialiser le client Supabase
- `uploadScreenshot(auditKey, viewport, buffer, options?)` : Upload screenshot PNG
- `uploadHtml(auditKey, viewport, html, options?)` : Upload HTML
- `isReady()` : Vérifier si le service est prêt

### Chemins de Stockage (SSOT)

```typescript
// Screenshots
screenshots/${auditKey}_${viewport}.png

// HTML Reports
html-reports/${auditKey}_${viewport}.html
```

**Exemple** :
```
screenshots/audit_a1b2c3d4e5f6_mobile.png
html-reports/audit_a1b2c3d4e5f6_desktop.html
```

---

## 🚀 Utilisation

### Upload Screenshot

```typescript
import { SupabaseStorageService } from '@/adapters/storage/supabase.service';

const service = new SupabaseStorageService();

// Initialiser
await service.initialize();

// Upload screenshot
const result = await service.uploadScreenshot(
  'audit_a1b2c3d4e5f6',
  'mobile',
  screenshotBuffer
);

if (result.success) {
  console.log('URL:', result.publicUrl);
  console.log('Path:', result.path);
  console.log('Size:', result.size, 'bytes');
  console.log('Cached:', result.cached);
}
```

### Upload HTML

```typescript
const result = await service.uploadHtml(
  'audit_a1b2c3d4e5f6',
  'mobile',
  htmlContent
);

if (result.success) {
  console.log('URL:', result.publicUrl);
}
```

### Singleton Global

```typescript
import { getSupabaseStorageService } from '@/adapters/storage/supabase.service';

// Utiliser l'instance globale
const service = getSupabaseStorageService();
await service.initialize();

const result = await service.uploadScreenshot('audit_key', 'mobile', buffer);
```

---

## 🔧 Configuration

### Variables d'Environnement

```env
# Supabase URL (format: https://xxxxx.supabase.co)
SUPABASE_URL=https://your-project.supabase.co

# Supabase Anon Key (clé publique)
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Buckets Supabase

Le service attend que ces buckets existent dans Supabase :

1. **`screenshots`** : Pour les PNG
   - Policy: Public read, Authenticated write
   - Max size: 10 MB recommandé

2. **`html-reports`** : Pour les HTML
   - Policy: Public read, Authenticated write
   - Max size: 5 MB recommandé

**Commandes SQL pour créer les buckets** :

```sql
-- Bucket screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('screenshots', 'screenshots', true);

-- Bucket html-reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('html-reports', 'html-reports', true);

-- Policy: Lecture publique pour screenshots
CREATE POLICY "Public read screenshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'screenshots');

-- Policy: Écriture authentifiée pour screenshots
CREATE POLICY "Authenticated write screenshots"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'screenshots' AND auth.role() = 'authenticated');

-- Policy: Lecture publique pour html-reports
CREATE POLICY "Public read html-reports"
ON storage.objects FOR SELECT
USING (bucket_id = 'html-reports');

-- Policy: Écriture authentifiée pour html-reports
CREATE POLICY "Authenticated write html-reports"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'html-reports' AND auth.role() = 'authenticated');
```

---

## 📊 Types

### `UploadResult` (succès)

```typescript
interface UploadResult {
  success: true;
  path: string;        // Chemin dans le bucket
  publicUrl: string;   // URL publique Supabase
  size: number;        // Taille en bytes
  cached: boolean;     // true si fichier existait déjà
}
```

### `UploadError` (échec)

```typescript
interface UploadError {
  success: false;
  error: {
    type: 'storage_error' | 'network_error' | 'auth_error' | 'unknown';
    message: string;
    code?: string;
  };
}
```

### `UploadOptions`

```typescript
interface UploadOptions {
  overwrite?: boolean;      // Écraser si existe (default: true)
  contentType?: string;     // Content-Type personnalisé
  checkExisting?: boolean;  // Vérifier existence avant upload (default: true)
}
```

---

## ✅ Gestion du Cache (SSOT)

### Principe

Le service utilise `audit_key` déterministe comme base des noms de fichiers.

**Cache Hit** : Si un fichier existe déjà pour cette `audit_key` :
- Option `overwrite: false` → Retourne l'URL existante (pas de re-upload)
- Option `overwrite: true` → Écrase le fichier existant

### Exemple Cache Hit

```typescript
// Premier upload
const result1 = await service.uploadScreenshot(
  'audit_abc123',
  'mobile',
  buffer
);
// result1.cached = false (nouveau fichier)

// Deuxième upload (même audit_key)
const result2 = await service.uploadScreenshot(
  'audit_abc123',
  'mobile',
  buffer,
  { overwrite: false } // Ne pas écraser
);
// result2.cached = true (fichier existant retourné)
// result2.publicUrl = même URL que result1
```

**Avantage SSOT** : Évite les uploads inutiles si les clés déterministes indiquent que le contenu est identique.

---

## 🔗 Intégration avec EvidenceV2

Les URLs retournées par ce service remplissent les champs `storage_path` du contrat SSOT :

```typescript
import type { EvidenceV2 } from '@/contracts/export/evidence.v2';

// Après upload
const screenshotResult = await service.uploadScreenshot(auditKey, 'mobile', buffer);

if (screenshotResult.success) {
  // Créer l'Evidence
  const evidence: EvidenceV2 = {
    evidence_id: generateEvidenceId('page_a', 'mobile', 'screenshot', 'Above Fold', 1),
    level: 'A',
    type: 'screenshot',
    label: 'Screenshot Above-the-fold (Mobile)',
    source: 'page_a',
    viewport: 'mobile',
    timestamp: new Date().toISOString(),
    ref: generateEvidenceAnchor('E_page_a_mobile_screenshot_above_fold_01'),
    details: {
      width: 390,
      height: 844,
      device_scale_factor: 2,
      storage_path: screenshotResult.publicUrl, // ⚡ Lien SSOT
      // ... autres métadonnées
    },
  };
}
```

---

## 🧪 Tests

### Script de Test

```bash
npm run test:storage
```

**Ce que fait le script** :
1. ✅ Upload screenshot (PNG buffer)
2. ✅ Upload HTML
3. ✅ Test cache hit (overwrite: false)
4. ✅ Vérification des publicUrl
5. ✅ Test gestion d'erreurs

---

## 🔒 Sécurité

### Best Practices

1. **Variables d'environnement** : Ne jamais committer `SUPABASE_ANON_KEY`
2. **Row Level Security** : Activer RLS sur les buckets
3. **Rate Limiting** : Supabase gère automatiquement
4. **Validation** : Toujours valider `audit_key` avant upload

### Policies Recommandées

```sql
-- Empêcher suppression pour préserver l'historique
CREATE POLICY "Prevent delete screenshots"
ON storage.objects FOR DELETE
USING (false);

-- Limiter taille des uploads (10 MB)
CREATE POLICY "Limit upload size"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'screenshots' 
  AND (pg_column_size(metadata) + pg_column_size(path_tokens)) < 10485760
);
```

---

## 📚 Références

- **DB Schema** : `docs/DB_SCHEMA.md` (SnapshotSource.storage_refs)
- **Evidence Schema** : `src/contracts/export/evidence.v2.ts`
- **Pipeline Spec** : `docs/AUDIT_PIPELINE_SPEC.md` (storage stage)
- **Supabase Docs** : https://supabase.com/docs/guides/storage

---

**Créé** : 2026-01-24  
**Maintenu par** : Équipe ShopifyStrategist
