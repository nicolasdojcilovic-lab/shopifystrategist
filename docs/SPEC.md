# ShopifyStrategist — SPEC.md (SSOT)
**Statut :** SSOT (Single Source Of Truth = source de vérité unique)  
**Owner :** Nicolas  
**Objectif :** Document “entonnoir” (marché → produit → livrable → composants) alignant **produit ↔ implémentation ↔ tests**.

---

## 0) Acronymes & termes (définitions)
- **SSOT (Single Source Of Truth)** : source de vérité unique (ici : le **rapport HTML**).
- **HTML (HyperText Markup Language)** : format de page web.
- **PDF (Portable Document Format)** : format de document export.
- **PDP (Product Detail Page)** : page produit.
- **CRO (Conversion Rate Optimization)** : optimisation du taux de conversion.
- **ICP (Ideal Customer Profile)** : profil client idéal.
- **AB (A vs B)** : comparaison de deux pages (souvent “toi vs concurrent”).
- **Before/After (Avant/Après)** : comparaison d’une même page entre deux versions/dates.
- **P90** : 90e percentile (90% des audits finissent en dessous de ce temps).
- **COGS (Cost Of Goods Sold)** : coût variable par audit (capture, rendu PDF, IA optionnelle, etc.).
- **GA4 (Google Analytics 4)** : outil d’analytics (hors MVP).
- **RLS (Row-Level Security)** : sécurité “par ligne” en base de données.
- **DoD (Definition of Done)** : critères d’acceptation “c’est fini quand…”.
- **Pre-sales (avant-vente)** : usage pour closer une mission/sprint.
- **Delivery** : exécution/production des actions (par l’agence / le freelance).

---

## 1) SSOT rules (non négociables)
1) Le **rapport HTML** est la **source de vérité** (SSOT).  
2) Le **PDF** est **strictement dérivé** du HTML (rendu Playwright).  
3) **Reproductibilité** : mêmes entrées + mêmes versions = mêmes sorties.  
4) **Preuve obligatoire** (“evidence-based”) : chaque recommandation contient **au moins 1 preuve** (capture / mesure / élément détecté).  
5) **Qualité vendable** : le rapport doit être **envoyable sans retouche** dans la grande majorité des cas.  
6) **Mode dégradé** : si un module (capture/mesure) échoue, on livre **quand même** un rapport exploitable + explication claire.

---

## 2) Résumé exécutif (1 page)

### 2.1 Vision
Devenir l’outil le plus rapide pour produire un **teardown PDP Shopify** “agency-grade” :
- **prêt à envoyer** (HTML + PDF),
- **preuve → action** (pas de blabla),
- **standardisé** (industrialisation côté agence),
- **comparable** (AB / Avant-Après),
- **reproductible** (déterminisme + cache + versioning).

### 2.2 Positionnement (one-liner)
**Teardown PDP basé sur des preuves + comparaison + backlog exécutable.**  
=> **Une arme d’avant-vente (pre-sales) + un OS de delivery** pour agences/freelances.

### 2.3 ICP (ordre de priorité, cashflow-first)
1) **Agences Shopify / CRO** : volume + récurrence + besoin de standardiser (pre-sales + delivery).  
2) **Freelances CRO / e-commerce ops** : besoin de livrer vite, qualité constante, sans “réinventer l’audit”.  
3) **Marques DTC Shopify (≈ 1–20M€)** : via partenaires (éviter support/intégrations au départ).

### 2.4 Promesse (résultat mesurable)
En **< X minutes**, générer un rapport **envoyable** qui contient :
- un **résumé exécutif** clair,
- des **actions prioritaires** triées (impact / effort / risque),
- des **preuves**,
- un **backlog exportable** (tickets),
- option : un **comparatif** (concurrent / avant-après),
- option : du **copy-ready** (texte prêt à coller) en FR/EN.

### 2.5 Offres (SKU = produits vendables)
- **SOLO — Instant Teardown** (déterministe, rapide, evidence-based)  
- **DUO — AB Battlecard** (toi vs concurrent : “gap list” + plan d’actions)  
- **DUO — Before/After Diff** (même PDP à 2 versions/dates : changements + backlog)  
- **Add-ons** : White-label (marque blanche), copy-ready (IA), exports Notion/Jira.

### 2.6 KPI (indicateurs de réussite)
Produit :
- **P90** (Instant / DUO), **cache hit rate** (taux de cache), taux d’erreurs
- % rapports “envoyables sans retouche”
Business :
- audits/mois/agence, rétention, marge brute (**COGS** maîtrisé via cache)

---

## 3) Marché

### 3.1 Problèmes à fort ROI (douleur = €)
- PDP qui ne convertit pas → CAC/ROAS dégradé
- Audit humain = lent/cher/peu reproductible
- Checklists = pas de priorisation, pas de preuves, pas “prêt client”
- Tests AB = demandent trafic/temps/implémentation → pas une arme de vente instantanée

### 3.2 Alternatives & pourquoi c’est insuffisant
- **Checklists/templates** : utile pour apprendre, rarement un livrable vendable.
- **Audits humains** : qualité variable, coûteux, non industrialisable.
- **Apps “AI audit”** : souvent génériques, faible crédibilité si pas de preuves.
- **Outils techniques** : utiles (performance/SEO/accessibilité), pas orientés “conversion + actions”.

### 3.3 Angles morts (opportunités)
1) Livrable agency-grade prêt à envoyer  
2) Preuves systématiques (anti “générique”)  
3) Comparabilité (AB / avant-après) standard  
4) Reproductibilité / traçabilité (reruns comparables)  
5) Priorisation vendable (“quoi faire lundi”)  
6) Backlog exécutable (transformer un rapport en delivery)

---

## 4) Positionnement (à verrouiller)

### 4.1 Ce qu’on vend (vraiment)
On ne vend pas “un audit”. On vend :
- **une décision** (où agir en premier),
- **une preuve** (pour convaincre),
- **un backlog** (pour exécuter),
- **une comparaison** (pour justifier et démontrer).

### 4.2 Message “agence”
- **Avant-vente (pre-sales)** : “preuves + plan d’action en 10 minutes → tu closes.”
- **Delivery** : “tickets structurés → tu livres vite.”
- **Preuve de valeur** : “avant/après → tu montres l’amélioration.”

### 4.3 Non-objectifs (anti-dérive)
- Ne pas devenir une plateforme analytics
- Ne pas dépendre d’un accès Shopify Admin au MVP
- Ne pas être un “générateur de texte” : preuves > prose

---

## 5) Produit (proposition de valeur)

### 5.1 JTBD (besoin concret)
- **Agence** : produire un teardown crédible immédiatement pour closer un sprint / mission.  
- **Freelance** : standardiser le diagnostic, livrer vite, qualité constante.  
- **Marque** (plus tard) : quick wins sans gros engagement.

### 5.2 Outputs (livrables)
- **HTML SSOT** (rapport complet + ancres + preuves)
- **PDF** (Playwright, dérivé strict)
- **Backlog exportable** (CSV minimum ; Notion/Jira ensuite)
- **Artefacts & traces** (timings, headers de cache, logs)

### 5.3 Evidence-based (anti-hallucination)
Règle dure : chaque recommandation doit contenir **au moins 1 preuve** :
- capture (avec ancre vers la section)  
- mesure (ex: performance, poids images, éléments bloquants)  
- élément détecté explicitement (ex: absence de X, présence de Y)

---

## 6) UX du livrable (ce que le client voit)

### 6.1 SOLO — Instant Teardown (see REPORT_OUTLINE V3.1)
La structure envoyable du rapport est définie uniquement dans docs/REPORT_OUTLINE.md
**A) Cover**
- URL audité + timestamp
- versions (normalize/scoring/engine/report/render)
- mode (SOLO/DUO) + “scope: PDP”
- langue (FR/EN)

**B) Résumé exécutif (6 lignes max)**
- 1 phrase : principal frein
- 1 phrase : principale opportunité
- Top 3 actions (impact élevé)
- “Quick wins 48h” (1–3 actions)
- effort estimé global (S/M/L = petit/moyen/gros)
- next step (proposition sprint)

**C) Top actions (format ticket)**
Chaque action = 1 ticket :
- titre (verbe + objet)
- impact (H/M/L = fort/moyen/faible) + pourquoi (1 phrase)
- effort (S/M/L)
- risque (faible/moyen/élevé)
- preuve (capture/mesure/détection)
- how-to (3–7 étapes)
- validation (comment vérifier que c’est corrigé)

**D) Pack de preuves**
- captures + extraits + mesures regroupés
- liens d’ancrage vers sections

**E) Annexe (optionnel)**
- scorecard (si utile) — **jamais l’argument principal**
- notes techniques (perf/seo/accessibility)
- limites & hypothèses

### 6.2 DUO — AB Battlecard (diff vendable)
Sortie DUO AB = battlecard :
- “Ce que le concurrent fait mieux” (3–10 gaps max, prouvés)
- “Ce qu’on peut copier en 72h” (quick wins)
- “Ce qu’on ne doit pas copier” (cohérence marque/offre)
- backlog “copy-paths” (tickets)

### 6.3 DUO — Before/After Diff (avant/après)
- liste des changements détectés (structure, modules, sections, médias)
- “impact attendu” (hypothèse) + comment mesurer (si disponible)
- backlog de corrections / améliorations

---

## 7) Scope MVP (Minimum Viable Product = produit minimum vendable)

### 7.1 In-scope MVP
1) **SOLO — Instant Teardown** : HTML SSOT + PDF  
2) **DUO — AB Battlecard** : HTML SSOT + PDF  
3) **Export backlog** : CSV (tickets) + mapping stable (pour Notion ensuite)  
4) **Cache + déterminisme + versioning**  
5) **Observabilité** : timings + headers cache + artefacts smoke

### 7.2 Out-of-scope MVP (volontairement)
- Connexion Shopify Admin / GA4 / pixels
- Heatmaps / session recordings
- AB testing intégré au thème
- Multi-users/teams/RLS avancé
- White-label avancé (seulement “léger” si standardisable)

### 7.3 DoD (Definition of Done)
- reproductible : mêmes entrées + versions → mêmes sorties
- PDF rendu identique à partir du HTML SSOT
- cache hits mesurables + reruns rapides
- rapport “envoyable” la plupart du temps
- smoke tests + artefacts exportés

---

## 8) Engineering principles (invariants)
Ces principes décrivent “ce qui doit être vrai” côté implémentation, indépendamment du style de code.

- **HTML is SSOT** : le rapport HTML est la vérité ; le PDF est uniquement un rendu du HTML.
- **Contract-first** : chaque requête/réponse API a un schéma explicite et validé à l’exécution (runtime).
- **Deterministic outputs** : mêmes entrées + mêmes versions ⇒ mêmes sorties (clés stables, rendu stable).
- **Versioned pipeline** : normalisation / détection / scoring / report / render ont des versions explicites, injectées dans les outputs.
- **Cache by keys** : multi-layer cache basé sur des clés déterministes (reruns rapides et peu coûteux).
- **Evidence-based recommendations** : aucune reco sans preuve (capture / mesure / détection).
- **Graceful degradation** : échec partiel ⇒ rapport livrable + explication + contournement.
- **Observability** : timings par étape + ids de run + headers de cache émis systématiquement.
- **No hidden state** : pas d’état implicite ; tout ce qui impacte le résultat doit être dans les inputs/options/versions.
- **Safety-by-default** : timeouts, limites, anti-abus, messages d’erreur lisibles (réduction support).

---

## 9) Principes d’architecture (invariants)

### 9.1 SSOT
- HTML = vérité
- PDF = dérivé Playwright
- toute modification du rapport = modification du HTML SSOT (pas du PDF)

### 9.2 Déterminisme & cache multi-couches
Clés déterministes :
- `product_key`, `snapshot_key`, `run_key`, `audit_key`, `render_key`

Couches :
- Produit (URL normalisée)
- Snapshot (HTML capturé/normalisé)
- Run (scoring + preuves)
- Audit (rapport HTML)
- Render (PDF)

Objectif : **ne jamais repayer** (capture/rendu/IA) si identique.

### 9.3 Versioning (anti-drift)
- `NORMALIZE_VERSION`
- `SCORING_VERSION`
- `ENGINE_VERSION`
- (optionnel) `REPORT_VERSION`, `RENDER_VERSION`
Chaque output inclut les versions pour auditabilité.

### 9.4 Contract-first
- schémas stricts (Zod) pour toutes requêtes/réponses
- idempotence : même requête = même résultat (ou cache hit)

### 9.5 Observabilité
- timings détaillés (capture/normalisation/scoring/rendu)
- headers de cache (X-Cache*, X-Audit-Timing)
- logs de requêtes + artefacts smoke (HTML/JSON/erreurs)

---

## 10) Modèle économique (simple et lisible)

### 10.1 Unité de valeur
- 1 **SOLO** = 1 crédit
- 1 **DUO** = 2 crédits (hypothèse)

### 10.2 Plans (reco)
- **Agency plan** : forfait mensuel (X audits inclus) + dépassement clair
- **Add-on white-label** : supplément (valeur perçue forte)
- **Add-on IA copy-ready** : supplément (COGS variable)

### 10.3 Garde-fous
- COGS maîtrisé via cache
- rate limits / anti-abus
- logs usage (ledger)

---

## 11) Go-to-market (cashflow-first)

### 11.1 Angle de vente principal (agences)
- “Pre-sales teardown” : audit en 10 min → closer un sprint 72h
- “Delivery accelerator” : backlog prêt → production plus rapide
- “Proof pack” : avant/après → rétention + upsell

### 11.2 Packaging service (pour booster le cash)
- Offre type : “Sprint 72h PDP” (audit + quick wins)
- ShopifyStrategist = outil interne + livrable envoyé au client

### 11.3 Distribution
- partenariats agences Shopify / CRO
- prospection ciblée “teardown + battlecard”
- démo live + 1 audit gratuit (ou fortement discount) contre un call

---

## 12) Operating model — décorrélation du temps (side business)
> La décorrélation ne vient pas “du code”, mais du combo : **Produit standardisé + Distribution partenaires + Self-serve + Support borné**.

### 12.1 Canal prioritaire
**Beachhead = agences Shopify / CRO + freelances** (elles vendent et livrent sans toi).  
**Non-prioritaire au départ : marques DTC en direct** (support et demandes spécifiques).

### 12.2 Offre packagée (répétable, sans custom)
- **On vend des packs**, pas du sur-mesure.
- **Pas de customisation de template par client** au début (sinon ton temps recolle au revenu).

### 12.3 Self-serve (réduction support)
- 1 page “How it works”
- 1 page “Limitations” (scope supporté)
- 1 page “FAQ / Troubleshooting”
- 3 rapports exemples (SOLO + DUO)

### 12.4 Support policy
Inclus :
- bugs reproductibles, erreurs de rendu, URL invalides
Exclus :
- implémentation des recommandations
- coaching CRO sur mesure
- customisations au cas par cas

SLA recommandé :
- best effort, 48–72h ouvrées

### 12.5 Business DoD (décorrélation réelle)
- 80%+ des audits générés sans intervention
- <10% des audits déclenchent un ticket support
- une agence peut produire et envoyer des audits sans toi
- le revenu mensuel continue même si ton temps baisse (maintenance only)

---

## 13) Risques & mitigations

1) **Perception “générique / IA”**
- mitigation : preuves obligatoires + “what we detected” + pas de claims invérifiables

2) **Scores contestables**
- mitigation : score secondaire, vente = actions + preuves + backlog

3) **Agences : “c’est notre valeur, on ne veut pas d’outil”**
- mitigation : white-label + export tickets + promesse “close + delivery”, pas “remplacer l’agence”

4) **Dérive produit (scope creep)**
- mitigation : tout ce qui augmente le support = repoussé ou add-on standardisable payant

---

## 14) Annexes (docs à créer)
- `docs/API_DOC.md` (contrats endpoints + payloads validés)
- `docs/DB_SCHEMA.md` (tables/relations + cache keys)
- `docs/RUNBOOK_SMOKE.md` (commandes + preuves + headers attendus)
- `docs/ADR/*.md` (log de décisions : 1 décision = 10 lignes, datée)

---

## 15) Glossaire (mini)
- **Teardown** : analyse structurée orientée action, avec preuves.
- **Battlecard** : comparaison vs concurrent centrée sur écarts actionnables.
- **Mode dégradé** : on livre malgré un échec partiel (avec explication).
- **Clés déterministes** : identifiants stables pour cache et reruns comparables.
