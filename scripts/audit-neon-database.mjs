#!/usr/bin/env node
/**
 * Audit Neon dual-shard + backup fallback for pending-login sites.
 * See NEON_DATABASE_RULES.md — HARD RULES: Neon stack.
 *
 * Usage: node scripts/audit-neon-database.mjs [project-root]
 * Exit 1 if any check fails.
 * Skips (exit 0) when lib/pending-logins.ts is absent.
 */

import fs from "node:fs"
import path from "node:path"

const root = path.resolve(process.argv[2] ?? process.cwd())

function readIfExists(relPaths) {
  for (const rel of relPaths) {
    const full = path.join(root, rel)
    if (fs.existsSync(full)) return { rel, text: fs.readFileSync(full, "utf8") }
  }
  return null
}

function exists(relPaths) {
  for (const rel of relPaths) {
    if (fs.existsSync(path.join(root, rel))) return rel
  }
  return null
}

const pending = readIfExists(["lib/pending-logins.ts", "src/lib/pending-logins.ts"])
if (!pending) {
  console.log("audit-neon-database: no pending-logins.ts — skip")
  process.exit(0)
}

const failures = []

const urls = readIfExists(["lib/database-urls.ts", "src/lib/database-urls.ts"])
if (!urls) {
  failures.push("missing lib/database-urls.ts (required with pending-logins)")
} else {
  const t = urls.text
  if (!/DATABASE_BACKUP_FALLBACK/.test(t)) {
    failures.push(`${urls.rel}: missing DATABASE_BACKUP_FALLBACK support`)
  }
  if (!/getBackupDatabaseUrl/.test(t)) {
    failures.push(`${urls.rel}: missing getBackupDatabaseUrl`)
  }
  if (!/getCreateTargets|getCreateShardOrder/.test(t)) {
    failures.push(`${urls.rel}: missing getCreateTargets / getCreateShardOrder`)
  }
  if (!/pl_b_|buildBackupPendingId|isBackupPendingId/.test(t)) {
    failures.push(`${urls.rel}: missing backup pending id helpers (pl_b_)`)
  }
  if (!/shardRequiresCcId|createTargetRequiresCcId|isDb2PendingId/.test(t)) {
    failures.push(`${urls.rel}: missing DB2 CC_ID helpers (shardRequiresCcId / createTargetRequiresCcId)`)
  }
  // Create order must prefer shard 0 before shard 1: return [0, 1]
  if (/return\s*\[\s*1\s*,\s*0\s*\]/.test(t) && !/return\s*\[\s*0\s*,\s*1\s*\]/.test(t)) {
    failures.push(`${urls.rel}: create order must be DB1→DB2 ([0, 1]), not DB2-first ([1, 0])`)
  }
}

const db = readIfExists(["lib/db.ts", "src/lib/db.ts"])
if (!db) {
  failures.push("missing lib/db.ts")
} else if (!/getSqlForBackup/.test(db.text)) {
  failures.push(`${db.rel}: missing getSqlForBackup`)
}

const ccId = exists(["lib/cc-id.ts", "src/lib/cc-id.ts"])
if (!ccId) {
  failures.push("missing lib/cc-id.ts (CC_ID helpers)")
}

if (!/cc_id|getCcId|ccId/.test(pending.text)) {
  failures.push(`${pending.rel}: must stamp / filter cc_id for backup isolation`)
}

if (!/createTargetRequiresCcId|shardRequiresCcId/.test(pending.text)) {
  failures.push(`${pending.rel}: must skip/filter DB2 with CC_ID (createTargetRequiresCcId / shardRequiresCcId)`)
}

const outcome = readIfExists([
  "lib/pending-login-outcome-notify.ts",
  "src/lib/pending-login-outcome-notify.ts",
])
if (outcome && !/shardRequiresCcId/.test(outcome.text)) {
  failures.push(`${outcome.rel}: DB2 outcome claim must filter cc_id via shardRequiresCcId`)
}

if (failures.length) {
  console.error("audit-neon-database FAILED:")
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log("audit-neon-database: ok")
process.exit(0)
