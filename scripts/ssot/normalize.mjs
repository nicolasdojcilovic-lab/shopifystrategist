import fs from "node:fs/promises";
import path from "node:path";

const SSOT_DIR = path.join(process.cwd(), "docs", "SSOT");
const MANIFEST_PATH = path.join(SSOT_DIR, "SSOT_MANIFEST.json");

function ensureTrailingNewline(s) {
  return s.endsWith("\n") ? s : s + "\n";
}

function detectFrontmatter(md) {
  // Simple YAML frontmatter detector
  if (!md.startsWith("---\n")) return { has: false, start: 0, end: 0 };
  const endIdx = md.indexOf("\n---\n", 4);
  if (endIdx === -1) return { has: false, start: 0, end: 0 };
  return { has: true, start: 0, end: endIdx + "\n---\n".length };
}

function hasH1(md) {
  return /^#\s+.+/m.test(md);
}

function findFirstH1Index(lines, startLineIdx) {
  for (let i = startLineIdx; i < lines.length; i++) {
    if (lines[i].startsWith("# ")) return i;
  }
  return -1;
}

function hasSection(md, title) {
  const re = new RegExp(`^##\\s+${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m");
  return re.test(md);
}

function insertAfterH1(md, insertBlock) {
  const lines = md.split(/\r?\n/);
  const fm = detectFrontmatter(md);
  let startLineIdx = 0;

  // If frontmatter exists, skip those lines for inserting H1 search
  if (fm.has) {
    const fmLines = md.slice(0, fm.end).split(/\r?\n/).length - 1;
    startLineIdx = fmLines;
  }

  const h1Idx = findFirstH1Index(lines, startLineIdx);
  if (h1Idx === -1) return md; // should not happen if we ensured H1

  // Insert after H1 and any immediate blank lines
  let insertAt = h1Idx + 1;
  while (insertAt < lines.length && lines[insertAt].trim() === "") insertAt++;

  lines.splice(insertAt, 0, ...insertBlock.trimEnd().split("\n"), "");
  return lines.join("\n");
}

async function readJson(p) {
  const raw = await fs.readFile(p, "utf-8");
  return JSON.parse(raw);
}

async function main() {
  const manifest = await readJson(MANIFEST_PATH);
  const docs = manifest.docs || [];

  let changedCount = 0;

  for (const d of docs) {
    const filePath = path.join(SSOT_DIR, d.file);
    let md = await fs.readFile(filePath, "utf-8");

    const fm = detectFrontmatter(md);

    // Ensure H1 exists somewhere; if not, insert it after frontmatter (or at top)
    if (!hasH1(md)) {
      const title = d.title || d.file.replace(/\.md$/i, "").replace(/_/g, " ");
      const v = d.version ? ` (v${d.version})` : "";
      const h1 = `# ${title}${v}\n\n`;

      if (fm.has) {
        md = md.slice(0, fm.end) + "\n" + h1 + md.slice(fm.end).replace(/^\n+/, "");
      } else {
        md = h1 + md.replace(/^\n+/, "");
      }
    }

    // Ensure standard sections exist (recommended for IA-friendly ownership boundaries)
    const needOwned = !hasSection(md, "Owned Concepts (Canonical)");
    const needNotOwned = !hasSection(md, "Not Owned (References)");

    if (needOwned || needNotOwned) {
      const block = `## Owned Concepts (Canonical)
- TBD

## Not Owned (References)
- TBD
`;
      md = insertAfterH1(md, block);
    }

    md = ensureTrailingNewline(md);

    // Write back only if changed
    const before = await fs.readFile(filePath, "utf-8");
    if (md !== before) {
      await fs.writeFile(filePath, md, "utf-8");
      changedCount++;
    }
  }

  console.log(`✅ ssot:normalize complete — updated ${changedCount}/${docs.length} docs`);
}

main().catch((e) => {
  console.error("❌ ssot:normalize failed");
  console.error(e?.stack || e);
  process.exit(1);
});
