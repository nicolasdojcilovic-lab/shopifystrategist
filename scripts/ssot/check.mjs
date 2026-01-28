import fs from "node:fs/promises";
import path from "node:path";

const SSOT_DIR = path.join(process.cwd(), "docs", "SSOT");
const MANIFEST_PATH = path.join(SSOT_DIR, "SSOT_MANIFEST.json");
const STRICT = process.env.SSOT_STRICT === "1";

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

function objectStringValues(obj) {
  if (!obj || typeof obj !== "object") return [];
  return Object.values(obj).filter((v) => typeof v === "string" && v.length > 0);
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const manifest = await readJson(MANIFEST_PATH);

  const docs = manifest.docs || [];
  const errors = [];
  const warnings = [];

  const docFiles = docs.map((d) => d.file).filter(Boolean);

  const metaFiles = objectStringValues(manifest.meta_files);
  const generatedFiles = objectStringValues(manifest.generated_artifacts);

  const alignmentFiles = [
    ...(manifest.alignment_artifacts?.recommended || []),
    ...(manifest.alignment_artifacts?.optional || [])
  ];
  const allowedFiles = new Set([...docFiles, ...metaFiles, ...generatedFiles, ...alignmentFiles]);

  // 1) Check SSOT contract docs (manifest.docs): strict checks
  for (const d of docs) {
    const p = path.join(SSOT_DIR, d.file);
    let md;

    try {
      md = await fs.readFile(p, "utf-8");
    } catch {
      errors.push(`Missing SSOT doc file (manifest.docs): docs/SSOT/${d.file}`);
      continue;
    }

    if (!hasH1(md)) errors.push(`No H1 title (# ...) in ${d.file}`);

    // EN-only heuristic for contract docs only
    if (manifest.language === "en" && looksFrench(md)) {
      warnings.push(`Looks non-EN (heuristic) in ${d.file}`);
    }

    // Recommended sections for contract docs only
    const lower = md.toLowerCase();
    if (!lower.includes("owned concepts") || !lower.includes("not owned")) {
      warnings.push(`Recommended sections missing in ${d.file}: "Owned Concepts" / "Not Owned"`);
    }
  }

  // 2) Check meta_files: must exist (errors) + H1 if markdown
  for (const f of metaFiles) {
    const p = path.join(SSOT_DIR, f);
    const exists = await fileExists(p);
    if (!exists) {
      errors.push(`Missing meta file (manifest.meta_files): docs/SSOT/${f}`);
      continue;
    }

    if (f.endsWith(".md")) {
      const md = await fs.readFile(p, "utf-8");
      if (!hasH1(md)) errors.push(`No H1 title (# ...) in meta file: ${f}`);
    }
  }

  // 3) Check generated_artifacts: warn if missing + H1 if markdown and exists
  for (const f of generatedFiles) {
    const p = path.join(SSOT_DIR, f);
    const exists = await fileExists(p);

    if (!exists) {
      warnings.push(`Generated artifact missing (manifest.generated_artifacts): ${f}`);
      continue;
    }

    if (f.endsWith(".md")) {
      const md = await fs.readFile(p, "utf-8");
      if (!hasH1(md)) warnings.push(`No H1 title (# ...) in generated artifact: ${f}`);
    }
  }

  // 4) Folder consistency: warn if there are .md not referenced anywhere
  const ssotFiles = await fs.readdir(SSOT_DIR);
  const mdFiles = ssotFiles.filter((f) => f.endsWith(".md"));

  for (const f of mdFiles) {
    if (!allowedFiles.has(f)) {
      const msg = `MD file not referenced in manifest (docs/meta/generated/alignment): ${f}`;
      if (STRICT) errors.push(msg);
      else warnings.push(msg);
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
