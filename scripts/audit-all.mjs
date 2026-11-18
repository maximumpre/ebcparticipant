#!/usr/bin/env node
/**
 * Master audit runner — Sleipnir v2.0 kit.
 * Runs the 7 core audits in sequence and exits 0 only when every gate passes.
 *
 * Usage: node Steins Gate/scripts/audit-all.mjs [project-root]
 *   project-root may be the kit dir ("Steins Gate") or the pack root that
 *   contains it. Defaults to the kit dir next to this script.
 *
 * Order:
 *   1. check-doc-drift.mjs      (pack root)
 *   2. audit-steins-gate.mjs    (kit root)
 *   3. audit-crawler-seo.mjs    (kit root)
 *   4. audit-brand-assets.mjs   (kit root)
 *   5. audit-error-screen.mjs   (kit root)
 *   6. audit-neon-database.mjs  (kit root)
 *   7. check-indexnow-key.mjs   (kit root)
 *   8. test-serp-resilience.mjs (kit root)
 *
 * Any non-zero exit from any audit fails the run. Output streams through
 * verbatim so individual failures stay diagnosable.
 */

import fs from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function resolveRoots(arg) {
  const base = path.resolve(arg ?? path.join(__dirname, ".."))
  let kitRoot = base
  if (!fs.existsSync(path.join(base, "SteinsGate.tsx"))) {
    const nested = path.join(base, "Steins Gate")
    if (fs.existsSync(path.join(nested, "SteinsGate.tsx"))) kitRoot = nested
  }
  return { kitRoot, packRoot: path.dirname(kitRoot) }
}

const { kitRoot, packRoot } = resolveRoots(process.argv[2])

const isPack =
  fs.existsSync(
    path.join(packRoot, "Step 1a — Landing UI & Astro Hybrid Foundation Prompt.md"),
  ) ||
  fs.existsSync(
    path.join(packRoot, "Step 1 — Landing UI & Astro Hybrid Foundation Prompt.md"),
  )

const AUDITS = [
  ...(isPack ? [{ script: "check-doc-drift.mjs", root: packRoot }] : []),
  { script: "audit-steins-gate.mjs", root: kitRoot },
  { script: "audit-crawler-seo.mjs", root: kitRoot },
  { script: "check-canonical-domain.mjs", args: ["--self-test"], root: kitRoot },
  { script: "audit-brand-assets.mjs", root: kitRoot },
  { script: "audit-error-screen.mjs", root: kitRoot },
  { script: "audit-neon-database.mjs", root: kitRoot },
  { script: "check-domain-stealth.mjs", args: ["--self-test"], root: kitRoot },
  { script: "sanitize-target-leaks.mjs", args: ["--self-test"], root: kitRoot },
  { script: "check-indexnow-key.mjs", root: kitRoot },
  { script: "test-serp-resilience.mjs", root: kitRoot },
  { script: "notify-indexnow.mjs", root: kitRoot },
]

function runAudit({ script, root, args }) {
  return new Promise((resolve) => {
    const target = path.join(__dirname, script)
    if (!fs.existsSync(target)) {
      console.error(`[audit-all] MISSING ${script}`)
      resolve({ script, code: 1 })
      return
    }
    const finalArgs = args ?? [root]
    console.log(`\n[audit-all] >>> ${script} (${finalArgs.join(" ")})`)
    const child = spawn(process.execPath, [target, ...finalArgs], { stdio: "inherit" })
    child.on("error", () => resolve({ script, code: 1 }))
    child.on("exit", (code) => resolve({ script, code: code ?? 1 }))
  })
}

const results = []
for (const audit of AUDITS) {
  results.push(await runAudit(audit))
}

console.log("\n[audit-all] summary")
let failed = 0
for (const { script, code } of results) {
  const ok = code === 0
  if (!ok) failed++
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${script}${ok ? "" : ` (exit ${code})`}`)
}

if (failed > 0) {
  console.error(`\n[audit-all] ${failed} audit(s) failed`)
  process.exit(1)
}
console.log("\n[audit-all] all gates passed")
process.exit(0)
