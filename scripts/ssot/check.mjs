import fs from "node:fs/promises";
import path from "node:path";

const SSOT_DIR = path.join(process.cwd(), "docs", "SSOT");
const MANIFEST_PATH = path.join(SSOT_DIR, "SSOT_MANIFEST.json");

const COMMON_FR = [
  " le ", " la ", " les ", " des ", " du ", " une ", " un ", " et ", " ou ",
  "avec", "sans", "doit", "devrait", "exigence", "objectif", "preuve",
  "régl", "sécur", "données", "français", "anglais"
];

function hasH1(md) {
  const lines = md.split(/\r?\n/);
  return lines.some((l) => l.startsWith("# "));
}

function looksFrench(md) {
  const lower = md.toLowerCase();
  const hasAccents = /[àâäçéèêëîïôöùûüÿœ]/.test(lower);
  const hits = COMMON_FR.filter((w) => lower.includes(w)).length;
  // heuristic: accents OR multiple common words
  return hasAccents || hits >= 4;
}

async function readJson(p) {
  const raw = await fs.readFile(p, "utf-8");
  return JSON.parse(raw);
}

async function main() {
  const manifest = await readJson(MANIFEST_PATH);
  const docs = manifest.docs || [];
  const errors = [];
  const warnings = [];

  // Check doc files exist + basic lint
  for (const d of docs) {
    const p = path.join(SSOT_DIR, d.file);
    let md;
    try {
      md = await fs.readFile(p, "utf-8");
    } catch {
      errors.push(`Missing file: docs/SSOT/${d.file}`);
      continue;
    }

    if (!hasH1(md)) errors.push(`No H1 title (# ...) in ${d.file}`);

    // EN-only heuristic (warn by default; you can flip to error if you want strict)
    if (manifest.language === "en" && looksFrench(md)) {
      warnings.push(`Looks non-EN (heuristic) in ${d.file}`);
    }

    // Recommended sections (warn only)
    const lower = md.toLowerCase();
    if (!lower.includes("owned concepts") || !lower.includes("not owned")) {
      warnings.push(`Recommended sections missing in ${d.file}: "Owned Concepts" / "Not Owned"`);
    }
  }

  // Manifest ↔ folder consistency (only checks missing, not extras)
  const ssotFiles = await fs.readdir(SSOT_DIR);
  const mdFiles = ssotFiles.filter((f) => f.endsWith(".md"));
  const manifestFiles = new Set(docs.map((d) => d.file));

  for (const f of mdFiles) {
    // ignore generated or meta files if you want, but keep it visible as warning
    if (!manifestFiles.has(f) && !["SSOT_INDEX.md", "TRACEABILITY_MATRIX.md", "DRIFT_GATES.md"].includes(f)) {
      warnings.push(`MD file not in manifest: ${f}`);
    }
  }

  // Report
  if (warnings.length) {
    console.log("⚠️  ssot:check warnings:");
    for (const w of warnings) console.log(`- ${w}`);
    console.log("");
  }

  if (errors.length) {
    console.error("❌ ssot:check errors:");
    for (const e of errors) console.error(`- ${e}`);
    process.exit(1);
  }

  console.log("✅ ssot:check passed");
}

main().catch((e) => {
  console.error("❌ ssot:check failed");
  console.error(e?.stack || e);
  process.exit(1);
});
