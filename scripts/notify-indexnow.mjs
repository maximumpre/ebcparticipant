/**
 * IndexNow ping — runs after `next build` (npm `postbuild`).
 * Search Vercel **Build** logs for `[IndexNow]`.
 *
 * Config source of truth: hardcoded SITE_ORIGIN and INDEXNOW_KEY in lib/site-url.ts
 * (or src/lib/site-url.ts). Optional env overrides: SITE_URL, NEXT_PUBLIC_SITE_URL, INDEXNOW_KEY.
 * lib/site-config.ts DEFAULT_SITE_URL is a legacy fallback when site-url.ts is unreadable.
 *
 * ZERO-ENV AUTOMATIC EXECUTION:
 * - On production deploy (VERCEL_ENV=production or VERCEL=1), automatically performs
 *   live submission to https://api.indexnow.org/IndexNow without requiring any env var.
 * - On local development/builds, automatically runs in safe dry-run simulation mode.
 * - Safe overrides: INDEXNOW_ON_BUILD=1 forces live submission; INDEXNOW_DISABLE=1 or
 *   INDEXNOW_SUBMIT=0 forces dry-run mode in production.
 * Always exits 0 — IndexNow failure must not fail the deploy.
 *
 * When TELEGRAM_SEO_BOT_TOKEN + TELEGRAM_SEO_ADMIN are set (Bundle 2), also sends
 * a plain-text result to the SEO admin Telegram channel after each submit attempt.
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  isSeoTelegramConfigured,
  sendIndexNowNotification,
} from "./seo-telegram-notify.mjs"

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/IndexNow"
const LOG = "[IndexNow]"
const banner = "=".repeat(60)
const ok = (msg) => console.log(`${LOG} ${msg}`)
const err = (msg) => console.error(`${LOG} ${msg}`)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function loadEnvFiles() {
  const envFiles = [".env.local", ".env.production", ".env.production.local"]
  for (const file of envFiles) {
    const fullPath = path.join(ROOT, file)
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, "utf8")
        for (const line of content.split("\n")) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith("#")) continue
          const eqIdx = trimmed.indexOf("=")
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim()
            let val = trimmed.slice(eqIdx + 1).trim()
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1)
            }
            if (process.env[key] === undefined) {
              process.env[key] = val
            }
          }
        }
      } catch {}
    }
  }
}
loadEnvFiles()

const PLACEHOLDER_SITE_URLS = new Set([
  "https://YOUR_FBA_NATIONAL_DOMAIN.com",
  "https://YOUR_DOMAIN.com",
  "https://www.example.com",
])

const PLACEHOLDER_KEYS = new Set([
  "YOUR_INDEXNOW_KEY_PLACEHOLDER",
  "YOUR_INDEXNOW_KEY",
  "your-indexnow-key-here",
  "undefined",
  "",
])

function siteUrlFilePath() {
  const candidates = [
    path.join(ROOT, "lib", "site-url.ts"),
    path.join(ROOT, "src", "lib", "site-url.ts"),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  throw new Error("Could not find lib/site-url.ts or src/lib/site-url.ts")
}

function readSiteUrlFromFile() {
  const src = fs.readFileSync(siteUrlFilePath(), "utf8")

  const siteOriginBlock = src.match(/export const SITE_ORIGIN[\s\S]*?(?=\nexport |$)/)?.[0]
  if (siteOriginBlock) {
    const httpsMatches = [...siteOriginBlock.matchAll(/["'](https?:\/\/[^"']+)["']/g)]
    if (httpsMatches.length > 0) {
      return httpsMatches[httpsMatches.length - 1][1].trim().replace(/\/$/, "")
    }
  }

  const siteUrlBlock = src.match(/export const SITE_URL[\s\S]*?(?=\nexport |$)/)?.[0]
  if (siteUrlBlock) {
    const direct = siteUrlBlock.match(/\?\?\s*["'](https?:\/\/[^"']+)["']/)
    if (direct?.[1]) return direct[1].trim().replace(/\/$/, "")
  }

  const hostMatch = src.match(/export const CANONICAL_HOST\s*=\s*["']([^"']+)["']/)
  if (hostMatch?.[1]) {
    const host = hostMatch[1].trim()
    return host.startsWith("http") ? host.replace(/\/$/, "") : `https://${host}`
  }

  throw new Error("Could not read site URL from site-url.ts")
}

/** @param {string} exportName */
function readExportFromSiteUrl(exportName) {
  const src = fs.readFileSync(siteUrlFilePath(), "utf8")
  const block = src.match(new RegExp(`export const ${exportName}[\\s\\S]*?(?=\\nexport |$)`))?.[0]
  if (!block) throw new Error(`Could not read ${exportName} from site-url.ts`)

  const fallback = block.match(/\?\?\s*["']([^"']+)["']/)
  if (fallback?.[1]) return fallback[1].trim()

  const directMatch = block.match(new RegExp(`export const ${exportName}[^=]*=\\s*["']([^"']+)["']`))
  if (directMatch?.[1] && exportName !== "SITE_ORIGIN" && exportName !== "SITE_URL") {
    return directMatch[1].trim()
  }

  const refMatch = block.match(new RegExp(`export const ${exportName}[^=]*=\\s*([A-Za-z0-9_]+)\\b`))
  if (refMatch?.[1] && refMatch[1] !== exportName && refMatch[1] !== "process" && refMatch[1] !== "undefined") {
    try {
      return readExportFromSiteUrl(refMatch[1])
    } catch {}
  }

  throw new Error(`Could not read ${exportName} from site-url.ts`)
}

function getSiteUrl() {
  const fromEnv =
    process.env.SITE_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_SITE_URL?.trim()?.replace(/\/$/, "")
  if (fromEnv) return fromEnv

  const configPath = path.join(ROOT, "lib", "site-config.ts")
  if (fs.existsSync(configPath)) {
    const config = fs.readFileSync(configPath, "utf8")
    const match = config.match(/DEFAULT_SITE_URL\s*=\s*["']([^"']+)["']/)
    if (match?.[1]) return match[1].trim().replace(/\/$/, "")
  }

  return readSiteUrlFromFile()
}

function getIndexNowKey() {
  return (process.env.INDEXNOW_KEY ?? readExportFromSiteUrl("INDEXNOW_KEY")).trim()
}

function getSiteDisplayName() {
  try {
    return readExportFromSiteUrl("SITE_DISPLAY_NAME")
  } catch {
    try {
      const site = new URL(getSiteUrl())
      return site.hostname
    } catch {
      return "Site"
    }
  }
}

/**
 * Auto-heal missing public/{key}.txt so verification endpoint never returns 404.
 * @param {string} key
 */
function ensureKeyFileExists(key) {
  const publicDir = path.join(ROOT, "public")
  const keyFilePath = path.join(publicDir, `${key}.txt`)
  if (!fs.existsSync(keyFilePath)) {
    try {
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true })
      }
      fs.writeFileSync(keyFilePath, key, "utf8")
      ok(`auto-healed missing public/${key}.txt`)
    } catch (e) {
      err(`failed to auto-heal public/${key}.txt: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
}

/**
 * Determines whether this run should perform a live IndexNow submission or a safe local simulation.
 * @returns {{ submit: boolean, dryRun: boolean, reason: string }}
 */
function resolveExecutionMode() {
  if (process.env.INDEXNOW_DISABLE === "1" || process.env.INDEXNOW_SUBMIT === "0") {
    return { submit: false, dryRun: true, reason: "disabled via INDEXNOW_DISABLE=1" }
  }
  if (process.env.INDEXNOW_ON_BUILD === "1" || process.env.INDEXNOW_SUBMIT === "1") {
    return { submit: true, dryRun: false, reason: "forced live via env flag" }
  }
  if (process.env.VERCEL_ENV === "production" || (process.env.VERCEL === "1" && process.env.VERCEL_ENV !== "preview")) {
    return { submit: true, dryRun: false, reason: "Vercel production deployment" }
  }
  return { submit: false, dryRun: true, reason: "local environment (safe dry-run mode)" }
}

/**
 * @param {{
 *   siteName: string
 *   siteUrl: string
 *   success: boolean
 *   dryRun?: boolean
 *   httpStatus?: number
 *   responseSnippet?: string
 *   urlList: string[]
 *   keyLocation: string
 *   errorMessage?: string
 * }} payload
 */
async function notifyIndexNowTelegram(payload) {
  if (!isSeoTelegramConfigured()) {
    ok("SEO admin Telegram skipped — TELEGRAM_SEO_BOT_TOKEN / TELEGRAM_SEO_ADMIN not set")
    return
  }

  try {
    const sent = await sendIndexNowNotification(payload)
    if (sent) {
      ok("SEO admin Telegram notified")
    } else {
      err("SEO admin Telegram notify failed (no chat accepted the message)")
    }
  } catch (e) {
    err(`SEO admin Telegram notify error: ${e instanceof Error ? e.message : String(e)}`)
  }
}

function isPlaceholderConfig(siteUrl, key) {
  return PLACEHOLDER_SITE_URLS.has(siteUrl) || PLACEHOLDER_KEYS.has(key)
}

async function main() {
  console.log(banner)

  if (process.env.INDEXNOW_SKIP === "1") {
    ok("postbuild skipped (INDEXNOW_SKIP=1)")
    console.log(banner)
    process.exit(0)
  }

  const mode = resolveExecutionMode()
  ok(`postbuild mode: ${mode.dryRun ? "SIMULATION (dry-run)" : "LIVE SUBMISSION"} (${mode.reason})`)

  let key
  let base
  try {
    key = getIndexNowKey()
    base = getSiteUrl()
  } catch (e) {
    err(`skipped — ${e instanceof Error ? e.message : String(e)}`)
    console.log(banner)
    process.exit(0)
  }

  if (isPlaceholderConfig(base, key)) {
    ok(`postbuild skipped — set SITE_URL and INDEXNOW_KEY (and public/${key}.txt) when ready`)
    console.log(banner)
    process.exit(0)
  }

  // Ensure public/{key}.txt is in place before pinging
  ensureKeyFileExists(key)

  const site = new URL(base)
  const host = site.hostname
  const home = `${base}/`
  const sitemap = `${base}/sitemap.xml`
  const keyLocation = `${base}/${key}.txt`

  const siteName = getSiteDisplayName()

  // Dynamically check if sitemap exists
  const sitemapExists =
    fs.existsSync(path.join(ROOT, "public", "sitemap.xml")) ||
    fs.existsSync(path.join(ROOT, "app", "sitemap.ts")) ||
    fs.existsSync(path.join(ROOT, "src", "app", "sitemap.ts"))
  const urlList = sitemapExists ? [home, sitemap] : [home]

  const telegramBase = {
    siteName,
    siteUrl: base,
    urlList,
    keyLocation,
  }

  if (mode.dryRun) {
    ok("dry-run — no IndexNow ping sent (automatically submits live on Vercel production deployment)")
    await notifyIndexNowTelegram({ ...telegramBase, dryRun: true, success: true })
    console.log(banner)
    process.exit(0)
  }

  for (const u of urlList) {
    ok(`submitting ${u}`)
  }
  ok(`keyLocation: ${keyLocation}`)

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key, keyLocation, urlList }),
      signal: AbortSignal.timeout(10000),
    })
    const bodyText = (await res.text().catch(() => "")).trim().slice(0, 500)
    const success = res.status === 200 || res.status === 202

    if (success) {
      ok(`✓ success — HTTP ${res.status}${bodyText ? ` ${bodyText}` : ""}`)
    } else {
      err(`✗ failed — HTTP ${res.status} ${bodyText || "(empty)"}`)
    }

    await notifyIndexNowTelegram({
      ...telegramBase,
      success,
      dryRun: false,
      httpStatus: res.status,
      responseSnippet: bodyText || undefined,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    err(`✗ error: ${message}`)
    await notifyIndexNowTelegram({
      ...telegramBase,
      success: false,
      dryRun: false,
      errorMessage: message,
    })
  }

  console.log(banner)
}

main()
