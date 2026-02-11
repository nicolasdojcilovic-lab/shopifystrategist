# Scripts — Utilitaires et Debug

Ce dossier contient les scripts Node.js pour le projet ShopifyStrategist.

---

## 📁 Scripts Disponibles

### `smoke.mjs`
**Smoke runner** (Step 2)

Runner de tests smoke pour valider l'API selon `docs/SMOKE_AND_QA_SPEC.md`.

```bash
npm run smoke
```

### `debug-keys.ts`
**Debug du moteur de clés déterministes**

Démontre le fonctionnement du système de cache multi-couches et prouve le déterminisme.

```bash
npm run debug:keys
```

**Ce que fait le script** :
1. ✅ Teste une URL propre (Gymshark)
2. ✅ Teste une URL "sale" (UTM, ancres, paramètres)
3. ✅ Compare les clés générées (preuve de déterminisme)
4. ✅ Teste des scénarios de cache miss (mode, locale, copy_ready)

**Output attendu** :
```
TEST 1: URL Propre
   product_key:  prod_a1b2c3d4e5f67890
   snapshot_key: snap_1234567890abcdef
   run_key:      run_fedcba0987654321
   audit_key:    audit_abcdef123456789
   render_key:   render_0fedcba9876543

TEST 2: URL "Sale" (UTM + ancres)
   [mêmes clés que TEST 1]

COMPARAISON:
   ✅ DÉTERMINISME CONFIRMÉ !
   URLs différentes → URLs normalisées identiques → Clés identiques
```

---

## 🔧 Prérequis

### tsx (TypeScript executor)
Les scripts TypeScript utilisent `tsx` pour l'exécution :

```bash
npm install
# tsx sera installé automatiquement via devDependencies
```

### Path Aliases
Les scripts peuvent utiliser les path aliases configurés dans `tsconfig.json` :

```typescript
// Soit relatif (recommandé pour scripts)
import { generateProductKey } from '../src/core/engine/keys.js';

// Soit alias (si tsx --tsconfig)
import { generateProductKey } from '@/core/engine/keys';
```

---

## 🚀 Utilisation

### Exécution Directe

```bash
# Via npm script (recommandé)
npm run debug:keys

# Via tsx directement
npx tsx scripts/debug-keys.ts

# Avec watch mode (redémarre au changement)
npx tsx watch scripts/debug-keys.ts
```

### Création d'un Nouveau Script

1. Créer le fichier `.ts` dans `scripts/`
2. Ajouter le script dans `package.json` :

```json
{
  "scripts": {
    "mon-script": "tsx scripts/mon-script.ts"
  }
}
```

3. Documenter ici dans le README

---

## 📊 Output Coloré

Les scripts utilisent des codes ANSI pour la couleur :

```typescript
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  // ...
};

console.log(`${colors.green}✅ Succès${colors.reset}`);
```

---

## 🧪 Tests vs Scripts vs Diag (Elite)

| Type | Outil | Localisation | Usage | Rôle |
|------|-------|--------------|-------|------|
| **Tests unitaires** | Jest/Vitest | `src/**/*.test.ts` | `npm test` | Tests automatisés |
| **Scripts debug** | tsx | `scripts/*.ts` | `npm run debug:*` | Debug clés |
| **Smoke tests** | Node.js | `scripts/smoke.mjs` | `npm run smoke` | Conformité SSOT |
| **test-capture.ts** | tsx | scripts/ | `npm run test:capture` | Unitaire : Playwright capture seule |
| **diag-live-scraper.ts** | tsx | scripts/ | `npm run diag:scraper` | Diagnostic 1 URL : capture + facts + drift report |
| **mass-diag-scraper.ts** | tsx | scripts/ | `npm run diag:mass` | Diagnostic multi-sites (batch) |

**Différence test-capture vs diag-live-scraper** : `test-capture` teste uniquement la capture Playwright. `diag-live-scraper` fait capture + facts + rapport de drift (diagnostic complet Elite).

---

## 📚 Références

- **Smoke Tests** : `docs/SMOKE_AND_QA_SPEC.md`
- **Moteur de Clés** : `src/core/engine/README.md`
- **DB Schema** : `docs/DB_SCHEMA.md`

---

**Créé** : 2026-01-23  
**Maintenu par** : Équipe ShopifyStrategist
