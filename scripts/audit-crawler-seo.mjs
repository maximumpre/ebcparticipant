#!/usr/bin/env node
/**
 * Audit crawler SEO header integrity (GSC human-UI regression).
 * See SEO_CRAWLER_RULES.md — HARD RULES: crawler header integrity.
 *
 * Usage: node scripts/audit-crawler-seo.mjs [project-root]
 * Exit 1 if any check fails.
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

const failures = []

const mw = readIfExists([
  "middleware.ts",
  "src/middleware.ts",
  "proxy.ts",
  "src/proxy.ts",
])

if (!mw) {
  failures.push("missing middleware.ts / proxy.ts")
} else {
  const text = mw.text

  if (!/applySearchCrawlerHeaders|x-crawler-seo-page/.test(text)) {
    failures.push(`${mw.rel}: missing applySearchCrawlerHeaders / x-crawler-seo-page`)
  }

  if (!/x-pathname/.test(text)) {
    failures.push(`${mw.rel}: missing x-pathname stamp (layout UA fallback needs it)`)
  }

  if (!/cookies\.set\(\s*["']x-crawler-seo-page["']/.test(text)) {
    failures.push(`${mw.rel}: missing response cookie x-crawler-seo-page (RSC bridge)`)
  }

  if (!/nextWithHeaders|createNextResponse|attachCrawlerSeoCookie/.test(text)) {
    failures.push(
      `${mw.rel}: missing nextWithHeaders / createNextResponse / attachCrawlerSeoCookie single-exit helper`,
    )
  }

  // After crawler stamps, geo/next must not rebuild from bare request.headers.
  // Allow the initial clone inside applySearchCrawlerHeaders only.
  const withoutApply = text.replace(
    /function applySearchCrawlerHeaders[\s\S]*?\n\}/,
    "/* applySearchCrawlerHeaders omitted */",
  )
  if (/new Headers\(\s*request\.headers\s*\)/.test(withoutApply)) {
    failures.push(
      `${mw.rel}: new Headers(request.headers) outside applySearchCrawlerHeaders — drops crawler stamps (use requestHeaders)`,
    )
  }
}

const layout = readIfExists([
  "app/layout.tsx",
  "src/app/layout.tsx",
  "app/layout.jsx",
  "src/app/layout.jsx",
])

if (!layout) {
  failures.push("missing app/layout.tsx")
} else {
  const text = layout.text

  if (!/CrawlerSeoPage/.test(text)) {
    failures.push(`${layout.rel}: missing CrawlerSeoPage import/render`)
  }

  if (!/x-crawler-seo-page/.test(text)) {
    failures.push(`${layout.rel}: missing x-crawler-seo-page header/cookie check`)
  }

  const hasUaFallback =
    /isSearchCrawlerUA/.test(text) ||
    /x-is-search-crawler/.test(text) ||
    (/SEARCH_CRAWLER_UA/.test(text) && /isSeoCrawlerPath|SEO_CRAWLER_PATHS/.test(text))

  if (!hasUaFallback) {
    failures.push(
      `${layout.rel}: missing UA/path fallback (isSearchCrawlerUA + isSeoCrawlerPath) — header-only check regresses to human UI in GSC`,
    )
  }

  if (!/force-dynamic/.test(text)) {
    failures.push(`${layout.rel}: missing export const dynamic = "force-dynamic"`)
  }
}

const botDetection = readIfExists([
  "utils/botDetection.ts",
  "src/utils/botDetection.ts",
  "lib/botDetection.ts",
  "src/lib/botDetection.ts",
])

if (botDetection) {
  if (!/Google-InspectionTool|google-inspectiontool/i.test(botDetection.text)) {
    failures.push(`${botDetection.rel}: missing Google-InspectionTool in BOT_PATTERNS`)
  }
  if (!/MicrosoftPreview/i.test(botDetection.text)) {
    failures.push(`${botDetection.rel}: missing MicrosoftPreview in bing patterns`)
  }
}

const libBot = readIfExists(["lib/bot-detection.ts", "src/lib/bot-detection.ts"])
if (libBot && !/google-inspectiontool/i.test(libBot.text)) {
  failures.push(`${libBot.rel}: SEARCH_CRAWLER_UA missing google-inspectiontool`)
}

const crawlerPage = readIfExists([
  "components/CrawlerSeoPage.tsx",
  "src/components/CrawlerSeoPage.tsx",
])

if (crawlerPage) {
  const text = crawlerPage.text

  if (!/Related searches:/.test(text)) {
    failures.push(`${crawlerPage.rel}: missing visible Related searches body block`)
  }

  const relatedIdx = text.indexOf("Related searches:")
  if (relatedIdx !== -1) {
    const belowFoldMarkers = [
      "<footer",
      "<Footer",
      "teaser-grid",
      "feature-grid",
      "nb-feature",
      "nbs-teaser",
    ]
    for (const marker of belowFoldMarkers) {
      const idx = text.indexOf(marker)
      if (idx !== -1 && relatedIdx > idx) {
        failures.push(
          `${crawlerPage.rel}: Related searches must appear before "${marker}" (after login, before footer/marketing)`,
        )
      }
    }
  }
}

if (failures.length) {
  console.error(`FAIL ${path.basename(root)} (crawler SEO)`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log(`OK ${path.basename(root)} (crawler SEO — header integrity)`)
