# Developer Guide — ShopifyStrategist

Reference guide for developers. Official commands and SSOT flows.

---

## 1. Official Commands

### Audit & API

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Production server |

### SSOT API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `POST /api/audit/solo` | POST | Runs a SOLO audit (1 URL) — main Elite entry point |
| `GET /api/audit/[auditKey]` | GET | Retrieves audit status and report URLs (HTML, PDF) |

Reference: `docs/SSOT/API_DOC.md`

### Diagnostics & Scraper

| Command | Description |
|---------|-------------|
| `npm run diag:mass` | Multi-site diagnostic (batch) — Elite scraper |
| `npm run diag:scraper` | Single-URL diagnostic: capture + facts + drift report |
| `npm run smoke` | SSOT compliance smoke tests (fixtures) |

### Tests

| Command | Description |
|---------|-------------|
| `npm test` | Vitest (unit tests) |
| `npm run test:audit` | End-to-end audit pipeline test |
| `npm run test:facts` | Facts-collector test |
| `npm run typecheck` | TypeScript check |

### Database

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to DB |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Seed database |

### SSOT & Quality

| Command | Description |
|---------|-------------|
| `npm run ssot:check` | Check SSOT consistency |
| `npm run ssot:sync` | Sync SSOT documents |
| `npm run ssot:validate` | Strict SSOT validation (SSOT_STRICT=1) |

---

## 2. Audit Flow

```
POST /api/audit/solo { url }
  → AuditService.runSoloAudit()
  → Capture → Facts → Score → AI → Report → PDF
  → GET /api/audit/[auditKey] for polling
```

---

## 3. Key Structure

- `src/core/pipeline/` — Orchestration (audit.service, capture.service, delivery.service)
- `src/core/engine/` — Facts, Scoring, AI, Detectors
- `src/contracts/` — Zod schemas (TicketV2, EvidenceV2, exports)
- `docs/SSOT/` — Source of truth documents

---

## 4. Export Validation

ScoreRun exports are validated via `AuditExportsSchema` (Zod) on read.  
No `as unknown as` casts in audit data handling.

---

*Last Updated: 2026-02-08*
