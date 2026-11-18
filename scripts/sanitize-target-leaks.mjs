#!/usr/bin/env node
/**
 * sanitize-target-leaks.mjs
 *
 * Autonomous Universal Target Leakage & Foreign Email Sanitizer (v3.2 Production Sealed).
 * Scans astro-src/pages, astro-src/layouts, lib/seo-faq.ts, lib/seo-metadata.ts,
 * scripts/generate-llms-txt.mjs, and components to detect and neutralize:
 * 1. ANY email mailbox ending in the target apex domain (*@target.com, *@*.target.com).
 * 2. ANY outbound target URL (https://*.target.com/*) on secondary utility pages.
 * 3. Out-of-domain footer links or raw apex domain anchors.
 * 4. Prose bare domain & subdomain mentions (faq.target.com, target.com).
 * 5. String literal interpolation defects (prevents raw "{getMemberSupportEmail()}" in HTML).
 *
 * Multi-Source Apex Detection:
 * - Detects target apex domain from crawler-seo.astro header, seo-intelligence.json, CLI flag,
 *   or site-url.ts (supports both root and src/ directory structures).
 * - Whitelists legitimate regulatory disclosures (sec.gov, finra.org, sipc.org, irs.gov).
 *
 * Usage:
 *   node scripts/sanitize-target-leaks.mjs               # Audit mode (exits 1 if leaks found)
 *   node scripts/sanitize-target-leaks.mjs --fix         # Auto-remediate all discovered leaks
 *   node scripts/sanitize-target-leaks.mjs --self-test   # Run unit assertion suite
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

// ---------------------------------------------------------------------------
// 1. Core Regex & Mapping Logic
// ---------------------------------------------------------------------------

export const REGULATORY_WHITELIST = [
  "sec.gov",
  "finra.org",
  "sipc.org",
  "irs.gov",
  "treasury.gov",
  "fdic.gov",
  "consumerfinance.gov",
]

export function extractApexDomain(rawUrlOrDomain) {
  if (!rawUrlOrDomain) return null
  let str = String(rawUrlOrDomain).trim().toLowerCase()
  try {
    if (str.startsWith("http://") || str.startsWith("https://")) {
      str = new URL(str).hostname
    }
  } catch {
    // fallback to string manipulation
  }
  str = str.replace(/:\d+$/, "").replace(/^\.+|\.+$/g, "")
  const parts = str.split(".")
  if (parts.length <= 2) return str
  return parts.slice(-2).join(".")
}

export function buildTargetRegexes(apexDomain) {
  if (!apexDomain) return null
  const escaped = apexDomain.replace(/\./g, "\\.")
  return {
    // Matches ANY mailbox: support@, help@, info@, billing@, compliance@, care@, etc.
    email: new RegExp(`[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9.-]+\\.)?${escaped}`, "gi"),
    // Matches ANY URL pointing to target apex or subdomains
    url: new RegExp(`https?:\\/\\/(?:[a-zA-Z0-9.-]+\\.)?${escaped}(?:\\/[^\\s"'>]*)?`, "gi"),
    // Matches raw target domain anchor text: >target.com< or >www.target.com<
    rawAnchor: new RegExp(`>\\s*(?:https?:\\/\\/)?(?:www\\.)?${escaped}\\s*<`, "gi"),
    // Matches bare target subdomain or apex in prose text
    bareSubdomain: new RegExp(`\\b(?:faq|help|support|app|login)\\.${escaped}\\b`, "gi"),
    bareApex: new RegExp(`(?:\\bon|\\bat)\\s+${escaped}\\b`, "gi"),
  }
}

export function isWhitelistedUrl(url) {
  const lower = url.toLowerCase()
  return REGULATORY_WHITELIST.some(domain => lower.includes(domain))
}

export function mapTargetUrlToInternalRoute(targetUrl) {
  if (isWhitelistedUrl(targetUrl)) {
    return targetUrl // preserve regulatory links
  }
  const lower = targetUrl.toLowerCase()
  if (/(?:faq|help|knowledge|support|learn|docs|guide|insights)/.test(lower)) {
    return "/faq"
  }
  if (/(?:price|pricing|fee|rates|cost)/.test(lower)) {
    return "/fee-schedule"
  }
  if (/(?:privacy|terms|legal|disclose|compliance|security)/.test(lower)) {
    return "/compliance"
  }
  if (/(?:form|packet|application|download)/.test(lower)) {
    return "/forms"
  }
  if (/(?:about|history|leadership|team|story)/.test(lower)) {
    return "/about"
  }
  if (/(?:contact|reach)/.test(lower)) {
    return "/contact"
  }
  // Default fallback is portal root / sign-in
  return "/"
}

export function sanitizeContent(content, apexDomain, isCrawlerTwin = false, filePath = "") {
  if (!apexDomain) return content
  const escaped = apexDomain.replace(/\./g, "\\.")
  const { email, url, rawAnchor, bareSubdomain, bareApex } = buildTargetRegexes(apexDomain)
  const isTs = filePath.endsWith(".ts")
  const isTsx = filePath.endsWith(".tsx") || isTs
  const isAstro = filePath.endsWith(".astro")
  const isLlmsTxt = filePath.endsWith(".txt")
  const isLlmsScript = filePath.includes("generate-llms-txt.mjs")
  const isSeoFaq = filePath.includes("seo-faq.ts")

  let sanitized = content

  // 1. Sanitize raw text discovery files (llms.txt, llms-full.txt)
  if (isLlmsTxt) {
    sanitized = sanitized.replace(email, "support@${CANONICAL_HOST}")
    sanitized = sanitized.replace(url, (matchedUrl) => mapTargetUrlToInternalRoute(matchedUrl))
    sanitized = sanitized.replace(bareSubdomain, "/faq")
    return sanitized
  }

  // 2. Pre-clean existing raw expression errors: {getMemberSupportEmail()} inside backticks or quotes
  sanitized = sanitized.replace(/`([^`]*?)(?<!\$)\{getMemberSupportEmail\(\)\}([^`]*)`/g, "`$1${getMemberSupportEmail()}$2`")
  sanitized = sanitized.replace(/"([^"\n]*?)(?:\$\{|\{)getMemberSupportEmail\(\)\}([^"\n]*)"/g, "`$1${getMemberSupportEmail()}$2`")
  sanitized = sanitized.replace(/'([^'\n]*?)(?:\$\{|\{)getMemberSupportEmail\(\)\}([^'\n]*)'/g, "`$1${getMemberSupportEmail()}$2`")
  sanitized = sanitized.replace(/\$\$\{getMemberSupportEmail\(\)\}/g, "${getMemberSupportEmail()}")

  // 3. Target Email Sanitization (Context-Aware)
  if (isLlmsScript || isSeoFaq) {
    // In node scripts / data modules: replace with dynamic interpolation
    sanitized = sanitized.replace(email, () => "${getMemberSupportEmail()}")
    // If inside standard double quotes: convert quotes to backticks
    sanitized = sanitized.replace(new RegExp(`"([^"\\n]*)\\$\{getMemberSupportEmail\\(\\)\}([^"\\n]*)"`, "g"), "`$1${getMemberSupportEmail()}$2`")
    sanitized = sanitized.replace(new RegExp(`'([^'\\n]*)\\$\{getMemberSupportEmail\\(\\)\}([^'\\n]*)'`, "g"), "`$1${getMemberSupportEmail()}$2`")
  } else if (isTsx) {
    // In TS/TSX structured data: email: "support@domain.com" -> email: getMemberSupportEmail()
    sanitized = sanitized.replace(
      new RegExp(`(email\\s*:\\s*)["']${email.source}["']`, "gi"),
      "$1getMemberSupportEmail()"
    )
    sanitized = sanitized.replace(email, () => "{getMemberSupportEmail()}")
  } else if (isAstro) {
    // In Astro files: check if match is inside frontmatter (--- ... ---) or HTML markup
    const fmMatch = sanitized.match(/^---\n([\s\S]*?)\n---/)
    if (fmMatch) {
      let fm = fmMatch[1]
      // In frontmatter backticks:
      fm = fm.replace(new RegExp(`\`([^\`]*)${email.source}([^\`]*)\``, "gi"), "`$1${getMemberSupportEmail()}$2`")
      // In frontmatter double quotes: convert quotes to backticks with ${getMemberSupportEmail()}
      fm = fm.replace(new RegExp(`"([^"\\n]*)${email.source}([^"\\n]*)"`, "gi"), "`$1${getMemberSupportEmail()}$2`")
      // In frontmatter single quotes: convert to backticks
      fm = fm.replace(new RegExp(`'([^'\\n]*)${email.source}([^'\\n]*)'`, "gi"), "`$1${getMemberSupportEmail()}$2`")
      sanitized = sanitized.replace(fmMatch[0], `---\n${fm}\n---`)
    }
    // In HTML markup:
    sanitized = sanitized.replace(email, () => "{getMemberSupportEmail()}")
    // Also clean raw mailto: expressions if wrapped in quotes
    sanitized = sanitized.replace(
      /href=["']mailto:\{getMemberSupportEmail\(\)\}["']/g,
      'href={`mailto:${getMemberSupportEmail()}`}'
    )
  } else {
    sanitized = sanitized.replace(email, () => "{getMemberSupportEmail()}")
  }

  // 4. Outbound Target URLs & Anchors (Skip Crawler Twin simulated links)
  if (!isCrawlerTwin) {
    sanitized = sanitized.replace(url, (matchedUrl) => {
      return mapTargetUrlToInternalRoute(matchedUrl)
    })
    // Sanitize raw target domain anchor text: >carry.com< -> >{SITE_DISPLAY_NAME}<
    sanitized = sanitized.replace(rawAnchor, ">{SITE_DISPLAY_NAME}<")

    // 5. Bare Domain & Subdomain Prose Sanitization on secondary pages
    // faq.target.com -> the help centre at /faq
    sanitized = sanitized.replace(
      new RegExp(`(?:https?:\\/\\/)?(?:at\\s+)?(?:faq|help|support)\\.${escaped}(?:\\/)?`, "gi"),
      "the help centre at /faq"
    )
    // on/at target.com -> in the member portal
    sanitized = sanitized.replace(
      new RegExp(`(?:on|at)\\s+(?:www\\.)?${escaped}\\b`, "gi"),
      "in the member portal"
    )
  }

  // 6. Ensure getMemberSupportEmail is imported if referenced
  if (
    sanitized.includes("getMemberSupportEmail") &&
    !/import\s*\{[^}]*getMemberSupportEmail[^}]*\}\s*from/i.test(sanitized)
  ) {
    if (/import\s*\{[^}]*SITE_DISPLAY_NAME[^}]*\}\s*from\s*["']@\/lib\/site-url["']/.test(sanitized)) {
      sanitized = sanitized.replace(
        /(import\s*\{[^}]*SITE_DISPLAY_NAME[^}]*\}\s*from\s*["']@\/lib\/site-url["'])/,
        (match) => match.replace("SITE_DISPLAY_NAME", "SITE_DISPLAY_NAME, getMemberSupportEmail")
      )
    } else if (/import\s*\{[^}]*\}\s*from\s*["']@\/lib\/site-url["']/.test(sanitized)) {
      sanitized = sanitized.replace(
        /(import\s*\{)([^}]*)(\}\s*from\s*["']@\/lib\/site-url["'])/,
        "$1$2, getMemberSupportEmail$3"
      )
    } else if (sanitized.startsWith("---")) {
      sanitized = sanitized.replace(
        "---",
        '---\nimport { getMemberSupportEmail } from "@/lib/site-url"'
      )
    } else {
      sanitized = 'import { getMemberSupportEmail } from "@/lib/site-url"\n' + sanitized
    }
  }

  return sanitized
}

// ---------------------------------------------------------------------------
// 2. Self-Test Suite (--self-test)
// ---------------------------------------------------------------------------

function runSelfTest() {
  console.log(">>> [sanitize-target-leaks] Running universal self-test suite (v3.2)...")
  const domain = "carry.com"
  const apex = extractApexDomain(domain)
  if (apex !== "carry.com") throw new Error(`Apex extraction failed: got ${apex}`)

  // Test 1: Diverse Mailboxes
  const testEmails = [
    "support@carry.com",
    "help@carry.com",
    "info@carry.com",
    "billing@app.carry.com",
    "compliance@faq.carry.com",
    "care@carry.com",
  ]
  for (const mail of testEmails) {
    const res = sanitizeContent(mail, apex)
    if (res.includes("carry.com")) {
      throw new Error(`Failed to sanitize mailbox ${mail}: output=${res}`)
    }
  }
  console.log("  PASS 1: Universal dynamic mailbox matching verified")

  // Test 2: Diverse Target URLs mapped to internal routes
  const testUrls = [
    { input: "https://carry.com/pricing", expected: "/fee-schedule" },
    { input: "https://faq.carry.com/article/solo-401k", expected: "/faq" },
    { input: "https://carry.com/privacy-policy", expected: "/compliance" },
    { input: "https://carry.com/forms/rollover", expected: "/forms" },
    { input: "https://app.carry.com/login", expected: "/" },
    { input: "https://carry.com/", expected: "/" },
  ]
  for (const t of testUrls) {
    const res = mapTargetUrlToInternalRoute(t.input)
    if (res !== t.expected) {
      throw new Error(`Failed to map ${t.input}: expected ${t.expected}, got ${res}`)
    }
  }
  console.log("  PASS 2: Dynamic URL internal route mapping verified")

  // Test 3: ASTRO template content transformation & import injection
  const mockAstro = `
    import { SITE_DISPLAY_NAME } from "@/lib/site-url"
    <a href="mailto:support@carry.com">support@carry.com</a>
    <a href="https://faq.carry.com/">Help Center</a>
    <a href="https://carry.com/privacy-policy">Privacy</a>
  `
  const sanitizedAstro = sanitizeContent(mockAstro, apex, false, "contact.astro")
  if (sanitizedAstro.includes("carry.com")) {
    throw new Error(`Astro content still contains carry.com: ${sanitizedAstro}`)
  }
  if (!sanitizedAstro.includes("/faq") || !sanitizedAstro.includes("/compliance")) {
    throw new Error(`Astro content missing internal mapped routes: ${sanitizedAstro}`)
  }
  if (!sanitizedAstro.includes("getMemberSupportEmail")) {
    throw new Error(`Astro content failed to inject getMemberSupportEmail import: ${sanitizedAstro}`)
  }
  console.log("  PASS 3: Full Astro template transformation & import injection verified")

  // Test 4: Regulatory Whitelist
  const regUrl = "https://www.sec.gov/edgar/searchedgar/companysearch"
  const mappedReg = mapTargetUrlToInternalRoute(regUrl)
  if (mappedReg !== regUrl) {
    throw new Error(`Regulatory URL was erroneously transformed: ${mappedReg}`)
  }
  console.log("  PASS 4: Regulatory disclosure whitelist preserved")

  // Test 5: Structured Data TSX Transformation
  const mockTsx = `
    import { SITE_DISPLAY_NAME } from "@/lib/site-url"
    export function StructuredData() {
      const contact = {
        email: "support@carry.com",
        url: "https://faq.carry.com",
      }
    }
  `
  const sanitizedTsx = sanitizeContent(mockTsx, apex, false, "structured-data.tsx")
  if (sanitizedTsx.includes("carry.com")) {
    throw new Error(`TSX content still contains carry.com: ${sanitizedTsx}`)
  }
  if (!sanitizedTsx.includes("email: getMemberSupportEmail()")) {
    throw new Error(`TSX content missing function call: ${sanitizedTsx}`)
  }
  console.log("  PASS 5: TSX structured data transformation verified")

  // Test 6: Frontmatter string interpolation (Prevents raw expression in HTML)
  const mockFmAstro = `---
const pageDesc = "How to reach member support: email support@carry.com for help."
const badDesc = \`Contact us at {getMemberSupportEmail()} today.\`
---
<p>{pageDesc}</p>`
  const sanitizedFmAstro = sanitizeContent(mockFmAstro, apex, false, "contact.astro")
  if (sanitizedFmAstro.includes("{getMemberSupportEmail()}") && !sanitizedFmAstro.includes("${getMemberSupportEmail()}")) {
    throw new Error(`Astro frontmatter failed to interpolate template expression: ${sanitizedFmAstro}`)
  }
  if (!sanitizedFmAstro.includes("${getMemberSupportEmail()}")) {
    throw new Error(`Astro frontmatter missing proper \${getMemberSupportEmail()}: ${sanitizedFmAstro}`)
  }
  console.log("  PASS 6: Astro frontmatter template interpolation verified")

  // Test 7: Prose bare domain & subdomain sanitization
  const mockProse = `<p>Check the articles at faq.carry.com and documents published on carry.com.</p>`
  const sanitizedProse = sanitizeContent(mockProse, apex, false, "resources.astro")
  if (sanitizedProse.includes("faq.carry.com") || sanitizedProse.includes("carry.com")) {
    throw new Error(`Prose still contains bare domain/subdomain: ${sanitizedProse}`)
  }
  if (!sanitizedProse.includes("/faq") || !sanitizedProse.includes("in the member portal")) {
    throw new Error(`Prose missing mapped text: ${sanitizedProse}`)
  }
  console.log("  PASS 7: Prose bare domain & subdomain sanitization verified")

  console.log(">>> ALL SANITIZER SELF-TEST ASSERTIONS PASSED (100% GREEN)!\n")
}

// ---------------------------------------------------------------------------
// 3. Multi-Source Project File Scanner & Auto-Remediator
// ---------------------------------------------------------------------------

export function findTargetApex(projectDir) {
  // 1. CLI explicit flag: --target-domain <domain> or --domain <domain>
  const domainFlagIdx = process.argv.findIndex(a => a === "--target-domain" || a === "--domain")
  if (domainFlagIdx >= 0 && process.argv[domainFlagIdx + 1]) {
    return extractApexDomain(process.argv[domainFlagIdx + 1])
  }

  // 2. Discover from crawler-seo.astro header anchor (present across all 192 TAF projects)
  const crawlerPaths = [
    path.join(projectDir, "astro-src", "pages", "crawler-seo.astro"),
    path.join(projectDir, "src", "astro-src", "pages", "crawler-seo.astro"),
  ]
  for (const cPath of crawlerPaths) {
    if (fs.existsSync(cPath)) {
      const content = fs.readFileSync(cPath, "utf-8")
      // Match header logo anchor e.g. <header ...><a href="https://carry.com/" or https://www.farther.com/
      // Bounded to the header element only — never fall through to app-store /
      // badge anchors further down the page (apps.apple.com, play.google.com).
      const headerBlock = content.match(/<header[^>]*>[\s\S]*?<\/header>/i)?.[0] ?? ""
      const match = headerBlock.match(/<a\s+[^>]*href=["']https?:\/\/([^/"'>\s]+)/i)
      if (match && match[1]) {
        const apex = extractApexDomain(match[1])
        const BLOCKED_DETECTION_APEX = ["apple.com", "google.com", "windows.com", "microsoft.com"]
        if (
          apex &&
          !apex.includes("localhost") &&
          !apex.includes("example.com") &&
          !BLOCKED_DETECTION_APEX.includes(apex)
        ) {
          return apex
        }
      }
    }
  }

  // 3. Try reading seo-intelligence.json
  const intelPaths = [
    path.join(projectDir, "seo-intelligence.json"),
    path.join(projectDir, "docs", "seo-intelligence.json"),
  ]
  for (const intelPath of intelPaths) {
    if (fs.existsSync(intelPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(intelPath, "utf-8"))
        if (data.domain) return extractApexDomain(data.domain)
      } catch {
        // ignore
      }
    }
  }

  // 4. Try reading site-url.ts brand name (supports root and src/ directories)
  const siteUrlPaths = [
    path.join(projectDir, "lib", "site-url.ts"),
    path.join(projectDir, "src", "lib", "site-url.ts"),
  ]
  for (const siteUrlPath of siteUrlPaths) {
    if (fs.existsSync(siteUrlPath)) {
      const content = fs.readFileSync(siteUrlPath, "utf-8")
      const brandMatch = content.match(/SITE_DISPLAY_NAME\s*=\s*["']([^"']+)["']/)
      if (brandMatch) {
        const rawBrand = brandMatch[1].trim()
        const firstWord = rawBrand.split(/[\s—–-]+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "")
        if (firstWord && firstWord !== "your" && firstWord !== "yoursitename" && firstWord !== "employer") {
          return `${firstWord}.com`
        }
      }
    }
  }
  return null
}

function collectFiles(dir, exts = [".astro", ".tsx", ".ts", ".html"]) {
  const results = []
  if (!fs.existsSync(dir)) return results

  function walk(current) {
    const list = fs.readdirSync(current)
    for (const item of list) {
      const full = path.join(current, item)
      const stat = fs.statSync(full)
      if (stat.isDirectory()) {
        if (!["node_modules", ".git", ".next", "dist-astro"].includes(item)) {
          walk(full)
        }
      } else if (exts.some(ext => item.endsWith(ext))) {
        results.push(full)
      }
    }
  }
  walk(dir)
  return results
}

function runAuditOrFix(projectDir, isFixMode = false) {
  const apexDomain = findTargetApex(projectDir)
  if (!apexDomain) {
    console.log(`[sanitize-target-leaks] No target domain detected in ${projectDir} — clean skip.`)
    return 0
  }

  console.log(`[sanitize-target-leaks] Scanning for leaks targeting apex: ${apexDomain} (fixMode: ${isFixMode})`)
  const files = [
    ...collectFiles(path.join(projectDir, "astro-src", "pages"), [".astro"]),
    ...collectFiles(path.join(projectDir, "astro-src", "layouts"), [".astro"]),
    ...[
      path.join(projectDir, "lib", "seo-faq.ts"),
      path.join(projectDir, "src", "lib", "seo-faq.ts"),
      path.join(projectDir, "lib", "seo-metadata.ts"),
      path.join(projectDir, "src", "lib", "seo-metadata.ts"),
      path.join(projectDir, "scripts", "generate-llms-txt.mjs"),
      path.join(projectDir, "components", "structured-data.tsx"),
      path.join(projectDir, "components", "seo-json-ld.tsx"),
      path.join(projectDir, "components", "structured-data.ts"),
      path.join(projectDir, "components", "seo-json-ld.ts"),
      path.join(projectDir, "public", "llms.txt"),
      path.join(projectDir, "public", "llms-full.txt"),
    ].filter(p => fs.existsSync(p)),
  ]

  let totalLeaksFound = 0
  let filesModified = 0

  for (const file of files) {
    const isCrawlerTwin = path.basename(file) === "crawler-seo.astro"
    const content = fs.readFileSync(file, "utf-8")
    const { email, url, rawAnchor, bareSubdomain, bareApex } = buildTargetRegexes(apexDomain)

    const emailMatches = content.match(email) || []
    const urlMatches = (!isCrawlerTwin ? content.match(url) : []) || []
    const anchorMatches = (!isCrawlerTwin ? content.match(rawAnchor) : []) || []
    const bareSubMatches = (!isCrawlerTwin && !file.endsWith(".txt") ? content.match(bareSubdomain) : []) || []
    const bareApexMatches = (!isCrawlerTwin && !file.endsWith(".txt") ? content.match(bareApex) : []) || []
    const dqLiteral = content.match(/"[^"\n]*(?:\$|\{)?\{?getMemberSupportEmail\(\)\}[^"\n]*"/g) || []
    const sqLiteral = content.match(/'[^'\n]*(?:\$|\{)?\{?getMemberSupportEmail\(\)\}[^'\n]*'/g) || []
    const btLiteral = content.match(/`[^`\n]*?(?<!\$)\{getMemberSupportEmail\(\)\}[^`\n]*`/g) || []
    const literalExprMatches = [...dqLiteral, ...sqLiteral, ...btLiteral]
    const needsImport = content.includes("getMemberSupportEmail") && !/import\s*\{[^}]*getMemberSupportEmail[^}]*\}\s*from/i.test(content)
    
    const leakCount = emailMatches.length + urlMatches.length + anchorMatches.length + bareSubMatches.length + bareApexMatches.length + literalExprMatches.length + (needsImport ? 1 : 0)

    if (leakCount > 0) {
      totalLeaksFound += leakCount
      const relPath = path.relative(projectDir, file)
      console.log(`  [LEAK/REPAIR NEEDED] ${relPath}: ${emailMatches.length} email(s), ${urlMatches.length} url(s), ${bareSubMatches.length} bareSub(s), ${literalExprMatches.length} rawExpr(s), missingImport: ${needsImport}`)

      if (isFixMode) {
        const sanitized = sanitizeContent(content, apexDomain, isCrawlerTwin, file)
        fs.writeFileSync(file, sanitized, "utf-8")
        filesModified++
        console.log(`    -> AUTO-HEALED: ${relPath}`)
      }
    }
  }

  if (totalLeaksFound === 0) {
    console.log(`[sanitize-target-leaks] PASS: 0 target leaks discovered. Perimeter is 100% airtight.`)
    return 0
  }

  if (isFixMode) {
    console.log(`[sanitize-target-leaks] FIXED: ${filesModified} file(s) sanitized across ${totalLeaksFound} leak instances.`)
    return 0
  }

  console.error(`[sanitize-target-leaks] FAILED: ${totalLeaksFound} target leak(s) remain. Run with --fix to remediate.`)
  return 1
}

// ---------------------------------------------------------------------------
// 4. CLI Entrypoint
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
if (args.includes("--self-test")) {
  try {
    runSelfTest()
    process.exit(0)
  } catch (err) {
    console.error("Self-test error:", err)
    process.exit(1)
  }
}

const isFix = args.includes("--fix")
const targetPath = args.find(a => !a.startsWith("--")) || process.cwd()
const exitCode = runAuditOrFix(targetPath, isFix)
process.exit(exitCode)
