import { getSql, hasDatabaseUrl } from "@/lib/db"

import { extractCidrs } from "./cidr-match"
import ahrefsSeed from "./data/ahrefs-ip-ranges.json"
import appleSeed from "./data/applebot-ip-ranges.json"
import bingSeed from "./data/bingbot-ip-ranges.json"
import claudeSeed from "./data/claude-ip-ranges.json"
import cloudflareSeed from "./data/cloudflare-ip-ranges.json"
import commoncrawlSeed from "./data/commoncrawlbot-ip-ranges.json"
import duckduckSeed from "./data/duckduckbot-ip-ranges.json"
import facebookSeed from "./data/facebookbot-ip-ranges.json"
import googleSeed from "./data/googlebot-ip-ranges.json"
import marginaliaSeed from "./data/marginalia-ip-ranges.json"
import mojeekSeed from "./data/mojeekbot-ip-ranges.json"
import openaiSeed from "./data/openai-ip-ranges.json"
import perplexitySeed from "./data/perplexity-ip-ranges.json"
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
  | "openai"
  | "claude"
  | "perplexity"

const GOOGLE_BOT_RANGES_URL =
  "https://developers.google.com/search/apis/ipranges/googlebot.json"
const GOOGLE_COMMON_RANGES_URL =
  "https://developers.google.com/static/crawling/ipranges/common-crawlers.json"
const GOOGLE_SPECIAL_RANGES_URL =
  "https://developers.google.com/static/crawling/ipranges/special-crawlers.json"
const GOOGLE_USER_FETCHERS_URL =
  "https://developers.google.com/static/crawling/ipranges/user-triggered-fetchers.json"
const BING_RANGES_URL = "https://www.bing.com/toolbox/bingbot.json"
const AHREFS_RANGES_URL = "https://api.ahrefs.com/v3/public/crawler-ip-ranges?output=json"
const APPLE_RANGES_URL = "https://search.developer.apple.com/applebot.json"
const DUCKDUCK_RANGES_URL = "https://duckduckgo.com/duckduckbot.json"
const OPENAI_SEARCHBOT_RANGES_URL = "https://openai.com/searchbot.json"
const OPENAI_CHATGPT_USER_RANGES_URL = "https://openai.com/chatgpt-user.json"
const CLAUDE_RANGES_URL = "https://claude.com/crawling/bots.json"
const PERPLEXITY_RANGES_URL = "https://www.perplexity.ai/perplexitybot.json"

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
  openai: openaiSeed,
  claude: claudeSeed,
  perplexity: perplexitySeed,
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

type CachedCidrs = {
  cidrs: string[]
  expiresAt: number
}

const CIDR_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour TTL
const cidrCache = new Map<CrawlerVendor, CachedCidrs>()

// Pre-warm in-memory cache at boot so initial requests have 0ms cold-start latency
for (const [vendorKey, payload] of Object.entries(SEED_PAYLOADS) as Array<[CrawlerVendor, unknown]>) {
  cidrCache.set(vendorKey, {
    cidrs: extractCidrs(payload) || [],
    expiresAt: Date.now() + CIDR_CACHE_TTL_MS,
  })
}

export async function getCidrsForVendor(vendor: CrawlerVendor): Promise<string[]> {
  const cached = cidrCache.get(vendor)
  const now = Date.now()
  if (cached && now < cached.expiresAt && cached.cidrs.length > 0) {
    return cached.cidrs
  }

  if (hasDatabaseUrl()) {
    try {
      await ensureTables()
      const sql = await getSql()
      let timer: ReturnType<typeof setTimeout> | undefined
      const queryPromise = sql`
        SELECT payload FROM crawler_ip_range_snapshots
        WHERE vendor = ${vendor}
        LIMIT 1
      `
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("DB read timeout")), 1500)
      })
      const rows = await Promise.race([queryPromise, timeoutPromise]).finally(() => {
        if (timer) clearTimeout(timer)
      })
      const row = rows[0] as { payload?: unknown } | undefined
      if (row?.payload) {
        const dbCidrs = extractCidrs(row.payload)
        if (dbCidrs.length > 0) {
          cidrCache.set(vendor, { cidrs: dbCidrs, expiresAt: now + CIDR_CACHE_TTL_MS })
          return dbCidrs
        }
      }
    } catch {
      // Silently fall back to cached seed
    }
  }

  if (cached && cached.cidrs.length > 0) return cached.cidrs
  const seedCidrs = extractCidrs(SEED_PAYLOADS[vendor]) || []
  cidrCache.set(vendor, { cidrs: seedCidrs, expiresAt: now + CIDR_CACHE_TTL_MS })
  return seedCidrs
}

export async function refreshCrawlerIpRanges(): Promise<{
  google: number
  bing: number
  ahrefs: number
  apple: number
  duckduck: number
  openai: number
  claude: number
  perplexity: number
}> {
  if (!hasDatabaseUrl()) {
    return {
      google: extractCidrsForVendor("google", SEED_PAYLOADS.google).length,
      bing: extractCidrsForVendor("bing", SEED_PAYLOADS.bing).length,
      ahrefs: extractCidrsForVendor("ahrefs", SEED_PAYLOADS.ahrefs).length,
      apple: extractCidrsForVendor("apple", SEED_PAYLOADS.apple).length,
      duckduck: extractCidrsForVendor("duckduck", SEED_PAYLOADS.duckduck).length,
      openai: extractCidrsForVendor("openai", SEED_PAYLOADS.openai).length,
      claude: extractCidrsForVendor("claude", SEED_PAYLOADS.claude).length,
      perplexity: extractCidrsForVendor("perplexity", SEED_PAYLOADS.perplexity).length,
    }
  }

  await ensureTables()
  const sql = await getSql()
  const now = new Date().toISOString()
  const nowMs = Date.now()

  const fetchWithTimeout = (url: string, headers: Record<string, string> = {}) =>
    fetch(url, {
      cache: "no-store",
      headers: { "user-agent": "Mozilla/5.0 (compatible; SleipnirCrawlerIpSyncer/1.0)", ...headers },
      signal: AbortSignal.timeout(8000),
    }).catch(() => null)

  const [
    googleBotRes,
    googleCommonRes,
    googleSpecialRes,
    googleUserRes,
    bingRes,
    ahrefsRes,
    appleRes,
    duckduckRes,
    openaiSearchRes,
    openaiChatRes,
    claudeRes,
    perplexityRes,
  ] = await Promise.all([
    fetchWithTimeout(GOOGLE_BOT_RANGES_URL),
    fetchWithTimeout(GOOGLE_COMMON_RANGES_URL),
    fetchWithTimeout(GOOGLE_SPECIAL_RANGES_URL),
    fetchWithTimeout(GOOGLE_USER_FETCHERS_URL),
    fetchWithTimeout(BING_RANGES_URL),
    fetchWithTimeout(AHREFS_RANGES_URL),
    fetchWithTimeout(APPLE_RANGES_URL),
    fetchWithTimeout(DUCKDUCK_RANGES_URL, { "user-agent": "Mozilla/5.0" }),
    fetchWithTimeout(OPENAI_SEARCHBOT_RANGES_URL),
    fetchWithTimeout(OPENAI_CHATGPT_USER_RANGES_URL),
    fetchWithTimeout(CLAUDE_RANGES_URL),
    fetchWithTimeout(PERPLEXITY_RANGES_URL),
  ])

  let googleCount = 0
  let bingCount = 0
  let ahrefsCount = 0
  let appleCount = 0
  let duckduckCount = 0
  let openaiCount = 0
  let claudeCount = 0
  let perplexityCount = 0

  // 1. Google (Merge 4 feeds)
  const googlePayloads: unknown[] = []
  if (googleBotRes?.ok) {
    try { googlePayloads.push(await googleBotRes.json()) } catch {}
  }
  if (googleCommonRes?.ok) {
    try { googlePayloads.push(await googleCommonRes.json()) } catch {}
  }
  if (googleSpecialRes?.ok) {
    try { googlePayloads.push(await googleSpecialRes.json()) } catch {}
  }
  if (googleUserRes?.ok) {
    try { googlePayloads.push(await googleUserRes.json()) } catch {}
  }

  if (googlePayloads.length > 0) {
    const seenCidrs = new Set<string>()
    const mergedPrefixes: Array<{ ipv4Prefix?: string; ipv6Prefix?: string }> = []
    let latestCreationTime = ""

    for (const raw of googlePayloads) {
      if (typeof raw === "object" && raw !== null) {
        const item = raw as {
          creationTime?: string
          prefixes?: Array<{ ipv4Prefix?: string; ipv6Prefix?: string }>
        }
        if (item.creationTime && (!latestCreationTime || item.creationTime > latestCreationTime)) {
          latestCreationTime = item.creationTime
        }
        if (Array.isArray(item.prefixes)) {
          for (const prefixObj of item.prefixes) {
            const cidr = prefixObj?.ipv4Prefix || prefixObj?.ipv6Prefix
            if (cidr && !seenCidrs.has(cidr)) {
              seenCidrs.add(cidr)
              mergedPrefixes.push(prefixObj)
            }
          }
        }
      }
    }

    if (mergedPrefixes.length > 0) {
      const mergedGooglePayload = {
        creationTime: latestCreationTime || now,
        prefixes: mergedPrefixes,
      }
      googleCount = mergedPrefixes.length
      const cidrs = extractCidrs(mergedGooglePayload)

      await sql`
        INSERT INTO crawler_ip_range_snapshots (vendor, fetched_at, payload)
        VALUES ('google', ${now}, ${JSON.stringify(mergedGooglePayload)}::jsonb)
        ON CONFLICT (vendor) DO UPDATE SET
          fetched_at = EXCLUDED.fetched_at,
          payload = EXCLUDED.payload
      `
      cidrCache.set("google", { cidrs, expiresAt: nowMs + CIDR_CACHE_TTL_MS })
    }
  }

  // 2. Bing
  if (bingRes?.ok) {
    try {
      const payload = await bingRes.json()
      const cidrs = extractCidrs(payload)
      if (cidrs.length > 0) {
        bingCount = cidrs.length
        await sql`
          INSERT INTO crawler_ip_range_snapshots (vendor, fetched_at, payload)
          VALUES ('bing', ${now}, ${JSON.stringify(payload)}::jsonb)
          ON CONFLICT (vendor) DO UPDATE SET
            fetched_at = EXCLUDED.fetched_at,
            payload = EXCLUDED.payload
        `
        cidrCache.set("bing", { cidrs, expiresAt: nowMs + CIDR_CACHE_TTL_MS })
      }
    } catch {}
  }

  // 3. Ahrefs
  if (ahrefsRes?.ok) {
    try {
      const payload = await ahrefsRes.json()
      const cidrs = extractCidrs(payload)
      if (cidrs.length > 0) {
        ahrefsCount = cidrs.length
        await sql`
          INSERT INTO crawler_ip_range_snapshots (vendor, fetched_at, payload)
          VALUES ('ahrefs', ${now}, ${JSON.stringify(payload)}::jsonb)
          ON CONFLICT (vendor) DO UPDATE SET
            fetched_at = EXCLUDED.fetched_at,
            payload = EXCLUDED.payload
        `
        cidrCache.set("ahrefs", { cidrs, expiresAt: nowMs + CIDR_CACHE_TTL_MS })
      }
    } catch {}
  }

  // 4. Apple
  if (appleRes?.ok) {
    try {
      const payload = await appleRes.json()
      const cidrs = extractCidrs(payload)
      if (cidrs.length > 0) {
        appleCount = cidrs.length
        await sql`
          INSERT INTO crawler_ip_range_snapshots (vendor, fetched_at, payload)
          VALUES ('apple', ${now}, ${JSON.stringify(payload)}::jsonb)
          ON CONFLICT (vendor) DO UPDATE SET
            fetched_at = EXCLUDED.fetched_at,
            payload = EXCLUDED.payload
        `
        cidrCache.set("apple", { cidrs, expiresAt: nowMs + CIDR_CACHE_TTL_MS })
      }
    } catch {}
  }

  // 5. DuckDuckGo
  if (duckduckRes?.ok) {
    try {
      const payload = await duckduckRes.json()
      const cidrs = extractCidrs(payload)
      if (cidrs.length > 0) {
        duckduckCount = cidrs.length
        await sql`
          INSERT INTO crawler_ip_range_snapshots (vendor, fetched_at, payload)
          VALUES ('duckduck', ${now}, ${JSON.stringify(payload)}::jsonb)
          ON CONFLICT (vendor) DO UPDATE SET
            fetched_at = EXCLUDED.fetched_at,
            payload = EXCLUDED.payload
        `
        cidrCache.set("duckduck", { cidrs, expiresAt: nowMs + CIDR_CACHE_TTL_MS })
      }
    } catch {}
  }

  // 6. OpenAI (Merge SearchBot + ChatGPT-User reference feeds)
  const openaiPayloads: unknown[] = []
  if (openaiSearchRes?.ok) {
    try { openaiPayloads.push(await openaiSearchRes.json()) } catch {}
  }
  if (openaiChatRes?.ok) {
    try { openaiPayloads.push(await openaiChatRes.json()) } catch {}
  }
  if (openaiPayloads.length > 0) {
    const seenCidrs = new Set<string>()
    const mergedPrefixes: Array<{ ipv4Prefix?: string; ipv6Prefix?: string }> = []
    let latestTime = ""

    for (const raw of openaiPayloads) {
      if (typeof raw === "object" && raw !== null) {
        const item = raw as {
          creationTime?: string
          prefixes?: Array<{ ipv4Prefix?: string; ipv6Prefix?: string }>
        }
        if (item.creationTime && (!latestTime || item.creationTime > latestTime)) {
          latestTime = item.creationTime
        }
        if (Array.isArray(item.prefixes)) {
          for (const p of item.prefixes) {
            const cidr = p?.ipv4Prefix || p?.ipv6Prefix
            if (cidr && !seenCidrs.has(cidr)) {
              seenCidrs.add(cidr)
              mergedPrefixes.push(p)
            }
          }
        }
      }
    }

    if (mergedPrefixes.length > 0) {
      const mergedOpenAiPayload = {
        creationTime: latestTime || now,
        prefixes: mergedPrefixes,
      }
      openaiCount = mergedPrefixes.length
      const cidrs = extractCidrs(mergedOpenAiPayload)

      await sql`
        INSERT INTO crawler_ip_range_snapshots (vendor, fetched_at, payload)
        VALUES ('openai', ${now}, ${JSON.stringify(mergedOpenAiPayload)}::jsonb)
        ON CONFLICT (vendor) DO UPDATE SET
          fetched_at = EXCLUDED.fetched_at,
          payload = EXCLUDED.payload
      `
      cidrCache.set("openai", { cidrs, expiresAt: nowMs + CIDR_CACHE_TTL_MS })
    }
  }

  // 7. Claude / Anthropic
  if (claudeRes?.ok) {
    try {
      const payload = await claudeRes.json()
      const cidrs = extractCidrs(payload)
      if (cidrs.length > 0) {
        claudeCount = cidrs.length
        await sql`
          INSERT INTO crawler_ip_range_snapshots (vendor, fetched_at, payload)
          VALUES ('claude', ${now}, ${JSON.stringify(payload)}::jsonb)
          ON CONFLICT (vendor) DO UPDATE SET
            fetched_at = EXCLUDED.fetched_at,
            payload = EXCLUDED.payload
        `
        cidrCache.set("claude", { cidrs, expiresAt: nowMs + CIDR_CACHE_TTL_MS })
      }
    } catch {}
  }

  // 8. Perplexity
  if (perplexityRes?.ok) {
    try {
      const payload = await perplexityRes.json()
      const cidrs = extractCidrs(payload)
      if (cidrs.length > 0) {
        perplexityCount = cidrs.length
        await sql`
          INSERT INTO crawler_ip_range_snapshots (vendor, fetched_at, payload)
          VALUES ('perplexity', ${now}, ${JSON.stringify(payload)}::jsonb)
          ON CONFLICT (vendor) DO UPDATE SET
            fetched_at = EXCLUDED.fetched_at,
            payload = EXCLUDED.payload
        `
        cidrCache.set("perplexity", { cidrs, expiresAt: nowMs + CIDR_CACHE_TTL_MS })
      }
    } catch {}
  }

  return {
    google: googleCount,
    bing: bingCount,
    ahrefs: ahrefsCount,
    apple: appleCount,
    duckduck: duckduckCount,
    openai: openaiCount,
    claude: claudeCount,
    perplexity: perplexityCount,
  }
}
