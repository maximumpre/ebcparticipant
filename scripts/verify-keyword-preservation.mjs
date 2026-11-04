#!/usr/bin/env node
/**
 * verify-keyword-preservation.mjs — Step 5 keyword-preservation gate (EBC Flex).
 *
 * HARD CHECKS (any failure => non-zero exit + clear diff):
 *  (a) PRESERVATION: every baseline literal in
 *      `research/seo-keywords.baseline.txt` still exists verbatim in
 *      `lib/seo-keywords.ts` — as a quoted string/template literal or (for the
 *      computed entries) as its bare expression. Zero deletions allowed
 *      (Absolute Keyword Preservation Rule: judged on the meta ∪ body union).
 *  (b) VISIBLE FEED HYGIENE: zero host/domain-shaped tokens
 *      (regex /\.com|\.net|http/i) inside the visible / `Related searches:`
 *      arrays — the STEP5_RERUN_20261102_KEYWORDS block must be clean, and the
 *      effective visible feed (all module literals after the
 *      lib/seo-metadata.ts hasUrlChrome() meta/visible split) must contain zero
 *      domain-shaped tokens. Also asserts every new visible literal actually
 *      reaches the visible feed (flows into SITE_VISIBLE_KEYWORDS).
 *  (c) META QUARANTINE: the STEP5_RERUN_20261102_META_HOST_KEYWORDS host tokens
 *      exist, are host/domain-shaped (so lib/seo-metadata.ts filters them out of
 *      SITE_VISIBLE_KEYWORDS), never appear in the visible block, and are wired
 *      into buildSiteKeywords() so they reach <meta name="keywords"> only.
 *
 * SOFT OUTPUT (informational, never fails the gate): per-block literal counts,
 * per-cluster counts of the STEP5_RERUN block, baseline vs current totals.
 *
 * Usage:
 *   node scripts/verify-keyword-preservation.mjs                    # verify (exit 0/1)
 *   node scripts/verify-keyword-preservation.mjs --snapshot <path> [--source <path>|--source -]
 *      (run --snapshot BEFORE any additive edit — or against the pristine
 *       pre-edit source via --source — it is the frozen anchor)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { resolve, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const KEYWORDS_REL = "lib/seo-keywords.ts"
const SEO_META_REL = "lib/seo-metadata.ts"
const BASELINE_REL = "research/seo-keywords.baseline.txt"

const VISIBLE_BLOCK = "STEP5_RERUN_20261102_KEYWORDS"
const META_BLOCK = "STEP5_RERUN_20261102_META_HOST_KEYWORDS"

/** Task-mandated host/domain-shaped token regex for the visible-feed check. */
const HOST_SHAPED = /\.com|\.net|http/i

/**
 * Resolution of the computed keyword entries (lib/site-url.ts,
 * lib/project-config.ts) so the effective visible feed can be emulated.
 */
const EXPR_VALUES = {
  SITE_DISPLAY_NAME: "EBC Flex",
  PROJECT_DISPLAY_NAME: "EBC Flex Participant Portal",
  DEFAULT_SITE_TITLE: "Login | EBC Flex Participant Portal",
  CANONICAL_HOST: "www.portal-ebcflexs.com",
}

// ---------------------------------------------------------------------------
// Source parsing (quote-aware, comment-aware)
// ---------------------------------------------------------------------------

/** Strip // and /* *\/ comments outside string/template literals. */
function stripComments(src) {
  let out = ""
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    const c2 = src[i + 1]
    if (c === "/" && c2 === "/") {
      while (i < n && src[i] !== "\n") i++
    } else if (c === "/" && c2 === "*") {
      i += 2
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++
      i += 2
    } else if (c === '"' || c === "'" || c === "`") {
      const q = c
      out += c
      i++
      while (i < n) {
        if (src[i] === "\\") {
          out += src[i] + (src[i + 1] ?? "")
          i += 2
          continue
        }
        out += src[i]
        if (src[i] === q) {
          i++
          break
        }
        i++
      }
    } else {
      out += c
      i++
    }
  }
  return out
}

/** Split array-body text into top-level entries (quote- and bracket-aware). */
function splitEntries(body) {
  const entries = []
  let cur = ""
  let depth = 0
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === '"' || c === "'" || c === "`") {
      const q = c
      cur += c
      i++
      while (i < body.length && body[i] !== q) {
        if (body[i] === "\\") {
          cur += body[i]
          i++
        }
        cur += body[i]
        i++
      }
      if (i < body.length) cur += body[i]
      continue
    }
    if (c === "(" || c === "[" || c === "{") depth++
    if (c === ")" || c === "]" || c === "}") depth--
    if (c === "," && depth === 0) {
      entries.push(cur.trim())
      cur = ""
      continue
    }
    cur += c
  }
  if (cur.trim()) entries.push(cur.trim())
  return entries.filter(Boolean)
}

/**
 * Extract every `const NAME = [ ... ] as const` block.
 * Returns [{ name, entries: [{ type: "string"|"template"|"expr", text }] }]
 * where `text` is the raw inner literal or the raw expression source.
 */
function extractArrayBlocks(src) {
  const blocks = []
  const re = /(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*=\s*\[/g
  let m
  while ((m = re.exec(src))) {
    const name = m[1]
    const openIdx = m.index + m[0].length - 1
    let i = openIdx + 1
    let depth = 1
    while (i < src.length && depth > 0) {
      const c = src[i]
      if (c === '"' || c === "'" || c === "`") {
        const q = c
        i++
        while (i < src.length && src[i] !== q) {
          if (src[i] === "\\") i++
          i++
        }
        i++
        continue
      }
      if (c === "[" || c === "(" || c === "{") depth++
      else if (c === "]" || c === ")" || c === "}") depth--
      i++
    }
    const body = src.slice(openIdx + 1, i - 1)
    const entries = splitEntries(body).map((raw) => classifyEntry(raw))
    blocks.push({ name, entries })
    re.lastIndex = i
  }
  return blocks
}

function classifyEntry(raw) {
  const dq = /^"((?:[^"\\]|\\.)*)"$/.exec(raw)
  if (dq) return { type: "string", text: dq[1] }
  const sq = /^'((?:[^'\\]|\\.)*)'$/.exec(raw)
  if (sq) return { type: "string", text: sq[1] }
  const bq = /^`((?:[^`\\]|\\.)*)`$/.exec(raw)
  if (bq) return { type: "template", text: bq[1] }
  return { type: "expr", text: raw }
}

/** Resolve an entry to its runtime keyword value (best effort, for feed emulation). */
function resolveEntry(entry) {
  if (entry.type !== "expr") return resolveTemplate(entry.text)
  const mapped = EXPR_VALUES[entry.text]
  return mapped ?? entry.text
}

function resolveTemplate(text) {
  return text.replace(/\$\{([A-Za-z0-9_]+)([^}]*)\}/g, (whole, ident, rest) => {
    const base = EXPR_VALUES[ident] ?? ident
    if (!rest) return base
    // e.g. ${CANONICAL_HOST.replace(/^www\./, "")}
    if (/^\.replace\(\s*\/\^www\\\.\/\s*,\s*""\s*\)$/.test(rest)) {
      return base.replace(/^www\./, "")
    }
    return whole
  })
}

/**
 * Mirror of lib/seo-metadata.ts hasUrlChrome() — URL chrome and domain-shaped
 * tokens are meta-only, never visible body copy. Kept in sync deliberately:
 * the gate asserts the live filter still exists in seo-metadata.ts too.
 */
function hasUrlChrome(keyword) {
  return (
    /https?:\/\//i.test(keyword) ||
    keyword.includes("/") ||
    /\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|gov|edu|co|us|uk|biz|info|ai|app|dev)\b/i.test(keyword)
  )
}

// ---------------------------------------------------------------------------
// Baseline literal-line semantics
// ---------------------------------------------------------------------------

/** Baseline line for one entry: raw literal text, or raw expression source. */
function baselineLine(entry) {
  return entry.text
}

/** True when the line is a computed expression (allowed bare in source). */
function isExpressionLine(line) {
  return (
    /^[A-Za-z_$][A-Za-z0-9_$.]*(\(.*\))?$/.test(line) &&
    /[_$.(]/.test(line)
  )
}

function literalExistsInSource(line, strippedSrc) {
  const quoted =
    strippedSrc.includes(`"${line}"`) ||
    strippedSrc.includes(`'${line}'`) ||
    strippedSrc.includes("`" + line + "`")
  if (quoted) return true
  if (isExpressionLine(line) && strippedSrc.includes(line)) return true
  return false
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2)
  const snapshotIdx = args.indexOf("--snapshot")
  const sourceIdx = args.indexOf("--source")
  const keywordsPath = join(ROOT, KEYWORDS_REL)
  const baselinePath =
    snapshotIdx >= 0 && args[snapshotIdx + 1]
      ? resolve(args[snapshotIdx + 1])
      : join(ROOT, BASELINE_REL)

  let raw
  let sourceLabel = KEYWORDS_REL
  if (sourceIdx >= 0 && args[sourceIdx + 1] === "-") {
    raw = readFileSync(0, "utf8")
    sourceLabel = "<stdin>"
  } else if (sourceIdx >= 0 && args[sourceIdx + 1]) {
    raw = readFileSync(resolve(args[sourceIdx + 1]), "utf8")
    sourceLabel = args[sourceIdx + 1]
  } else {
    raw = readFileSync(keywordsPath, "utf8")
  }
  const src = stripComments(raw)
  const blocks = extractArrayBlocks(src)

  if (snapshotIdx >= 0) {
    const lines = [
      ...new Set(blocks.flatMap((b) => b.entries.map(baselineLine))),
    ].sort()
    writeFileSync(baselinePath, lines.join("\n") + "\n", "utf8")
    console.log(`SNAPSHOT WRITTEN: ${baselinePath}`)
    console.log(`source: ${sourceLabel}`)
    console.log(`blocks: ${blocks.length}, literal entries: ${blocks.reduce((n, b) => n + b.entries.length, 0)}, unique lines: ${lines.length}`)
    for (const b of blocks) console.log(`  ${b.name}: ${b.entries.length}`)
    return 0
  }

  const failures = []
  const warn = []

  // ---- (a) preservation -----------------------------------------------------
  if (!existsSync(baselinePath)) {
    failures.push(`(a) baseline missing: ${BASELINE_REL} — run with --snapshot first`)
  } else {
    const baseline = readFileSync(baselinePath, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
    const missing = baseline.filter((line) => !literalExistsInSource(line, src))
    if (missing.length) {
      failures.push(
        `(a) KEYWORD DELETION DETECTED — ${missing.length} baseline literal(s) missing from ${KEYWORDS_REL}:`,
        ...missing.map((l) => `    - MISSING: ${JSON.stringify(l)}`),
      )
    }
    console.log(
      `(a) preservation: ${baseline.length - missing.length}/${baseline.length} baseline literals present verbatim`,
    )
  }

  // ---- (b) visible / Related-searches hygiene -------------------------------
  const visibleBlock = blocks.find((b) => b.name === VISIBLE_BLOCK)
  const metaBlock = blocks.find((b) => b.name === META_BLOCK)

  if (!visibleBlock) {
    failures.push(`(b) block ${VISIBLE_BLOCK} not found in ${KEYWORDS_REL}`)
  } else {
    const dirty = visibleBlock.entries.filter((e) => HOST_SHAPED.test(e.text))
    if (dirty.length) {
      failures.push(
        `(b) HOST-SHAPED TOKEN IN VISIBLE BLOCK ${VISIBLE_BLOCK} (${dirty.length}):`,
        ...dirty.map((e) => `    - DIRTY: ${JSON.stringify(e.text)}`),
      )
    }
    const all = blocks.flatMap((b) => b.entries)
    const resolvedVisible = all.map(resolveEntry).filter((k) => !hasUrlChrome(k))
    const leaked = resolvedVisible.filter((k) => HOST_SHAPED.test(k))
    if (leaked.length) {
      failures.push(
        `(b) HOST-SHAPED TOKEN IN EFFECTIVE VISIBLE FEED (SITE_VISIBLE_KEYWORDS) (${leaked.length}):`,
        ...leaked.map((k) => `    - LEAK: ${JSON.stringify(k)}`),
      )
    }
    const notReaching = visibleBlock.entries
      .map(resolveEntry)
      .filter((k) => hasUrlChrome(k))
    if (notReaching.length) {
      failures.push(
        `(b) ${notReaching.length} literal(s) of ${VISIBLE_BLOCK} would be filtered OUT of SITE_VISIBLE_KEYWORDS (never reach Related searches):`,
        ...notReaching.map((k) => `    - STRANDED: ${JSON.stringify(k)}`),
      )
    }
    console.log(
      `(b) visible feed: ${resolvedVisible.length} body-safe keywords, ${leaked.length} host-shaped leak(s)`,
    )
  }

  // ---- (c) meta-only host token quarantine ---------------------------------
  if (!metaBlock) {
    failures.push(`(c) block ${META_BLOCK} not found in ${KEYWORDS_REL}`)
  } else {
    const notHost = metaBlock.entries.filter((e) => !hasUrlChrome(resolveEntry(e)))
    if (notHost.length) {
      failures.push(
        `(c) ${META_BLOCK} entry not host/domain-shaped (would flow into visible body):`,
        ...notHost.map((e) => `    - NOT-META: ${JSON.stringify(e.text)}`),
      )
    }
    const visibleTexts = new Set((visibleBlock?.entries ?? []).map((e) => e.text.toLowerCase()))
    const inVisible = metaBlock.entries.filter((e) => visibleTexts.has(e.text.toLowerCase()))
    if (inVisible.length) {
      failures.push(
        `(c) META-ONLY token also present in visible block ${VISIBLE_BLOCK}:`,
        ...inVisible.map((e) => `    - CROSSOVER: ${JSON.stringify(e.text)}`),
      )
    }
    const buildMatch = /function\s+buildSiteKeywords\s*\([^)]*\)\s*:\s*[^{]+\{([\s\S]*?)\n\}/.exec(src)
    const buildBody = buildMatch ? buildMatch[1] : ""
    if (!buildBody.includes(VISIBLE_BLOCK) || !buildBody.includes(META_BLOCK)) {
      failures.push(
        `(c) buildSiteKeywords() does not merge ${VISIBLE_BLOCK} and/or ${META_BLOCK} — new block not wired into SITE_KEYWORDS`,
      )
    }
    console.log(
      `(c) meta quarantine: ${metaBlock.entries.length} meta-only host token(s), ${inVisible.length} crossover(s)`,
    )
  }

  // ---- (d) split-rule regression guard on lib/seo-metadata.ts ---------------
  const seoMetaPath = join(ROOT, SEO_META_REL)
  if (existsSync(seoMetaPath)) {
    const metaSrc = readFileSync(seoMetaPath, "utf8")
    if (!/export const SITE_VISIBLE_KEYWORDS/.test(metaSrc) || !/hasUrlChrome/.test(metaSrc)) {
      failures.push(
        `(d) ${SEO_META_REL} lost the SITE_VISIBLE_KEYWORDS export or the hasUrlChrome() meta/visible split`,
      )
    }
  } else {
    warn.push(`(d) ${SEO_META_REL} not found — split guard skipped`)
  }

  // ---- soft summary ---------------------------------------------------------
  const totalEntries = blocks.reduce((n, b) => n + b.entries.length, 0)
  const unique = new Set(blocks.flatMap((b) => b.entries.map((e) => e.text.toLowerCase())))
  console.log(`---- summary: ${blocks.length} blocks, ${totalEntries} literal entries, ${unique.size} unique (case-insensitive)`)
  for (const b of blocks) console.log(`  ${b.name}: ${b.entries.length}`)
  for (const w of warn) console.log(`WARN ${w}`)

  if (failures.length) {
    console.error(`\nFAIL — keyword preservation gate (${failures.length} finding(s)):`)
    for (const f of failures) console.error(f)
    console.error(`\nDIFF: baseline literals above were deleted or host tokens leaked into visible copy.`)
    console.error(`Restore them (append-only edits only) and re-run: node scripts/verify-keyword-preservation.mjs`)
    return 1
  }
  console.log(`\nPASS — all baseline literals preserved; visible feed host-free; meta tokens quarantined.`)
  return 0
}

process.exit(main())
