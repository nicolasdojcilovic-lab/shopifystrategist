import fs from "node:fs/promises";
import path from "node:path";

const SSOT_DIR = path.join(process.cwd(), "docs", "SSOT");
const MANIFEST_PATH = path.join(SSOT_DIR, "SSOT_MANIFEST.json");
const INDEX_PATH = path.join(SSOT_DIR, "SSOT_INDEX.md");
const TRACE_PATH = path.join(SSOT_DIR, "TRACEABILITY_MATRIX.md");
const DRIFT_PATH = path.join(SSOT_DIR, "DRIFT_GATES.md");

function slugifyGitHub(s) {
  // approximate GitHub heading slug rules; good enough for internal anchors
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function extractH1AndVersion(md) {
  const lines = md.split(/\r?\n/);
  const h1 = lines.find((l) => l.startsWith("# "));
  const title = h1 ? h1.replace(/^#\s+/, "").trim() : null;

  // versions like "(v1.9)" or "v1.9" in title
  let version = null;
  if (title) {
    const m =
      title.match(/\(v(\d+\.\d+(?:\.\d+)?)\)/i) ||
      title.match(/\bv(\d+\.\d+(?:\.\d+)?)\b/i);
    if (m) version = m[1];
  }

  // fallback: look for "Version: x.y" in first ~40 lines
  if (!version) {
    const head = lines.slice(0, 40).join("\n");
    const m = head.match(/\bversion\s*[:=]\s*(\d+\.\d+(?:\.\d+)?)\b/i);
    if (m) version = m[1];
  }

  return { title, version };
}

function isGenerated(content) {
  return content.includes("<!-- GENERATED: ssot:sync -->");
}

async function readJson(p) {
  const raw = await fs.readFile(p, "utf-8");
  return JSON.parse(raw);
}

async function writeJson(p, obj) {
  const raw = JSON.stringify(obj, null, 2) + "\n";
  await fs.writeFile(p, raw, "utf-8");
}

function renderIndex(manifest) {
  const now = new Date().toISOString();
  const docs = manifest.docs || [];
  const precedence = manifest.authority?.precedence_order || [];

  const byRank = [...precedence].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

  return `<!-- GENERATED: ssot:sync -->
# SSOT_INDEX.md (v1.0)

## Purpose
Navigation + governance index for the SSOT set.
Generated from \`SSOT_MANIFEST.json\`.

Generated at: ${now}

---

## Folder
- SSOT folder: \`${manifest.ssot_folder || "docs/SSOT"}\`
- Language: \`${manifest.language || "en"}\`

---

## Authority & precedence (anti-drift)
When two docs conflict, higher authority wins.

${byRank
      .map(
        (x) =>
          `${x.rank}. **${x.file}** — ${x.label || ""}${x.normative === false ? " _(non-normative)_" : ""}`
      )
      .join("\n")}

Conflict policy:
- Rule: ${manifest.authority?.conflict_policy?.rule || "Higher rank wins"}
- Tie-breaker: ${manifest.authority?.conflict_policy?.tie_breaker || "More specific wins; otherwise add an explicit decision + patch"}
- Unresolved action: ${manifest.authority?.conflict_policy?.unresolved_action || "Add decision + patch losing sources"}

---

## Inventory (${docs.length} docs)
| DocID | File | Title | Category | Normative | Authority | Version |
|------:|------|-------|----------|:---------:|----------:|:-------:|
${docs
      .map((d) => {
        const v = d.version ?? "";
        const t = (d.title ?? "").replace(/\|/g, "\\|");
        return `| ${d.doc_id} | ${d.file} | ${t} | ${d.category || ""} | ${d.normative ? "Yes" : "No"} | ${d.authority_rank ?? ""} | ${v} |`;
      })
      .join("\n")}

---

## Fast routing (what to update)
- Product acceptance contracts → **REPORT_ELITE_REQUIREMENTS.md**
- Closed lists / IDs / taxonomy → **REGISTRY.md**
- Architecture / invariants → **SPEC.md**
- Scoring interpretation → **SCORING_AND_DETECTION.md**
- Detector I/O contracts → **DETECTORS_SPEC.md**
- Evidence contracts → **EVIDENCE_PACK_SPEC.md**
- Report structure / sections → **REPORT_OUTLINE.md**
- Pipeline / budgets / degradation / TTFV → **AUDIT_PIPELINE_SPEC.md**
- Public API contract → **API_DOC.md**
- DB contracts / deterministic keys → **DB_SCHEMA.md**
- QA scenarios / gates → **SMOKE_AND_QA_SPEC.md**
- Fixtures / env reproducibility → **FIXTURES_AND_ENV_SPEC.md**
- Operations only → **RUNBOOK_OPERATIONS.md**
- Meta conventions → **DECISIONS.md**
`;
}

function extractRequirementsFromFinalSpec(finalSpecMd) {
  // Parse headings to map each line to nearest heading (for anchors)
  const lines = finalSpecMd.split(/\r?\n/);
  let currentHeading = null;

  const reqs = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];

    const heading = l.match(/^(#{1,6})\s+(.+)\s*$/);
    if (heading) {
      currentHeading = heading[2].trim();
      continue;
    }

    // pick normative statements; keep it simple & deterministic
    if (/\b(MUST NOT|SHALL NOT|MUST|SHALL|REQUIRED)\b/.test(l)) {
      const text = l.trim();
      if (!text) continue;

      // Avoid obvious false positives (tables separators, code fences)
      if (/^\|?[-: ]+\|?$/g.test(text)) continue;
      if (text.startsWith("```")) continue;

      reqs.push({
        heading: currentHeading,
        text,
      });
    }
  }

  // de-dup exact lines
  const seen = new Set();
  return reqs.filter((r) => {
    const k = `${r.heading || ""}::${r.text}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function renderTraceabilitySkeleton(finalSpecFile, requirements) {
  const rows = requirements.map((r, idx) => {
    const id = `REQ-${String(idx + 1).padStart(3, "0")}`;
    const short = r.text.length > 120 ? r.text.slice(0, 117) + "…" : r.text;
    const anchor = r.heading ? `#${slugifyGitHub(r.heading)}` : "";
    const source = `${finalSpecFile}${anchor}`;
    return `| ${id} | ${short.replace(/\|/g, "\\|")} | ${source} |  |  |  |  | TBD |  |`;
  });

  const now = new Date().toISOString();

  return `<!-- GENERATED: ssot:sync -->
# TRACEABILITY_MATRIX.md (v1.0)

## Purpose
End-to-end alignment:
Final Spec → SSOT contracts → Registry IDs → Code → Smoke/QA → Evidence.

Generated at: ${now}

Status:
- OK / GAP / CONFLICT / TBD

---

## Matrix
| ReqID | Requirement (short) | Source (Final Spec anchor) | SSOT coverage (docs+anchors) | Registry IDs | Code (paths) | Tests (Smoke/QA) | Status | Notes / Patch plan |
|------:|----------------------|----------------------------|------------------------------|-------------|--------------|------------------|--------|--------------------|
${rows.join("\n")}

---

## Conflicts log (manual, only if Status=CONFLICT)
| ConflictID | Topic | Sources in conflict | Decision (winner) | Patch target(s) | Date |
|-----------:|-------|--------------------|-------------------|-----------------|------|
| CONFLICT-001 |  |  |  |  |  |

---

## Gaps backlog (manual, only if Status=GAP)
| GapID | Missing piece | Where it should live | Patch size (S/M/L) | Dependencies | Date |
|------:|---------------|----------------------|--------------------|--------------|------|
| GAP-001 |  |  |  |  |  |
`;
}

function renderDriftGatesStub() {
  const now = new Date().toISOString();
  return `<!-- GENERATED: ssot:sync -->
# DRIFT_GATES.md (v1.0)

Generated at: ${now}

## P0 (ship-blocking)
- EN-only SSOT (heuristic)
- Manifest ↔ folder consistency
- Each SSOT doc has exactly one H1
- Determinism: same input snapshot + same versions => same output keys/order (validated by smoke)
- Evidence required: no ticket without evidence_refs >= 1 (validated by smoke)
- Registry IDs are closed lists (validated by smoke)

## P1
- Traceability threshold: all P0 requirements are OK
- Required “Owned Concepts / Not Owned” sections (recommended; warn only)
`;
}

async function main() {
  // Ensure folder exists
  await fs.mkdir(SSOT_DIR, { recursive: true });

  // Load manifest
  const manifest = await readJson(MANIFEST_PATH);

  // Update titles/versions automatically from files (non-destructive)
  const docs = manifest.docs || [];
  for (const d of docs) {
    const filePath = path.join(SSOT_DIR, d.file);
    const md = await fs.readFile(filePath, "utf-8");
    const { title, version } = extractH1AndVersion(md);
    if (!d.title && title) d.title = title.replace(/\s*\(v[0-9.]+\)\s*/i, "").trim();
    if (!d.version && version) d.version = version;
  }

  // Persist manifest update
  await writeJson(MANIFEST_PATH, manifest);

  // Generate SSOT_INDEX.md
  await fs.writeFile(INDEX_PATH, renderIndex(manifest), "utf-8");

  // Generate TRACEABILITY_MATRIX.md from Final Spec (authority rank 1)
  const finalSpec = manifest.authority?.precedence_order?.find((x) => x.rank === 1)?.file;
  if (!finalSpec) {
    throw new Error("Manifest missing authority.precedence_order rank=1 (Final Spec file).");
  }
  const finalSpecPath = path.join(SSOT_DIR, finalSpec);
  const finalSpecMd = await fs.readFile(finalSpecPath, "utf-8");
  const reqs = extractRequirementsFromFinalSpec(finalSpecMd);

  const traceExists = await fs
    .readFile(TRACE_PATH, "utf-8")
    .then((c) => c)
    .catch(() => null);

  // Overwrite only if missing OR previously generated
  if (!traceExists || isGenerated(traceExists)) {
    await fs.writeFile(TRACE_PATH, renderTraceabilitySkeleton(finalSpec, reqs), "utf-8");
  }

  // Create DRIFT_GATES.md only if missing OR previously generated
  const driftExists = await fs
    .readFile(DRIFT_PATH, "utf-8")
    .then((c) => c)
    .catch(() => null);

  if (!driftExists || isGenerated(driftExists)) {
    await fs.writeFile(DRIFT_PATH, renderDriftGatesStub(), "utf-8");
  }

  console.log("✅ ssot:sync complete");
  console.log(`- Updated: ${path.relative(process.cwd(), MANIFEST_PATH)}`);
  console.log(`- Generated: ${path.relative(process.cwd(), INDEX_PATH)}`);
  console.log(`- Generated/Updated: ${path.relative(process.cwd(), TRACE_PATH)}`);
  console.log(`- Generated/Updated: ${path.relative(process.cwd(), DRIFT_PATH)}`);
  console.log("");
  console.log("Next: npm run ssot:check");
}

main().catch((e) => {
  console.error("❌ ssot:sync failed");
  console.error(e?.stack || e);
  process.exit(1);
});
