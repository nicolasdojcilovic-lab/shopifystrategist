# Analyse des dépendances externes — report-generator.ts

## 1) URLs externes injectées dans le HTML

| Ligne | URL | Type |
|-------|-----|------|
| 246 | `https://cdn.tailwindcss.com` | Script (Tailwind CDN) |
| 247 | `https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js` | Script (Chart.js) |
| 248 | `https://fonts.googleapis.com` | Preconnect (Google Fonts) |
| 249 | `https://fonts.gstatic.com` | Preconnect (Google Fonts) |
| 250 | `https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700&display=swap` | Stylesheet (Google Fonts) |

**Total : 5 URLs externes** (3 requêtes HTTP principales : Tailwind, Chart.js, Google Fonts CSS)

---

## 2) Extraits du template HTML

### Script Tailwind (ligne 246)

```html
  <script src="https://cdn.tailwindcss.com"></script>
```

### Script Chart.js (ligne 247)

```html
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
```

### Preconnect + Google Fonts (lignes 248-250)

```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Référence dans le CSS inline (ligne 252)

```css
* { font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; }
```

### Utilisation de Chart.js (lignes 354-366)

```html
    <section id="radar" class="mb-16">
      ...
      <div class="w-full max-w-md">
        <canvas id="radarChart" width="400" height="400"></canvas>
      </div>
      <script>
        (function(){
          var pillars = ...;
          var values = ...;
          var ctx = document.getElementById('radarChart');
          if (ctx && typeof Chart !== 'undefined') {
            new Chart(ctx, {
              type: 'radar',
              data: { labels: pillars, datasets: [...] },
              options: { ... }
            });
          }
        })();
      </script>
    </section>
```

---

## 3) Plan de patch minimal

### 3.1 Chart.js → Radar SVG statique

**Before (lignes 354-370)**

```html
    <section id="radar" class="mb-16">
      <h2 class="text-3xl font-bold mb-6 text-slate-900">${t('ui.scoreParPiliers', loc)}</h2>
      <div class="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 flex justify-center break-inside-avoid">
        <div class="w-full max-w-md">
          <canvas id="radarChart" width="400" height="400"></canvas>
        </div>
      </div>
      <script>
        (function(){
          var pillars = ${JSON.stringify(...)};
          var values = ${JSON.stringify(...)};
          var ctx = document.getElementById('radarChart');
          if (ctx && typeof Chart !== 'undefined') {
            new Chart(ctx, { type: 'radar', ... });
          }
        })();
      </script>
    </section>
```

**After**

- Supprimer la balise `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>`
- Créer une fonction `generateRadarSvg(pillarScores: Record<Pillar, number>, loc: Locale): string` qui génère un SVG radar statique
- Remplacer le bloc `<canvas> + <script>` par l’appel à cette fonction
- Algorithme SVG : 7 axes à 360°/7, polygon avec `points` calculés depuis les scores (0–100), labels en `text` sur chaque axe

**Exemple de sortie SVG** (structure) :

```html
<svg viewBox="0 0 400 400" class="radar-svg">
  <defs><linearGradient id="radarFill" .../></defs>
  <!-- Grille : 5 cercles concentriques (0, 25, 50, 75, 100) -->
  <!-- 7 axes -->
  <!-- Polygon fill + stroke pour les données -->
  <!-- Labels de piliers (clarté, friction, etc.) -->
</svg>
```

---

### 3.2 Tailwind CDN → CSS inline minimal

**Before (ligne 246 + classes utilitaires partout)**

```html
  <script src="https://cdn.tailwindcss.com"></script>
```

+ classes : `antialiased`, `min-h-[90vh]`, `flex`, `flex-col`, `justify-center`, `items-center`, `p-8`, `text-slate-900`, `max-w-4xl`, `max-w-6xl`, `grid`, `grid-cols-2`, `md:grid-cols-4`, `gap-4`, `gap-6`, `rounded-xl`, `rounded-2xl`, `border`, `border-slate-200`, `bg-white`, `shadow-sm`, `card-hover`, `mb-16`, `mb-6`, `mb-4`, `mb-2`, `mb-1`, `mb-3`, `mb-8`, `mb-10`, `mb-12`, `mt-3`, `mt-4`, `mt-8`, `mt-20`, `py-14`, `py-8`, `px-4`, `sm:px-6`, `lg:px-8`, `text-3xl`, `text-2xl`, `text-xl`, `text-lg`, `text-sm`, `text-xs`, `font-bold`, `font-semibold`, `font-medium`, `font-light`, `w-full`, `w-48`, `h-48`, `md:w-56`, `md:h-56`, `space-y-6`, `space-y-4`, `space-y-1`, etc.

**After**

- Supprimer `<script src="https://cdn.tailwindcss.com"></script>`
- Ajouter dans le bloc `<style>` existant un **CSS utilitaire minimal** couvrant les classes utilisées par le rapport
- Garder la structure sémantique (`section`, `div`, `h1`, `h2`, etc.) et remplacer les classes Tailwind par des classes custom (ex. `.report-hero`, `.report-card`, `.report-grid`, etc.) ou des utilitaires simplifiés

**Structure du CSS à ajouter** (à insérer dans le bloc `<style>` actuel) :

```css
/* Report layout - replacement for Tailwind */
.report-body { -webkit-font-smoothing: antialiased; }
.report-hero { min-height: 90vh; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 2rem; }
.report-container { max-width: 72rem; margin-left: auto; margin-right: auto; padding: 1rem 1.5rem 3.5rem; }
.report-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
.report-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
.report-card { border-radius: 0.75rem; padding: 1.25rem; border: 1px solid #e2e8f0; background: #fff; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); }
.report-section { margin-bottom: 4rem; }
.report-flex { display: flex; }
.report-flex-wrap { flex-wrap: wrap; }
.report-gap-2 { gap: 0.5rem; }
.report-gap-4 { gap: 1rem; }
.report-gap-6 { gap: 1.5rem; }
/* ... etc. pour les autres combinaisons utilisées */
```

**Alternative plus légère** : garder une approche utilitaire compacte (`.f`, `.fc`, `.jc`, `.ai`, `.p8`, `.mb16`, etc.) pour limiter la taille du CSS.

---

### 3.3 Google Fonts → System fonts

**Before (lignes 248-250, 252)**

```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  ...
  <style>
    * { font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; }
```

**After**

- Supprimer les 3 balises `<link>` (preconnect + stylesheet)
- Modifier la règle `font-family` :

```css
* { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; }
```

---

## 4) Résumé des modifs (fichier report-generator.ts)

| Zone | Avant | Après |
|------|-------|-------|
| L246 | `<script src="https://cdn.tailwindcss.com"></script>` | Supprimé |
| L247 | `<script src="https://cdn.jsdelivr.net/npm/chart.js@..."></script>` | Supprimé |
| L248-250 | 3 balises `<link>` Google Fonts | Supprimées |
| L252 | `font-family: 'Outfit', 'Inter', ...` | `font-family: -apple-system, BlinkMacSystemFont, ...` |
| L354-370 | `<canvas>` + script Chart.js | `<svg>` généré par `generateRadarSvg()` |
| L252-286 | Bloc `<style>` existant | Étendre avec CSS utilitaire minimal (remplacement Tailwind) |

---

## 5) Ordre d’implémentation recommandé

1. **Google Fonts → system fonts** : suppression des `<link>` + modification du `font-family`
2. **Chart.js → SVG** : fonction `generateRadarSvg()`, remplacement du bloc canvas/script
3. **Tailwind → CSS inline** : ajout du CSS minimal, remplacement des classes Tailwind par des classes custom

L’étape 3 est la plus volumineuse car elle touche toutes les sections du template.
