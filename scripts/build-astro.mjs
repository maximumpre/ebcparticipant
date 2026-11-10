#!/usr/bin/env node
/**
 * Atomic Astro static builder + synchronizer.
 * Enforces zero-telemetry environment so build never fails with EPERM in
 * sandboxes, containers, or Vercel CI where home directories may be restricted.
 */
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

process.env.ASTRO_TELEMETRY_DISABLED = "1"
process.env.NEXT_TELEMETRY_DISABLED = "1"

const npx = process.platform === "win32" ? "npx.cmd" : "npx"
const astroRes = spawnSync(npx, ["astro", "build"], {
  stdio: "inherit",
  env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1", NEXT_TELEMETRY_DISABLED: "1" },
  shell: process.platform === "win32",
})

if (astroRes.status !== 0) {
  process.exit(astroRes.status ?? 1)
}

const syncScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "sync-astro-pages.mjs")
const syncRes = spawnSync(process.execPath, [syncScript], { stdio: "inherit" })
process.exit(syncRes.status ?? 0)

