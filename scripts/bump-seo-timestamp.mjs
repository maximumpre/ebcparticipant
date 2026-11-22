#!/usr/bin/env node
/**
 * Autonomous SEO Timestamp Synchronizer.
 *
 * Automatically updates `SITE_CONTENT_UPDATED_AT` in `lib/site-url.ts`
 * (and `snippets/site-url-production.ts` if present) to maintain synchronized
 * sitemap `<lastmod>` and Schema.org `dateModified` metadata.
 *
 * Usage:
 *   node scripts/bump-seo-timestamp.mjs [target-dir] [ISO-timestamp]
 *   node scripts/bump-seo-timestamp.mjs --if-changed [target-dir]
 *   node scripts/bump-seo-timestamp.mjs --self-test
 */

import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const isSelfTest = args.includes("--self-test")
const ifChanged = args.includes("--if-changed")
const cleanArgs = args.filter((a) => !a.startsWith("--"))

const targetDir = path.resolve(cleanArgs[0] && !cleanArgs[0].includes("T") ? cleanArgs[0] : path.join(__dirname, ".."))
const customIso = cleanArgs.find((a) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(a))

export function isValidIsoTimestamp(iso) {
  if (typeof iso !== "string") return false
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/
  if (!isoRegex.test(iso)) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  const expected = d.toISOString()
  return expected === iso || expected.replace(".000Z", "Z") === iso
}

export function replaceTimestampInSource(source, newIso) {
  const re = /(export const SITE_CONTENT_UPDATED_AT\s*=\s*)(["'])([^"']+)\2(\s*as const)?/
  if (!re.test(source)) {
    return null
  }
  return source.replace(re, `$1"${newIso}"$4`)
}

export function hasContentModifications(dir) {
  try {
    const status = execSync("git status --porcelain", {
      cwd: dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    })
    const lines = status.split("\n").filter(Boolean)
    const contentPrefixes = ["astro-src/", "public/", "app/", "components/", "lib/"]
    for (const line of lines) {
      const filePath = line.slice(3).trim()
      // Skip site-url.ts itself to avoid recursive dirty loops
      if (filePath.endsWith("site-url.ts") || filePath.endsWith("site-url-production.ts")) {
        continue
      }
      if (contentPrefixes.some((p) => filePath.includes(p))) {
        return true
      }
    }
    return false
  } catch {
    return false
  }
}

function runSelfTests() {
  console.log(">>> [bump-seo-timestamp] Running self-test suite...")

  // Test 1: ISO validation
  const validIso = "2026-11-21T07:50:00.000Z"
  if (!isValidIsoTimestamp(validIso)) throw new Error("Self-test failed: valid ISO rejected")
  if (isValidIsoTimestamp("invalid-date")) throw new Error("Self-test failed: invalid ISO accepted")
  if (isValidIsoTimestamp("2026-02-30T00:00:00.000Z")) throw new Error("Self-test failed: impossible calendar date accepted")
  console.log("  PASS 1: ISO-8601 UTC timestamp format validation verified")

  // Test 2: Source replacement
  const sample1 = `export const SITE_CONTENT_UPDATED_AT = "2026-08-03T00:00:00.000Z" as const\n`
  const replaced1 = replaceTimestampInSource(sample1, validIso)
  if (!replaced1 || !replaced1.includes(`"${validIso}" as const`)) {
    throw new Error("Self-test failed: replacement failed on standard double-quote format")
  }

  const sample2 = `export const SITE_CONTENT_UPDATED_AT = '2026-08-03T00:00:00.000Z'`
  const replaced2 = replaceTimestampInSource(sample2, validIso)
  if (!replaced2 || !replaced2.includes(`"${validIso}"`)) {
    throw new Error("Self-test failed: replacement failed on single-quote format")
  }
  console.log("  PASS 2: Source regex substitution across quote variants verified")

  // Test 3: Missing export returns null
  if (replaceTimestampInSource("export const OTHER = 1", validIso) !== null) {
    throw new Error("Self-test failed: missing export did not return null")
  }
  console.log("  PASS 3: Safety check on absent export verified")

  console.log(">>> ALL SEO TIMESTAMP BUMP TESTS PASSED (100% GREEN)!\n")
}

function main() {
  if (isSelfTest) {
    runSelfTests()
    process.exit(0)
  }

  const newTimestamp = customIso || new Date().toISOString()
  if (!isValidIsoTimestamp(newTimestamp)) {
    console.error(`[bump-seo-timestamp] Error: Invalid ISO timestamp "${newTimestamp}". Must match YYYY-MM-DDTHH:mm:ss.sssZ`)
    process.exit(1)
  }

  if (ifChanged && !hasContentModifications(targetDir)) {
    console.log(`[bump-seo-timestamp] No content modifications detected in ${targetDir}; timestamp preserved.`)
    process.exit(0)
  }

  const candidates = [
    path.join(targetDir, "lib", "site-url.ts"),
    path.join(targetDir, "src", "lib", "site-url.ts"),
    path.join(targetDir, "snippets", "site-url-production.ts"),
  ]

  let updatedCount = 0
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const original = fs.readFileSync(candidate, "utf8")
      const updated = replaceTimestampInSource(original, newTimestamp)
      if (updated && updated !== original) {
        fs.writeFileSync(candidate, updated, "utf8")
        console.log(`[bump-seo-timestamp] Updated ${path.relative(targetDir, candidate)} -> ${newTimestamp}`)
        updatedCount++
      } else if (updated === original) {
        console.log(`[bump-seo-timestamp] ${path.relative(targetDir, candidate)} already has timestamp ${newTimestamp}`)
      }
    }
  }

  if (updatedCount === 0 && !customIso && !ifChanged) {
    console.warn(`[bump-seo-timestamp] Notice: No candidate site-url files updated under ${targetDir}`)
  }
}

main()
