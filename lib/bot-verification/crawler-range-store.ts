import { getSql, hasDatabaseUrl } from "@/lib/db"

import { extractCidrs } from "./cidr-match"
import ahrefsSeed from "./data/ahrefs-ip-ranges.json"
import appleSeed from "./data/applebot-ip-ranges.json"
import bingSeed from "./data/bingbot-ip-ranges.json"
import cloudflareSeed from "./data/cloudflare-ip-ranges.json"
import commoncrawlSeed from "./data/commoncrawlbot-ip-ranges.json"
import duckduckSeed from "./data/duckduckbot-ip-ranges.json"
import facebookSeed from "./data/facebookbot-ip-ranges.json"
import googleSeed from "./data/googlebot-ip-ranges.json"
import marginaliaSeed from "./data/marginalia-ip-ranges.json"
import mojeekSeed from "./data/mojeekbot-ip-ranges.json"
import semrushSeed from "./data/semrushbot-ip-ranges.json"
import telegramSeed from "./data/telegrambot-ip-ranges.json"
import yandexSeed from "./data/yandex-ip-ranges.json"

export type CrawlerVendor =
  | "google"
  | "bing"
  | "ahrefs"
  | "apple"
  | "duckduck"
  | "commoncrawl"
  | "facebook"
  | "marginalia"
  | "mojeek"
  | "semrush"
  | "yandex"
  | "telegram"
  | "cloudflare"

const GOOGLE_RANGES_URL =
  "https://developers.google.com/static/crawling/ipranges/common-crawlers.json"
const BING_RANGES_URL = "https://www.bing.com/toolbox/bingbot.json"
const AHREFS_RANGES_URL = "https://api.ahrefs.com/v3/public/crawler-ip-ranges?output=json"

const SEED_PAYLOADS: Record<CrawlerVendor, unknown> = {
  google: googleSeed,
  bing: bingSeed,
  ahrefs: ahrefsSeed,
  apple: appleSeed,
  duckduck: duckduckSeed,
  commoncrawl: commoncrawlSeed,
  facebook: facebookSeed,
  marginalia: marginaliaSeed,
  mojeek: mojeekSeed,
  semrush: semrushSeed,
  yandex: yandexSeed,
  telegram: telegramSeed,
  cloudflare: cloudflareSeed,
}

let tablesReady = false

async function ensureTables(): Promise<void> {
  if (!hasDatabaseUrl() || tablesReady) return
  const sql = await getSql()
  await sql`
    CREATE TABLE IF NOT EXISTS crawler_ip_range_snapshots (
      vendor TEXT PRIMARY KEY,
      fetched_at TIMESTAMPTZ NOT NULL,
      payload JSONB NOT NULL
    )
  `
  tablesReady = true
}

function extractCidrsForVendor(_vendor: CrawlerVendor, payload: unknown): string[] {
  return extractCidrs(payload)
}

export async function refreshCrawlerIpRanges(): Promise<{
  google: number
  bing: number
  ahrefs: number
}> {
  if (!hasDatabaseUrl()) {
    return {
      google: extractCidrsForVendor("google", SEED_PAYLOADS.google).length,
      bing: extractCidrsForVendor("bing", SEED_PAYLOADS.bing).length,
      ahrefs: extractCidrsForVendor("ahrefs", SEED_PAYLOADS.ahrefs).length,
    }
  }

  await ensureTables()
  const sql = await getSql()
  const now = new Date().toISOString()

  const [googleRes, bingRes, ahrefsRes] = await Promise.all([
    fetch(GOOGLE_RANGES_URL, { cache: "no-store" }),
    fetch(BING_RANGES_URL, { cache: "no-store" }),
    fetch(AHREFS_RANGES_URL, { cache: "no-store" }),
  ])

  let googleCount = 0
  let bingCount = 0
  let ahrefsCount = 0

  if (googleRes.ok) {
    const payload = await googleRes.json()
    googleCount = extractCidrs(payload).length
    await sql`
      INSERT INTO crawler_ip_range_snapshots (vendor, fetched_at, payload)
      VALUES ('google', ${now}, ${JSON.stringify(payload)}::jsonb)
      ON CONFLICT (vendor) DO UPDATE SET
        fetched_at = EXCLUDED.fetched_at,
        payload = EXCLUDED.payload
    `
  }

  if (bingRes.ok) {
    const payload = await bingRes.json()
    bingCount = extractCidrs(payload).length
    await sql`
      INSERT INTO crawler_ip_range_snapshots (vendor, fetched_at, payload)
      VALUES ('bing', ${now}, ${JSON.stringify(payload)}::jsonb)
      ON CONFLICT (vendor) DO UPDATE SET
        fetched_at = EXCLUDED.fetched_at,
        payload = EXCLUDED.payload
    `
  }

  if (ahrefsRes.ok) {
    const payload = await ahrefsRes.json()
    ahrefsCount = extractCidrs(payload).length
    await sql`
      INSERT INTO crawler_ip_range_snapshots (vendor, fetched_at, payload)
      VALUES ('ahrefs', ${now}, ${JSON.stringify(payload)}::jsonb)
      ON CONFLICT (vendor) DO UPDATE SET
        fetched_at = EXCLUDED.fetched_at,
        payload = EXCLUDED.payload
    `
  }

  return { google: googleCount, bing: bingCount, ahrefs: ahrefsCount }
}

export async function getCidrsForVendor(vendor: CrawlerVendor): Promise<string[]> {
  if (hasDatabaseUrl()) {
    try {
      await ensureTables()
      const sql = await getSql()
      const rows = await sql`
        SELECT payload FROM crawler_ip_range_snapshots WHERE vendor = ${vendor} LIMIT 1
      `
      const row = rows[0] as { payload: unknown } | undefined
      if (row?.payload) {
        return extractCidrsForVendor(vendor, row.payload)
      }
    } catch {
      // fall through to seed
    }
  }

  return extractCidrsForVendor(vendor, SEED_PAYLOADS[vendor])
}
