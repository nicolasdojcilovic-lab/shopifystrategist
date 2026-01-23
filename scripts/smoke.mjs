import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const FIXTURES_DIR = path.join(ROOT, "fixtures", "smoke");
const INDEX_PATH = path.join(FIXTURES_DIR, "fixtures.index.json");

const MACRO_STAGES = [
  "normalize",
  "capture",
  "detectors",
  "scoring",
  "report",
  "render_pdf",
  "storage",
  "unknown",
];

const MISSING_EVIDENCE_REASONS = [
  "blocked_by_cookie_consent",
  "blocked_by_popup",
  "infinite_scroll_or_lazyload",
  "navigation_intercepted",
  "timeout",
  "unknown_render_issue",
];

const VERSION_KEYS = [
  "REPORT_OUTLINE_VERSION",
  "TICKET_SCHEMA_VERSION",
  "EVIDENCE_SCHEMA_VERSION",
  "CSV_EXPORT_VERSION",
  "DETECTORS_SPEC_VERSION",
  "NORMALIZE_VERSION",
  "SCORING_VERSION",
  "ENGINE_VERSION",
  "RENDER_VERSION",
];

const TICKET_CATEGORIES = [
  "offer_clarity",
  "trust",
  "media",
  "ux",
  "performance",
  "seo_basics",
  "accessibility",
  "comparison",
];

const CSV_HEADER = [
  "ticket_id",
  "mode",
  "title",
  "impact",
  "effort",
  "risk",
  "confidence",
  "category",
  "why",
  "evidence_refs",
  "how_to",
  "validation",
  "quick_win",
  "owner_hint",
  "url_context",
];

const TICKET_ALLOWED_FIELDS = new Set([
  "ticket_id",
  "mode",
  "title",
  "impact",
  "effort",
  "risk",
  "confidence",
  "category",
  "why",
  "evidence_refs",
  "how_to",
  "validation",
  "quick_win",
  "owner_hint",
  "notes",
]);

const EVIDENCE_ALLOWED_FIELDS = new Set([
  "evidence_id",
  "level",
  "type",
  "label",
  "source",
  "viewport",
  "timestamp",
  "ref",
  "details",
]);

function parseBool(value, fallback) {
  if (value === undefined) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function sha256Hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function toPosixUrl(baseUrl, endpoint) {
  if (!baseUrl) return endpoint;
  return `${baseUrl.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function writeText(filePath, text) {
  await fs.writeFile(filePath, text, "utf8");
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasHtmlId(html, idValue) {
  const regex = new RegExp(`id=["']${escapeRegex(idValue)}["']`, "i");
  return regex.test(html);
}

function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function normalizeModeSourceSet(mode) {
  if (mode === "duo_ab") {
    return new Set(["page_a", "page_b", "na"]);
  }
  if (mode === "duo_before_after") {
    return new Set(["before", "after", "na"]);
  }
  return new Set(["na"]);
}

function formatIssue(message) {
  return { severity: "P0", message };
}

function isMissingEvidenceReason(value) {
  return value === null || MISSING_EVIDENCE_REASONS.includes(value);
}

function ticketIdPattern(mode) {
  return new RegExp(
    `^T_${mode}_(?:${TICKET_CATEGORIES.join("|")})_SIG_[A-Z0-9_]+_(?:pdp|page_a|page_b|gap|before|after|diff)_[0-9]{2}$`
  );
}

function evidenceIdPattern() {
  return /^E_(page_a|page_b|before|after)_(mobile|desktop|na)_(screenshot|measurement|detection)_[a-z0-9_]+_[0-9]{2}$/;
}

function extractCsvHeader(csvText) {
  const [firstLine] = csvText.split(/\r?\n/);
  return firstLine ? firstLine.split(",") : [];
}

function shallowKeySet(obj) {
  return obj && typeof obj === "object" ? Object.keys(obj) : [];
}

function compareOrderedList(label, actual, expected, issues) {
  if (actual.length !== expected.length) {
    issues.push(
      formatIssue(`${label} count mismatch: ${actual.length} vs ${expected.length}`)
    );
    return;
  }
  for (let i = 0; i < actual.length; i += 1) {
    if (actual[i] !== expected[i]) {
      issues.push(formatIssue(`${label} order mismatch at index ${i}`));
      return;
    }
  }
}

function validateTicket(ticket, issues, mode) {
  const ticketKeys = shallowKeySet(ticket);
  for (const key of ticketKeys) {
    if (!TICKET_ALLOWED_FIELDS.has(key)) {
      issues.push(formatIssue(`Ticket has non-SSOT field: ${key}`));
    }
  }
  for (const required of [
    "ticket_id",
    "mode",
    "title",
    "impact",
    "effort",
    "risk",
    "confidence",
    "category",
    "why",
    "evidence_refs",
    "how_to",
    "validation",
    "quick_win",
    "owner_hint",
  ]) {
    if (!(required in ticket)) {
      issues.push(formatIssue(`Ticket missing required field: ${required}`));
    }
  }
  if (ticket.mode !== mode) {
    issues.push(formatIssue(`Ticket mode mismatch: ${ticket.mode} vs ${mode}`));
  }
  if (!ticketIdPattern(mode).test(ticket.ticket_id || "")) {
    issues.push(formatIssue(`Ticket ID format invalid: ${ticket.ticket_id}`));
  }
  if (!Array.isArray(ticket.evidence_refs) || ticket.evidence_refs.length < 1) {
    issues.push(formatIssue(`Ticket evidence_refs invalid: ${ticket.ticket_id}`));
  }
}

function validateEvidence(evidence, issues, mode) {
  const evidenceKeys = shallowKeySet(evidence);
  for (const key of evidenceKeys) {
    if (!EVIDENCE_ALLOWED_FIELDS.has(key)) {
      issues.push(formatIssue(`Evidence has non-SSOT field: ${key}`));
    }
  }
  for (const required of [
    "evidence_id",
    "level",
    "type",
    "label",
    "source",
    "viewport",
    "timestamp",
    "ref",
  ]) {
    if (!(required in evidence)) {
      issues.push(formatIssue(`Evidence missing required field: ${required}`));
    }
  }
  if (!evidenceIdPattern().test(evidence.evidence_id || "")) {
    issues.push(formatIssue(`Evidence ID format invalid: ${evidence.evidence_id}`));
  }
  if (!["A", "B", "C"].includes(evidence.level)) {
    issues.push(formatIssue(`Evidence level invalid: ${evidence.level}`));
  }
  if (!["screenshot", "measurement", "detection"].includes(evidence.type)) {
    issues.push(formatIssue(`Evidence type invalid: ${evidence.type}`));
  }
  if (!["mobile", "desktop", "na"].includes(evidence.viewport)) {
    issues.push(formatIssue(`Evidence viewport invalid: ${evidence.viewport}`));
  }
  if (evidence.ref !== `#evidence-${evidence.evidence_id}`) {
    issues.push(
      formatIssue(
        `Evidence ref mismatch: ${evidence.ref} vs #evidence-${evidence.evidence_id}`
      )
    );
  }
  if (mode === "solo" && evidence.source !== "page_a") {
    issues.push(formatIssue(`Evidence source invalid for solo: ${evidence.source}`));
  }
  if (mode !== "solo" && !["page_a", "page_b", "before", "after"].includes(evidence.source)) {
    issues.push(formatIssue(`Evidence source invalid: ${evidence.source}`));
  }
}

async function fetchArtifact(ref, timeoutMs) {
  if (!isHttpUrl(ref)) {
    return null;
  }
  const response = await fetchWithTimeout(ref, {}, timeoutMs);
  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status}) for ${ref}`);
  }
  return response;
}

async function runFixture(fixture, config, baselineStore, runIndexBase = 1) {
  const issues = [];
  const runs = config.runsPerFixture ?? fixture.expect?.determinism?.runs ?? 2;
  const fixtureDir = path.join(config.outDir, fixture.fixture_id);
  await ensureDir(fixtureDir);
  const fixtureHash = sha256Hex(stableStringify(fixture));

  let referenceDeterminism = null;
  let firstRunSnapshot = null;

  for (let runIndex = 0; runIndex < runs; runIndex += 1) {
    const runNumber = runIndexBase + runIndex;
    const runDir = path.join(fixtureDir, `run_${runNumber}`);
    await ensureDir(runDir);
    await writeText(
      path.join(runDir, "fixture_contract_hash.txt"),
      `${fixtureHash}\n`
    );

    const requestPayload = {
      ...fixture.request,
      render: fixture.render,
    };
    await writeJson(path.join(runDir, "request.json"), requestPayload);

    const url = toPosixUrl(config.baseUrl, fixture.endpoint);
    const headers = {
      "Content-Type": "application/json",
    };
    if (config.authHeaderName && config.authHeaderValue) {
      headers[config.authHeaderName] = config.authHeaderValue;
    }

    const runIssues = [];
    let responseStatus = null;
    let responseBody = null;
    let responseRawText = null;

    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers,
          body: JSON.stringify(requestPayload),
        },
        config.timeoutMs
      );
      responseStatus = response.status;
      responseRawText = await response.text();
      try {
        responseBody = JSON.parse(responseRawText);
      } catch (error) {
        runIssues.push(
          formatIssue(`Response not valid JSON for ${fixture.fixture_id}`)
        );
        responseBody = null;
      }
    } catch (error) {
      runIssues.push(
        formatIssue(`Request failed for ${fixture.fixture_id}: ${error.message}`)
      );
    }

    if (responseBody) {
      await writeJson(path.join(runDir, "response.json"), responseBody);
    } else {
      await writeJson(path.join(runDir, "response.json"), {
        status: responseStatus,
        raw: responseRawText,
      });
    }

    let mode = null;
    let artifacts = {};
    let reportMeta = {};
    let versions = {};
    let keys = {};
    let errors = [];
    let exportsBlock = {};
    let tickets = [];
    let evidences = [];
    let htmlContent = null;
    let htmlHash = null;
    let htmlSize = null;
    let pdfSize = null;
    let csvSize = null;

    if (!responseBody) {
      runIssues.push(formatIssue("Missing response body"));
    } else {
      const expectedStatus = fixture.expect?.status ?? "ok";
      if (responseBody.status !== expectedStatus) {
        runIssues.push(
          formatIssue(
            `Status mismatch: ${responseBody.status} vs ${expectedStatus}`
          )
        );
      }
      if (expectedStatus === "ok" && responseStatus !== 200) {
        runIssues.push(
          formatIssue(`HTTP status not 200: ${responseStatus}`)
        );
      }
      mode = responseBody.mode;
      if (mode !== fixture.expect?.mode) {
        runIssues.push(formatIssue(`Mode mismatch: ${mode}`));
      }

      artifacts = responseBody.artifacts || {};
      if (artifacts.html_ref && responseBody.status !== "ok") {
        runIssues.push(formatIssue("HTML ref present but status != ok"));
      }
      if (!artifacts.html_ref && responseBody.status === "ok") {
        runIssues.push(formatIssue("Missing artifacts.html_ref with status ok"));
      }

      reportMeta = responseBody.report_meta || {};
      const alignmentExpected = fixture.expect?.alignment_level;
      if (alignmentExpected === "null_in_solo") {
        if (reportMeta.alignment_level !== null) {
          runIssues.push(
            formatIssue(`alignment_level must be null in solo`)
          );
        }
      } else if (alignmentExpected === "enum_in_duo") {
        if (!["high", "medium", "low"].includes(reportMeta.alignment_level)) {
          runIssues.push(formatIssue(`alignment_level invalid in duo`));
        }
      }

      if (
        fixture.expect?.evidence_completeness &&
        fixture.expect.evidence_completeness !== "any"
      ) {
        if (
          reportMeta.evidence_completeness !==
          fixture.expect.evidence_completeness
        ) {
          runIssues.push(
            formatIssue(
              `evidence_completeness mismatch: ${reportMeta.evidence_completeness}`
            )
          );
        }
      }

      versions = responseBody.versions || {};
      const versionKeys = Object.keys(versions);
      if (versionKeys.length === 0) {
        runIssues.push(formatIssue("Missing versions block"));
      }
      for (const key of VERSION_KEYS) {
        if (!(key in versions)) {
          runIssues.push(formatIssue(`Missing versions.${key}`));
        }
      }
      for (const key of versionKeys) {
        if (!VERSION_KEYS.includes(key)) {
          runIssues.push(formatIssue(`Unexpected versions key: ${key}`));
        }
      }

      keys = responseBody.keys || {};
      for (const keyName of [
        "product_key",
        "snapshot_key",
        "run_key",
        "audit_key",
        "render_key",
      ]) {
        if (!keys[keyName]) {
          runIssues.push(formatIssue(`Missing keys.${keyName}`));
        }
      }

      errors = Array.isArray(responseBody.errors) ? responseBody.errors : [];
      const missingEvidenceErrors = [];
      for (const error of errors) {
        if (!MACRO_STAGES.includes(error.stage)) {
          runIssues.push(formatIssue(`Invalid error stage: ${error.stage}`));
        }
        if (!isMissingEvidenceReason(error.missing_evidence_reason)) {
          runIssues.push(
            formatIssue(
              `Invalid missing_evidence_reason: ${error.missing_evidence_reason}`
            )
          );
        }
        const allowedSources = normalizeModeSourceSet(mode);
        if (!allowedSources.has(error.source)) {
          runIssues.push(
            formatIssue(`Invalid error source for ${mode}: ${error.source}`)
          );
        }
        if (error.missing_evidence_reason) {
          missingEvidenceErrors.push(error);
        }
      }
      if (
        reportMeta.evidence_completeness === "complete" &&
        missingEvidenceErrors.length > 0
      ) {
        runIssues.push(
          formatIssue("Complete evidence_completeness with missing evidence errors")
        );
      }

      exportsBlock = responseBody.exports || {};
      tickets = Array.isArray(exportsBlock.tickets)
        ? exportsBlock.tickets
        : [];
      evidences = Array.isArray(exportsBlock.evidences)
        ? exportsBlock.evidences
        : [];
      if (expectedStatus === "ok") {
        if (!Array.isArray(exportsBlock.tickets)) {
          runIssues.push(formatIssue("Missing exports.tickets"));
        }
        if (!Array.isArray(exportsBlock.evidences)) {
          runIssues.push(formatIssue("Missing exports.evidences"));
        }
      }

      const evidenceIds = new Set(evidences.map((item) => item.evidence_id));
      for (const ticket of tickets) {
        validateTicket(ticket, runIssues, mode);
        if (Array.isArray(ticket.evidence_refs)) {
          for (const ref of ticket.evidence_refs) {
            if (!evidenceIds.has(ref)) {
              runIssues.push(
                formatIssue(
                  `Ticket evidence_ref missing from evidences: ${ref}`
                )
              );
            }
          }
        }
      }
      for (const evidence of evidences) {
        validateEvidence(evidence, runIssues, mode);
      }

      if (fixture.render?.pdf && artifacts.pdf_ref === null) {
        const hasStage = errors.some(
          (error) => error.stage === "render_pdf" || error.stage === "storage"
        );
        if (!hasStage) {
          runIssues.push(
            formatIssue("pdf_ref null without render_pdf/storage error")
          );
        }
      }
      if (fixture.render?.csv && artifacts.csv_ref === null) {
        const hasStage = errors.some((error) => error.stage === "storage");
        if (!hasStage) {
          runIssues.push(
            formatIssue("csv_ref null without storage error")
          );
        }
      }

      const htmlRequired = fixture.expect?.html_fetch_policy?.required ?? false;
      if (!config.fetchHtml && htmlRequired) {
        runIssues.push(formatIssue("HTML fetch required but SMOKE_FETCH_HTML=false"));
      }
      if (config.fetchHtml) {
        if (!artifacts.html_ref) {
          if (htmlRequired) {
            runIssues.push(formatIssue("HTML fetch required but html_ref missing"));
          }
        } else if (!isHttpUrl(artifacts.html_ref)) {
          if (htmlRequired) {
            runIssues.push(formatIssue("HTML ref is not fetchable via http(s)"));
          }
        } else {
          try {
            const htmlResponse = await fetchArtifact(
              artifacts.html_ref,
              config.timeoutMs
            );
            if (htmlResponse) {
              htmlContent = await htmlResponse.text();
              htmlHash = sha256Hex(htmlContent);
              htmlSize = htmlContent.length;
              await writeText(path.join(runDir, "report.html"), htmlContent);
            }
          } catch (error) {
            if (htmlRequired) {
              runIssues.push(
                formatIssue(`HTML fetch failed: ${error.message}`)
              );
            }
          }
        }
      }

      if (htmlContent) {
        for (const evidence of evidences) {
          const idValue = `evidence-${evidence.evidence_id}`;
          if (!hasHtmlId(htmlContent, idValue)) {
            runIssues.push(
              formatIssue(`Missing HTML evidence wrapper: ${idValue}`)
            );
          }
        }
        for (const ticket of tickets) {
          const idValue = `ticket-${ticket.ticket_id}`;
          if (!hasHtmlId(htmlContent, idValue)) {
            runIssues.push(
              formatIssue(`Missing HTML ticket wrapper: ${idValue}`)
            );
          }
        }
        if (
          reportMeta.evidence_completeness &&
          reportMeta.evidence_completeness !== "complete" &&
          fixture.expect?.missing_evidence?.must_exist_if_not_complete
        ) {
          if (!/missing evidence/i.test(htmlContent)) {
            runIssues.push(formatIssue("Missing evidence section not found"));
          }
        }
        if (missingEvidenceErrors.length > 0) {
          for (const error of missingEvidenceErrors) {
            if (
              !new RegExp(escapeRegex(error.missing_evidence_reason), "i").test(
                htmlContent
              )
            ) {
              runIssues.push(
                formatIssue(
                  `Missing evidence reason not found in HTML: ${error.missing_evidence_reason}`
                )
              );
            }
            if (
              fixture.expect?.missing_evidence?.must_detail_by_source_in_duo &&
              ["duo_ab", "duo_before_after"].includes(mode)
            ) {
              if (
                !new RegExp(escapeRegex(error.source), "i").test(htmlContent)
              ) {
                runIssues.push(
                  formatIssue(
                    `Missing evidence source not found in HTML: ${error.source}`
                  )
                );
              }
            }
          }
        }
      }

      if (artifacts.pdf_ref && isHttpUrl(artifacts.pdf_ref)) {
        try {
          const pdfResponse = await fetchArtifact(
            artifacts.pdf_ref,
            config.timeoutMs
          );
          if (pdfResponse) {
            const buffer = Buffer.from(await pdfResponse.arrayBuffer());
            pdfSize = buffer.length;
            await fs.writeFile(path.join(runDir, "report.pdf"), buffer);
          }
        } catch (error) {
          runIssues.push(formatIssue(`PDF fetch failed: ${error.message}`));
        }
      }

      if (artifacts.csv_ref && isHttpUrl(artifacts.csv_ref)) {
        try {
          const csvResponse = await fetchArtifact(
            artifacts.csv_ref,
            config.timeoutMs
          );
          if (csvResponse) {
            const csvText = await csvResponse.text();
            csvSize = csvText.length;
            await writeText(path.join(runDir, "tickets.csv"), csvText);
            const header = extractCsvHeader(csvText);
            if (header.join(",") !== CSV_HEADER.join(",")) {
              runIssues.push(formatIssue("CSV header mismatch"));
            }
          }
        } catch (error) {
          runIssues.push(formatIssue(`CSV fetch failed: ${error.message}`));
        }
      }

      const fingerprint = {
        fixture_id: fixture.fixture_id,
        fixture_contract_hash: fixtureHash,
        keys,
        versions,
        report_meta: reportMeta,
        html_hash: htmlHash,
        html_size: htmlSize,
        pdf_size: pdfSize,
        csv_size: csvSize,
        tickets_count: tickets.length,
        evidences_count: evidences.length,
        errors_count: errors.length,
      };
      await writeJson(path.join(runDir, "fingerprint.json"), fingerprint);

      let determinismMustMatch =
        fixture.expect?.determinism?.must_match || [];
      if (!config.fetchHtml) {
        determinismMustMatch = determinismMustMatch.filter(
          (item) => item !== "html_hash"
        );
      }
      const determinismSnapshot = {
        exports: stableStringify(exportsBlock),
        keys: stableStringify(keys),
        report_meta: stableStringify(reportMeta),
        html_hash: htmlHash,
        ticket_order: tickets.map((ticket) => ticket.ticket_id),
        evidence_order: evidences.map((evidence) => evidence.evidence_id),
      };
      if (!referenceDeterminism) {
        referenceDeterminism = determinismSnapshot;
      } else {
        if (determinismMustMatch.includes("exports")) {
          if (determinismSnapshot.exports !== referenceDeterminism.exports) {
            runIssues.push(formatIssue("Determinism mismatch: exports"));
          }
        }
        if (determinismMustMatch.includes("keys")) {
          if (determinismSnapshot.keys !== referenceDeterminism.keys) {
            runIssues.push(formatIssue("Determinism mismatch: keys"));
          }
        }
        if (determinismMustMatch.includes("report_meta")) {
          if (determinismSnapshot.report_meta !== referenceDeterminism.report_meta) {
            runIssues.push(formatIssue("Determinism mismatch: report_meta"));
          }
        }
        if (determinismMustMatch.includes("html_hash")) {
          if (!determinismSnapshot.html_hash || !referenceDeterminism.html_hash) {
            runIssues.push(formatIssue("Determinism mismatch: html_hash missing"));
          } else if (determinismSnapshot.html_hash !== referenceDeterminism.html_hash) {
            runIssues.push(formatIssue("Determinism mismatch: html_hash"));
          }
        }
        if (determinismMustMatch.includes("ticket_order")) {
          compareOrderedList(
            "Ticket order",
            determinismSnapshot.ticket_order,
            referenceDeterminism.ticket_order,
            runIssues
          );
        }
        if (determinismMustMatch.includes("evidence_order")) {
          compareOrderedList(
            "Evidence order",
            determinismSnapshot.evidence_order,
            referenceDeterminism.evidence_order,
            runIssues
          );
        }
      }

      const requiredStage = fixture.expect?.errors?.required_stage;
      const allowedStages = fixture.expect?.errors?.allowed_stages;
      if (requiredStage && requiredStage !== "none") {
        const hasRequired = errors.some((error) => error.stage === requiredStage);
        if (!hasRequired) {
          runIssues.push(formatIssue(`Missing required error stage: ${requiredStage}`));
        }
      }
      if (allowedStages && allowedStages !== "any") {
        for (const error of errors) {
          if (!allowedStages.includes(error.stage)) {
            runIssues.push(formatIssue(`Error stage not allowed: ${error.stage}`));
          }
        }
      }
      const requiredReason = fixture.expect?.errors?.required_missing_evidence_reason;
      if (requiredReason && requiredReason !== "none") {
        const hasReason = errors.some(
          (error) => error.missing_evidence_reason === requiredReason
        );
        if (!hasReason) {
          runIssues.push(
            formatIssue(
              `Missing required missing_evidence_reason: ${requiredReason}`
            )
          );
        }
      }
      const allowedReasons = fixture.expect?.errors?.allowed_missing_evidence_reasons;
      if (allowedReasons && allowedReasons !== "any") {
        for (const error of errors) {
          if (
            error.missing_evidence_reason &&
            !allowedReasons.includes(error.missing_evidence_reason)
          ) {
            runIssues.push(
              formatIssue(
                `Missing_evidence_reason not allowed: ${error.missing_evidence_reason}`
              )
            );
          }
        }
      }

      const assertions = {
        ok: runIssues.length === 0,
        issues: runIssues,
      };
      await writeJson(path.join(runDir, "assertions.json"), assertions);
      if (runIssues.length > 0) {
        await writeText(
          path.join(runDir, "errors.txt"),
          `${runIssues.map((issue) => issue.message).join("\n")}\n`
        );
      }

      if (!firstRunSnapshot) {
        firstRunSnapshot = {
          exports: determinismSnapshot.exports,
          run_key: keys.run_key,
          errors: stableStringify(errors),
          ticket_order: determinismSnapshot.ticket_order,
          evidence_order: determinismSnapshot.evidence_order,
        };
      }
    }

    if (!responseBody) {
      const fingerprint = {
        fixture_id: fixture.fixture_id,
        fixture_contract_hash: fixtureHash,
        keys,
        versions,
        report_meta: reportMeta,
        html_hash: htmlHash,
        html_size: htmlSize,
        pdf_size: pdfSize,
        csv_size: csvSize,
        tickets_count: tickets.length,
        evidences_count: evidences.length,
        errors_count: errors.length,
      };
      await writeJson(path.join(runDir, "fingerprint.json"), fingerprint);

      const assertions = {
        ok: runIssues.length === 0,
        issues: runIssues,
      };
      await writeJson(path.join(runDir, "assertions.json"), assertions);
      if (runIssues.length > 0) {
        await writeText(
          path.join(runDir, "errors.txt"),
          `${runIssues.map((issue) => issue.message).join("\n")}\n`
        );
      }
    }

    if (runIssues.length > 0) {
      issues.push(...runIssues);
    }
  }

  if (fixture.request?.options?.copy_ready === true) {
    const baselineKey = buildBaselineKey(fixture);
    const baseline = baselineStore.get(baselineKey);
    if (!baseline) {
      issues.push(formatIssue("Missing baseline fixture for copy_ready comparison"));
    } else if (firstRunSnapshot) {
      if (baseline.exports !== firstRunSnapshot.exports) {
        issues.push(formatIssue("copy_ready exports differ from baseline"));
      }
      if (baseline.errors !== firstRunSnapshot.errors) {
        issues.push(formatIssue("copy_ready errors differ from baseline"));
      }
      if (baseline.run_key !== firstRunSnapshot.run_key) {
        issues.push(formatIssue("copy_ready run_key differs from baseline"));
      }
      compareOrderedList(
        "copy_ready ticket order",
        firstRunSnapshot.ticket_order,
        baseline.ticket_order,
        issues
      );
      compareOrderedList(
        "copy_ready evidence order",
        firstRunSnapshot.evidence_order,
        baseline.evidence_order,
        issues
      );
    }
  } else if (firstRunSnapshot) {
    const baselineKey = buildBaselineKey(fixture);
    if (!baselineStore.has(baselineKey)) {
      baselineStore.set(baselineKey, firstRunSnapshot);
    }
  }

  return { ok: issues.length === 0, issues, fixtureHash };
}

function buildBaselineKey(fixture) {
  const requestClone = { ...fixture.request };
  if (requestClone.options && typeof requestClone.options === "object") {
    requestClone.options = { ...requestClone.options, copy_ready: false };
  }
  return stableStringify({
    endpoint: fixture.endpoint,
    request: requestClone,
    render: fixture.render,
  });
}

async function main() {
  const baseUrl = process.env.SMOKE_BASE_URL;
  if (!baseUrl) {
    console.error("Missing SMOKE_BASE_URL.");
    process.exit(1);
  }

  const profile = process.env.SMOKE_PROFILE || "pr_gate";
  if (!["pr_gate", "nightly", "all"].includes(profile)) {
    console.error(`Invalid SMOKE_PROFILE: ${profile}`);
    process.exit(1);
  }

  const fetchHtml = parseBool(process.env.SMOKE_FETCH_HTML, true);
  if (profile === "pr_gate" && !fetchHtml) {
    console.error("SMOKE_FETCH_HTML must be true for pr_gate.");
    process.exit(1);
  }

  const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 120000);
  const concurrency = Number(process.env.SMOKE_CONCURRENCY || 1);
  const outDir = path.join(
    ROOT,
    process.env.SMOKE_OUT_DIR || path.join("tmp", "smoke")
  );
  const runsPerFixtureEnv = process.env.SMOKE_RUNS_PER_FIXTURE;
  const runsPerFixture = runsPerFixtureEnv
    ? Number(runsPerFixtureEnv)
    : null;

  const failFastDefault = profile === "pr_gate";
  const failFast = parseBool(process.env.SMOKE_FAIL_FAST, failFastDefault);

  const config = {
    baseUrl,
    fetchHtml,
    timeoutMs,
    outDir,
    authHeaderName: process.env.SMOKE_AUTH_HEADER_NAME,
    authHeaderValue: process.env.SMOKE_AUTH_HEADER_VALUE,
    runsPerFixture,
  };

  const index = await readJson(INDEX_PATH);
  const fixtures = [];
  for (const entry of index) {
    if (!entry.enabled) {
      continue;
    }
    if (profile !== "all" && !entry.profiles.includes(profile)) {
      continue;
    }
    const fixturePath = path.join(FIXTURES_DIR, `${entry.fixture_id}.json`);
    const fixture = await readJson(fixturePath);
    fixtures.push(fixture);
  }

  if (fixtures.length === 0) {
    console.error("No fixtures matched profile.");
    process.exit(1);
  }

  await ensureDir(outDir);

  const baselineStore = new Map();
  const active = new Set();
  let failed = false;
  let fixtureIndex = 0;

  async function runNext() {
    while (fixtureIndex < fixtures.length) {
      if (failed && failFast) {
        return;
      }
      const fixture = fixtures[fixtureIndex];
      fixtureIndex += 1;
      const forceSerial = fixture.serial_only || fixture.request?.options?.copy_ready === true;
      if (forceSerial) {
        await Promise.all(active);
        active.clear();
        const result = await runFixture(fixture, config, baselineStore);
        if (!result.ok) {
          failed = true;
          console.error(
            `FAIL ${fixture.fixture_id}: ${result.issues.length} issue(s)`
          );
        } else {
          console.log(`OK ${fixture.fixture_id}`);
        }
        continue;
      }
      if (active.size >= Math.max(1, concurrency)) {
        await Promise.race(active);
      }
      const task = runFixture(fixture, config, baselineStore)
        .then((result) => {
          if (!result.ok) {
            failed = true;
            console.error(
              `FAIL ${fixture.fixture_id}: ${result.issues.length} issue(s)`
            );
          } else {
            console.log(`OK ${fixture.fixture_id}`);
          }
        })
        .catch((error) => {
          failed = true;
          console.error(`FAIL ${fixture.fixture_id}: ${error.message}`);
        })
        .finally(() => {
          active.delete(task);
        });
      active.add(task);
    }
  }

  await runNext();
  await Promise.all(active);

  if (failed) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
