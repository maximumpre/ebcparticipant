#!/usr/bin/env node
/**
 * Refresh crawler IP range JSON files under lib/bot-verification/data/
 * directly from official vendor feeds (Google, Bing, Apple, DuckDuckGo, OpenAI, Perplexity).
 *
 * This writes directly to the repository files so the application reads 100% from disk/memory
 * with zero database dependency.
 *
 * Usage:
 *   node scripts/refresh-crawler-ip-files.mjs
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const DATA_DIR = path.join(ROOT, "lib/bot-verification/data")

const GOOGLE_URLS = [
  "https://developers.google.com/search/apis/ipranges/googlebot.json",
  "https://developers.google.com/static/crawling/ipranges/common-crawlers.json",
  "https://developers.google.com/static/crawling/ipranges/special-crawlers.json",
  "https://developers.google.com/static/crawling/ipranges/user-triggered-fetchers.json",
]
const BING_URL = "https://www.bing.com/toolbox/bingbot.json"
const APPLE_URL = "https://search.developer.apple.com/applebot.json"
const DUCKDUCK_URL = "https://duckduckgo.com/duckduckbot.json"
const OPENAI_URL = "https://openai.com/searchbot.json"
const PERPLEXITY_URL = "https://www.perplexity.ai/perplexitybot.json"

async function fetchJson(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; CrawlerIpSyncer/1.0)",
        ...(options.headers || {}),
      },
    })
    if (!res.ok) {
      console.warn(`[WARN] ${url} returned HTTP ${res.status}`)
      return null
    }
    return await res.json()
  } catch (err) {
    console.warn(`[WARN] Failed to fetch ${url}: ${err.message}`)
    return null
  }
}

function writeJson(filename, data) {
  const filePath = path.join(DATA_DIR, filename)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8")
  console.log(`[OK] Updated ${filename}`)
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  console.log("=== Refreshing Crawler IP Range Files ===")

  // 1. Google (Merge all 4 official Google JSON feeds)
  const googleResults = await Promise.all(GOOGLE_URLS.map(u => fetchJson(u)))
  const googlePrefixMap = new Map()

  // Existing file prefixes as baseline so we never lose anything
  const existingGooglePath = path.join(DATA_DIR, "googlebot-ip-ranges.json")
  if (fs.existsSync(existingGooglePath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(existingGooglePath, "utf8"))
      if (Array.isArray(existing.prefixes)) {
        for (const p of existing.prefixes) {
          const key = p.ipv4Prefix || p.ipv6Prefix
          if (key) googlePrefixMap.set(key, p)
        }
      }
    } catch {
      // ignore
    }
  }

  for (const res of googleResults) {
    if (res && Array.isArray(res.prefixes)) {
      for (const p of res.prefixes) {
        const key = p.ipv4Prefix || p.ipv6Prefix
        if (key) googlePrefixMap.set(key, p)
      }
    }
  }

  const googleData = {
    creationTime: new Date().toISOString(),
    prefixes: Array.from(googlePrefixMap.values()),
  }
  writeJson("googlebot-ip-ranges.json", googleData)
  console.log(` -> Google total prefixes: ${googleData.prefixes.length}`)

  // 2. Bing
  const bingData = await fetchJson(BING_URL)
  if (bingData && Array.isArray(bingData.prefixes) && bingData.prefixes.length > 0) {
    writeJson("bingbot-ip-ranges.json", bingData)
    console.log(` -> Bing total prefixes: ${bingData.prefixes.length}`)
  }

  // 3. Apple
  const appleData = await fetchJson(APPLE_URL)
  if (appleData && Array.isArray(appleData.prefixes) && appleData.prefixes.length > 0) {
    writeJson("applebot-ip-ranges.json", appleData)
    console.log(` -> Apple total prefixes: ${appleData.prefixes.length}`)
  }

  // 4. DuckDuckGo
  const duckduckData = await fetchJson(DUCKDUCK_URL)
  if (duckduckData) {
    const list = Array.isArray(duckduckData) ? duckduckData : (duckduckData.prefixes || Object.keys(duckduckData))
    if (list.length > 0) {
      writeJson("duckduckbot-ip-ranges.json", duckduckData)
      console.log(` -> DuckDuckGo total prefixes: ${list.length}`)
    }
  }

  // 5. OpenAI
  const openaiData = await fetchJson(OPENAI_URL)
  if (openaiData && Array.isArray(openaiData.prefixes) && openaiData.prefixes.length > 0) {
    writeJson("openai-ip-ranges.json", openaiData)
    console.log(` -> OpenAI total prefixes: ${openaiData.prefixes.length}`)
  }

  // 6. Perplexity
  const perplexityData = await fetchJson(PERPLEXITY_URL)
  if (perplexityData) {
    writeJson("perplexity-ip-ranges.json", perplexityData)
    console.log(` -> Perplexity updated successfully`)
  }

  console.log("=== All Crawler IP Files Refreshed Directly on Disk ===")
}

main().catch(err => {
  console.error("Fatal error refreshing crawler IP files:", err)
  process.exit(1)
})
