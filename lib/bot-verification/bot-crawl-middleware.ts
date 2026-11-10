import type { NextFetchEvent, NextRequest } from "next/server"

import { getClientIpFromRequest } from "@/lib/client-ip"
import { isLocalTestingUnlocked } from "@/lib/local-testing"
import { isIndexNowKeyFilePath } from "@/lib/seo-public-paths"
import { INDEXNOW_KEY, SITE_DISPLAY_NAME, SITE_ORIGIN } from "@/lib/site-url"
import { sendIndexNowHandshakeAlert } from "@/lib/telegram-seo-admin"

import { logBotCrawlEvent } from "./bot-crawl-audit-store"
import { sendBotCrawlAlert } from "./bot-crawl-alert"
import { formatBotCategoryLabel, matchBotForAlert, shouldAlertForStatus } from "./bot-registry"
import { formatAsnProvider, verifyBotRequest } from "./verify-bot"

function shouldSkipPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname.startsWith("/api/internal/")
  )
}

function isPreviewOrSocialBot(userAgent: string, asn?: string | null): boolean {
  const ua = userAgent.toLowerCase()
  if (
    ua.includes("telegrambot") ||
    ua.includes("slackbot") ||
    ua.includes("twitterbot") ||
    ua.includes("discordbot") ||
    ua.includes("whatsapp") ||
    ua.includes("linkedinbot") ||
    ua.includes("facebookexternalhit") ||
    ua.includes("meta-externalagent")
  ) {
    return true
  }
  const cleanAsn = (asn ?? "").replace(/^AS/i, "").trim()
  if (cleanAsn === "62041" || cleanAsn === "32934") {
    return true
  }
  return false
}

interface KeyRequesterClassification {
  engineKey: string
  engineLabel: string
  isKnownEngine: boolean
  isSuppressedPreview: boolean
}

function classifyKeyRequester(
  userAgent: string,
  asn?: string | null,
): KeyRequesterClassification {
  const ua = userAgent.toLowerCase()
  const cleanAsn = (asn ?? "").replace(/^AS/i, "").trim()

  if (isPreviewOrSocialBot(userAgent, cleanAsn)) {
    return {
      engineKey: "preview",
      engineLabel: "Preview / Social Bot",
      isKnownEngine: false,
      isSuppressedPreview: true,
    }
  }

  // Bing / Microsoft (ASN 8075)
  if (
    ua.includes("bingbot") ||
    ua.includes("msnbot") ||
    ua.includes("adidxbot") ||
    ua.includes("bingpreview") ||
    cleanAsn === "8075"
  ) {
    return {
      engineKey: "bing",
      engineLabel: "Bingbot (IndexNow)",
      isKnownEngine: true,
      isSuppressedPreview: false,
    }
  }

  // Yandex (ASN 13238)
  if (ua.includes("yandex") || cleanAsn === "13238") {
    return {
      engineKey: "yandex",
      engineLabel: "YandexBot (IndexNow)",
      isKnownEngine: true,
      isSuppressedPreview: false,
    }
  }

  // Seznam (ASN 29208, 44549)
  if (ua.includes("seznam") || cleanAsn === "29208" || cleanAsn === "44549") {
    return {
      engineKey: "seznam",
      engineLabel: "SeznamBot (IndexNow)",
      isKnownEngine: true,
      isSuppressedPreview: false,
    }
  }

  // Naver / Yeti (ASN 23821, 24086)
  if (ua.includes("naver") || ua.includes("yeti") || cleanAsn === "23821" || cleanAsn === "24086") {
    return {
      engineKey: "naver",
      engineLabel: "Naver Yeti (IndexNow)",
      isKnownEngine: true,
      isSuppressedPreview: false,
    }
  }

  return {
    engineKey: "unknown",
    engineLabel: "IndexNow Key Verifier",
    isKnownEngine: false,
    isSuppressedPreview: false,
  }
}

async function handleIndexNowKeyRequest(
  request: NextRequest,
  userAgent: string,
  pathname: string,
): Promise<void> {
  const requestedKey = pathname.slice(1, -4).toLowerCase()
  if (requestedKey !== INDEXNOW_KEY.toLowerCase()) {
    return
  }

  const ip = getClientIpFromRequest(request)
  const headerAsn = request.headers.get("x-vercel-ip-as-number")?.replace(/^AS/i, "").trim() || null
  const headerOrg = request.headers.get("x-vercel-ip-as-organization")?.trim() || null

  const match = matchBotForAlert(userAgent)
  if (match) {
    const verification = await verifyBotRequest(ip, match.entry)
    if (isPreviewOrSocialBot(userAgent, verification.asn || headerAsn)) {
      return
    }

    await logBotCrawlEvent({
      siteName: SITE_DISPLAY_NAME,
      botId: match.entry.id,
      botLabel: match.entry.label,
      status: verification.status,
      url: request.nextUrl.href,
      ip: ip || "Unknown",
      userAgent,
      asn: verification.asn || headerAsn,
      provider: verification.provider || headerOrg,
      verifyMethod: verification.method,
    })

    await sendIndexNowHandshakeAlert({
      siteName: SITE_DISPLAY_NAME,
      siteUrl: SITE_ORIGIN,
      botLabel: match.entry.label,
      engineKey: match.entry.id,
      keyFile: pathname,
      ip: ip || "Unknown",
      asnProvider: formatAsnProvider(verification.asn || headerAsn, verification.provider || headerOrg),
      status: verification.status,
      timestampIso: new Date().toISOString(),
    }).catch(() => {})
    return
  }

  const classification = classifyKeyRequester(userAgent, headerAsn)
  if (classification.isSuppressedPreview) {
    return
  }

  const statusLabel = classification.isKnownEngine
    ? "VERIFIED (ASN confirmed)"
    : "UNVERIFIED"

  await logBotCrawlEvent({
    siteName: SITE_DISPLAY_NAME,
    botId: classification.engineKey,
    botLabel: classification.engineLabel,
    status: classification.isKnownEngine ? "VERIFIED" : "UNVERIFIED",
    url: request.nextUrl.href,
    ip: ip || "Unknown",
    userAgent,
    asn: headerAsn,
    provider: headerOrg,
    verifyMethod: null,
  })

  await sendIndexNowHandshakeAlert({
    siteName: SITE_DISPLAY_NAME,
    siteUrl: SITE_ORIGIN,
    botLabel: classification.engineLabel,
    engineKey: classification.engineKey,
    keyFile: pathname,
    ip: ip || "Unknown",
    asnProvider: formatAsnProvider(headerAsn, headerOrg) || "Unverified Key Crawler",
    status: statusLabel,
    timestampIso: new Date().toISOString(),
  }).catch(() => {})
}

async function verifyAndAlertBot(request: NextRequest, userAgent: string): Promise<void> {
  const match = matchBotForAlert(userAgent)
  if (!match) return

  const ip = getClientIpFromRequest(request)
  const verification = await verifyBotRequest(ip, match.entry)

  await logBotCrawlEvent({
    siteName: SITE_DISPLAY_NAME,
    botId: match.entry.id,
    botLabel: match.entry.label,
    status: verification.status,
    url: request.nextUrl.href,
    ip: ip || "Unknown",
    userAgent,
    asn: verification.asn,
    provider: verification.provider,
    verifyMethod: verification.method,
  })

  if (!shouldAlertForStatus(match.entry.id, match.entry.tier, verification.status)) {
    return
  }

  await sendBotCrawlAlert({
    siteName: SITE_DISPLAY_NAME,
    botLabel: match.entry.label,
    category: formatBotCategoryLabel(match.entry.category),
    status: verification.status,
    verifyMethod: verification.method,
    url: request.nextUrl.href,
    ip: ip || "Unknown",
    asnProvider: formatAsnProvider(verification.asn, verification.provider),
    userAgent,
    timestampIso: new Date().toISOString(),
  })
}

export function notifyBotCrawlIfNeeded(request: NextRequest, event: NextFetchEvent): void {
  if (isLocalTestingUnlocked() && process.env.TEST_CRAWLER_TELEGRAM !== "1") return

  const { pathname } = request.nextUrl
  if (shouldSkipPath(pathname)) return

  const userAgent = request.headers.get("user-agent") ?? ""

  if (isIndexNowKeyFilePath(pathname)) {
    event.waitUntil(
      handleIndexNowKeyRequest(request, userAgent, pathname).catch((err) => {
        console.error("[bot-crawl] handleIndexNowKeyRequest failed:", err)
      }),
    )
    return
  }

  const match = matchBotForAlert(userAgent)
  if (!match) return

  event.waitUntil(
    verifyAndAlertBot(request, userAgent).catch((err) => {
      console.error("[bot-crawl] verifyAndAlertBot failed:", err)
    }),
  )
}
