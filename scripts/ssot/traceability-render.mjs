import fs from "node:fs/promises";

function escCell(s) {
  return String(s ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function joinArr(a) {
  return Array.isArray(a) ? a.map(escCell).join(", ") : "";
}

function sortReqId(a, b) {
  const na = Number(String(a.req_id || "").replace(/^REQ-/, ""));
  const nb = Number(String(b.req_id || "").replace(/^REQ-/, ""));
  return (isNaN(na) ? 1e9 : na) - (isNaN(nb) ? 1e9 : nb);
}

async function main() {
  const [jsonPath, mdPath] = process.argv.slice(2);
  if (!jsonPath || !mdPath) {
    console.error("Usage: node scripts/SSOT/traceability-render.mjs <draft.json> <TRACEABILITY_MATRIX.md>");
    process.exit(1);
  }

  const draft = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  const rows = (draft.rows || []).slice().sort(sortReqId);

  const md = await fs.readFile(mdPath, "utf8");
  const begin = "<!-- GENERATED: TRACEABILITY_DRAFT_BEGIN -->";
  const end = "<!-- GENERATED: TRACEABILITY_DRAFT_END -->";

  const bi = md.indexOf(begin);
  const ei = md.indexOf(end);

  if (bi === -1 || ei === -1 || ei < bi) {
    console.error("Missing or invalid GENERATED markers in TRACEABILITY_MATRIX.md");
    process.exit(1);
  }

  const outLines = [];
  for (const r of rows) {
    outLines.push(
      `| ${escCell(r.req_id)} | ${escCell(r.requirement)} | ${joinArr(r.spec_refs)} | ${joinArr(r.ssot_refs)} | ${joinArr(r.registry_refs)} | ${joinArr(r.code_refs)} | ${joinArr(r.smoke_refs)} | ${escCell(r.status)} | ${escCell(r.notes)} |`
    );
  }

  const injected =
    md.slice(0, bi + begin.length) +
    "\n" +
    outLines.join("\n") +
    "\n" +
    md.slice(ei);

  await fs.writeFile(mdPath, injected, "utf8");
  console.log(`[traceability-render] injected ${rows.length} rows into ${mdPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
