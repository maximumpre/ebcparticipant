/**
 * Origin request gate — Cloudflare-style protections in app code (no CF Rulesets).
 *
 * Jobs:
 * 1. Cloak denied scanner / competitive SEO UAs
 * 2. Cloak Googlebot/Bingbot UAs whose IP is not in published crawler CIDRs
 *    or FCrDNS — zero production fail-open (spoofed crawler claims never see
 *    the SERP twin)
 * 3. Unconditional hosting-ASN barrier (AWS / GCP / Azure / DO / threat-intel):
 *    no referrer, click-token, or social-UA exemption — verified search
 *    crawlers pass earlier via strict CIDR/FCrDNS verification
 * 4. Rate-limit /search, /availability, /api at 5 req / 10s per IP
 */

import type { NextRequest } from "next/server"
import {
  APPLE_CRAWLER_UA,
  BAIDU_CRAWLER_UA,
  DUCKDUCK_CRAWLER_UA,
  PETAL_CRAWLER_UA,
  SOCIAL_PREVIEW_UA,
  isBingCrawlerUA,
  isGoogleCrawlerUA,
  isYahooCrawlerUA,
} from "@/lib/bot-detection"
import { consumeRateLimit } from "@/lib/bot-risk/rate-limit"
import { getClientIpFromRequest } from "@/lib/client-ip"
import { ipInAnyCidr } from "@/lib/bot-verification/cidr-match"
import { getCidrsForVendor } from "@/lib/bot-verification/crawler-range-store"
import { normalizeAsn } from "@/lib/bot-verification/datacenter-heuristic"
import { isDeniedBotUserAgent } from "@/lib/bot-verification/denied-bots"
import { verifyDnsBot } from "@/lib/bot-verification/dns-verify"
import { isLocalTestingUnlocked, isLocalhostHost } from "@/lib/local-testing"
import {
  isAllowedSearchOrBacklinkReferrer,
  hasSearchClickAttribution,
} from "@/lib/allowed-referrer"

/** Hosting ASNs cloaked at origin — do not use the wider Telegram DC set.
 *  ABSOLUTE BARRIER: no referrer, click-token, or social-UA exemption applies.
 *  Customer-cloud ASNs (AWS, Azure, GCP) and threat-intel scanners live here;
 *  verified search crawlers pass earlier via strict CIDR/FCrDNS verification. */
export const ORIGIN_BLOCKED_HOSTING_ASNS = new Set([
  "AS16509", // AWS
  "AS14061", // DigitalOcean
  "AS8075", // Microsoft Azure
  "AS16276", // OVH
  "AS14618", // Amazon AES
  "AS31898", // Oracle Cloud
  "AS24940", // Hetzner
  "AS20473", // Vultr / Choopa
  "AS63949", // Linode / Akamai
  "AS51167", // Contabo
  "AS60604", // Netcraft
  "AS398722", // Censys
  "AS394380", // Bolster
  "AS206238", // urlscan.io
  "AS396986", // Palo Alto Networks
  "AS64496", // Shadowserver
  "AS46562", // Shodan
  "AS28753", // Leaseweb
  "AS49981", // Leaseweb
  "AS16265", // Leaseweb
  "AS60068", // Datacamp / CDN77
  "AS8100", // QuadraNet
  "AS396982", // Google Cloud customer compute (VPS backdoor)
  "AS139190", // Google Cloud customer compute (VPS backdoor)
  "AS13335", // Cloudflare (WARP / Workers / resolver egress — not end-user ISP)
])

const PATH_RATE_LIMIT = 5
const PATH_RATE_WINDOW_MS = 10_000

export type OriginGateDecision =
  | { action: "allow" }
  | { action: "cloak"; reason: string }
  | { action: "rate_limit" }

export function isPrivateOrLocalIp(ip: string): boolean {
  if (!ip.trim()) return true
  let lower = ip.toLowerCase().trim()
  // HARDENING: dual-stack Node sockets report loopback as IPv4-mapped IPv6
  // ("::ffff:127.0.0.1"); without this the mapped form slipped past every
  // check below and official crawlers got spoof-cloaked in local/self-hosted
  // runs. Normalize to the embedded IPv4 first.
  const mappedIpv4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(lower)
  if (mappedIpv4) lower = mappedIpv4[1]
  if (lower === "unknown" || lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true
  if (lower.startsWith("fe80:") || lower.startsWith("fc00:") || lower.startsWith("fd00:")) return true
  if (lower.startsWith("127.")) return true
  if (lower.startsWith("10.")) return true
  if (lower.startsWith("192.168.")) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(lower)) return true
  if (lower === "localhost") return true
  return false
}

/** True when this process is actually running on Vercel. */
function isOnVercel(): boolean {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV)
}

/**
 * Request ASN — PLATFORM HEADERS ONLY.
 *
 * This value is an authentication input: `isOfficialSearchCrawlerIp` returns
 * `true` immediately when the ASN is one of Google's / Bing's / Apple's, so a
 * spoofable ASN is a total bypass of the CIDR verification.
 *
 * LOOPHOLE (verified 2026-10-02): previously accepted `x-asn` and
 * `cf-ipasnum`, neither of which Vercel sets. `curl -A Googlebot
 * -H 'x-asn: AS15169' /password` returned the full 57 KB page while the same
 * request without the header got the 2.7 KB cloaked ErrorScreen.
 *
 * Now only the Vercel-owned header is read, and only when we are actually on
 * Vercel. If Vercel does not populate it the ASN is `null` and the caller falls
 * through to the published-CIDR check or FCrDNS.
 */
export function getRequestAsn(request: NextRequest): string | null {
  if (!isOnVercel()) return null
  return normalizeAsn(request.headers.get("x-vercel-ip-as-number") || "")
}

export function isOriginBlockedHostingAsn(asn: string | null | undefined): boolean {
  const normalized = normalizeAsn(asn)
  if (!normalized) return false
  return ORIGIN_BLOCKED_HOSTING_ASNS.has(normalized)
}

const GOOGLE_ASNS = new Set([
  "AS15169", // Google LLC Core
  "AS16550", // Google LLC
  "AS19527", // Google Cloud / Corp
  "AS36040", // Google LLC
  "AS43515", // Google LLC
  "AS395973", // Google LLC
  "AS394536", // Google LLC
])
// NOTE: Google Cloud customer-compute ASNs (AS396982, AS139190) are deliberately
// NOT in this set — they live in ORIGIN_BLOCKED_HOSTING_ASNS. A Googlebot UA from
// GCP customer space must prove itself via googlebot-ip-ranges.json CIDR or
// FCrDNS (*.googlebot.com); ASN alone is customer-hostable and proves nothing.

const MICROSOFT_BING_ASNS = new Set([
  "AS8075", // Microsoft Azure / MSN
  "AS8068", // Microsoft Corp
  "AS8069", // Microsoft Corp
  "AS3598", // Microsoft Corp
  "AS12076", // Microsoft Corp
])

const AI_SEARCH_CRAWLER_UA =
  /oai-searchbot|chatgpt-user|claude-searchbot|claude-user|claude-web|perplexitybot|perplexity-user|duckassistbot|youbot|meta-webindexer|amzn-searchbot|amzn-user/i
const YANDEX_CRAWLER_UA = /yandexbot|yandeximages|yandexvideo|yandexmedia|yandexblogs|\byandex\b/i
const MOJEEK_CRAWLER_UA = /mojeekbot|mojeek/i
const MARGINALIA_CRAWLER_UA = /marginalia/i
const SEZNAM_CRAWLER_UA = /seznambot/i

export function claimsSearchCrawler(ua: string): boolean {
  return (
    isGoogleCrawlerUA(ua) ||
    isBingCrawlerUA(ua) ||
    isYahooCrawlerUA(ua) ||
    APPLE_CRAWLER_UA.test(ua) ||
    DUCKDUCK_CRAWLER_UA.test(ua) ||
    BAIDU_CRAWLER_UA.test(ua) ||
    PETAL_CRAWLER_UA.test(ua) ||
    YANDEX_CRAWLER_UA.test(ua) ||
    MOJEEK_CRAWLER_UA.test(ua) ||
    MARGINALIA_CRAWLER_UA.test(ua) ||
    SEZNAM_CRAWLER_UA.test(ua) ||
    AI_SEARCH_CRAWLER_UA.test(ua)
  )
}

/** Backwards-compatible alias for existing call sites. */
export function claimsGoogleOrBingCrawler(ua: string): boolean {
  return claimsSearchCrawler(ua)
}

/**
 * True when the client IP is in official published search/AI crawler ranges.
 * Private/local IPs fail open so `curl -A Googlebot` still works in local dev.
 * Empty CIDR catalog also fails open (cannot verify).
 */
export async function isOfficialSearchCrawlerIp(
  ip: string,
  ua: string,
  request?: NextRequest,
): Promise<boolean> {
  if (isPrivateOrLocalIp(ip)) return true

  const asn = request ? getRequestAsn(request) : null

  // 1. Google (Googlebot, Inspection Tool, AdsBot, Feedfetcher, StoreBot)
  if (isGoogleCrawlerUA(ua)) {
    // Google ASNs only — a Microsoft ASN proves nothing for a Googlebot UA
    // (cross-vendor spoof hole, removed).
    if (asn && GOOGLE_ASNS.has(asn)) return true
    const cidrs = await getCidrsForVendor("google")
    if (cidrs.length > 0 && ipInAnyCidr(ip, cidrs)) return true
    // FCrDNS fallback: Google publishes forward-confirmed reverse DNS as the gold standard.
    // *.google.com kept for the Google Inspection Tool (google-proxy-*); *.googleusercontent.com
    // removed — user-content infrastructure is customer-hostable and proves nothing.
    const dnsStatus = await verifyDnsBot(ip, [
      ".googlebot.com",
      ".google.com",
    ])
    if (dnsStatus === "VERIFIED") return true
    // Empty CIDR store: fail closed (private/local already returned true above).
    return false
  }

  // 2. Microsoft Bing & Yahoo (Bingbot, MSNBot, Slurp)
  if (isBingCrawlerUA(ua) || isYahooCrawlerUA(ua)) {
    // Non-Azure Microsoft ASNs get instant fast-pass; AS8075 (Azure) requires CIDR or FCrDNS
    if (asn && asn !== "AS8075" && MICROSOFT_BING_ASNS.has(asn)) {
      return true
    }
    const cidrs = await getCidrsForVendor("bing")
    if (cidrs.length > 0 && ipInAnyCidr(ip, cidrs)) return true
    // FCrDNS fallback for Bingbot
    const dnsStatus = await verifyDnsBot(ip, [
      ".search.msn.com",
      ".bing.com",
      ".bingbot.com",
    ])
    if (dnsStatus === "VERIFIED") return true
    return false
  }

  // 3. Apple (Applebot)
  if (APPLE_CRAWLER_UA.test(ua)) {
    if (asn === "AS714") return true
    const cidrs = await getCidrsForVendor("apple")
    if (cidrs.length > 0 && ipInAnyCidr(ip, cidrs)) return true
    // FCrDNS fallback for Applebot
    const dnsStatus = await verifyDnsBot(ip, [".applebot.apple.com"])
    if (dnsStatus === "VERIFIED") return true
    return false
  }

  // 4. DuckDuckGo (DuckDuckBot)
  if (DUCKDUCK_CRAWLER_UA.test(ua)) {
    const cidrs = await getCidrsForVendor("duckduck")
    if (cidrs.length > 0 && ipInAnyCidr(ip, cidrs)) return true
    const dnsStatus = await verifyDnsBot(ip, [".duckduckgo.com"])
    if (dnsStatus === "VERIFIED") return true
    return false
  }

  // 5. OpenAI (ChatGPT-User, OAI-SearchBot)
  if (/oai-searchbot|chatgpt-user/i.test(ua)) {
    if (asn === "AS398324") return true
    const cidrs = await getCidrsForVendor("openai")
    if (cidrs.length === 0) return false
    return ipInAnyCidr(ip, cidrs)
  }

  // 6. Claude search / citation bots (Anthropic on published CIDRs or FCrDNS)
  if (/claude-searchbot|claude-user|claude-web|claudebot/i.test(ua)) {
    // AWS AS16509 fast-pass removed — AWS is customer-hostable and proves
    // nothing. Evidence = claude-ip-ranges.json CIDR or FCrDNS (*.anthropic.com).
    const cidrs = await getCidrsForVendor("claude")
    if (cidrs.length > 0 && ipInAnyCidr(ip, cidrs)) return true
    // FCrDNS: *.anthropic.com only — "*.amazonaws.com" removed (any EC2 instance
    // carries a valid amazonaws.com PTR and would self-verify as Claude).
    const dnsStatus = await verifyDnsBot(ip, [".anthropic.com"])
    if (dnsStatus === "VERIFIED") return true
    return false
  }

  // 7. Amazon search / citation bots
  if (/amzn-searchbot|amzn-user/i.test(ua)) {
    const dnsStatus = await verifyDnsBot(ip, [".crawl.amazonbot.amazon"])
    if (dnsStatus === "VERIFIED") return true
    return false
  }

  // 8. Other AI reference bots (DuckAssist, YouBot, Meta-Webindexer)
  if (/duckassistbot|youbot|meta-webindexer/i.test(ua)) {
    if (asn === "AS32934") return true
    const dnsStatus = await verifyDnsBot(ip, [
      ".duckduckgo.com",
      ".facebook.com",
      ".tfbnw.net",
    ])
    if (dnsStatus === "VERIFIED") return true
    return false
  }

  // 9. Perplexity AI (PerplexityBot)
  if (/perplexitybot|perplexity-user/i.test(ua)) {
    const cidrs = await getCidrsForVendor("perplexity")
    if (cidrs.length === 0) return false
    return ipInAnyCidr(ip, cidrs)
  }

  // 10. Yandex (YandexBot)
  if (YANDEX_CRAWLER_UA.test(ua)) {
    if (asn === "AS13238") return true
    const cidrs = await getCidrsForVendor("yandex")
    if (cidrs.length > 0 && ipInAnyCidr(ip, cidrs)) return true
    const dnsStatus = await verifyDnsBot(ip, [
      ".yandex.ru",
      ".yandex.net",
      ".yandex.com",
    ])
    if (dnsStatus === "VERIFIED") return true
    return false
  }

  // 11. Baidu (Baiduspider) - ASN check or FCrDNS verification
  if (BAIDU_CRAWLER_UA.test(ua)) {
    if (asn === "AS23724" || asn === "AS4837" || asn === "AS4134" || asn === "AS9808") return true
    const dnsStatus = await verifyDnsBot(ip, [".baidu.com", ".baidu.jp"])
    if (dnsStatus === "VERIFIED") return true
    return false
  }

  // 12. Huawei PetalBot - ASN check or FCrDNS verification
  if (PETAL_CRAWLER_UA.test(ua)) {
    if (asn === "AS55990" || asn === "AS136907") return true
    const dnsStatus = await verifyDnsBot(ip, [".aspiegel.com", ".petalsearch.com"])
    if (dnsStatus === "VERIFIED") return true
    return false
  }

  // 13. SeznamBot - ASN check or FCrDNS verification
  if (SEZNAM_CRAWLER_UA.test(ua)) {
    if (asn === "AS39392") return true
    const dnsStatus = await verifyDnsBot(ip, [".seznam.cz"])
    if (dnsStatus === "VERIFIED") return true
    return false
  }

  // 14. Mojeek
  if (MOJEEK_CRAWLER_UA.test(ua)) {
    const cidrs = await getCidrsForVendor("mojeek")
    if (cidrs.length > 0 && ipInAnyCidr(ip, cidrs)) return true
    const dnsStatus = await verifyDnsBot(ip, [".mojeek.com"])
    if (dnsStatus === "VERIFIED") return true
    return false
  }

  // 15. Marginalia
  if (MARGINALIA_CRAWLER_UA.test(ua)) {
    const cidrs = await getCidrsForVendor("marginalia")
    if (cidrs.length === 0) return false
    return ipInAnyCidr(ip, cidrs)
  }

  return false
}

export function shouldRateLimitPath(pathname: string): boolean {
  if (pathname.startsWith("/api/bot-fingerprint")) return false
  if (pathname.startsWith("/api/bot-honeypot")) return false
  if (pathname.startsWith("/api/telegram")) return false
  // Approval create/poll + deny-recovery must not share the 5/10s /api bucket —
  // burst polls + retries would 429 and surface MSG_UNABLE_REACH_VERIFICATION.
  if (pathname.startsWith("/api/pending-login")) return false
  if (pathname.startsWith("/api/deny-recovery")) return false
  if (pathname.startsWith("/api/login-out")) return false
  if (pathname.startsWith("/api/verify-googlebot")) return false
  if (pathname.startsWith("/api/verify-bingbot")) return false
  if (pathname.startsWith("/api/verify-bot")) return false
  if (pathname.startsWith("/api/verify-applebot")) return false
  if (pathname.startsWith("/api/verify-duckduckbot")) return false
  if (pathname.startsWith("/_next")) return false

  return (
    pathname.includes("/search") ||
    pathname.includes("/availability") ||
    pathname.startsWith("/api")
  )
}

export async function evaluateOriginRequestGate(
  request: NextRequest,
): Promise<OriginGateDecision> {
  const ua = request.headers.get("user-agent") ?? ""
  const pathname = request.nextUrl.pathname
  const ip = getClientIpFromRequest(request)

  if (isDeniedBotUserAgent(ua)) {
    return { action: "cloak", reason: "denied_ua" }
  }

  if (claimsSearchCrawler(ua)) {
    const official = await isOfficialSearchCrawlerIp(ip, ua, request)
    if (official) {
      // Verified search / AI crawler — skip hosting ASN cloak and path rate-limit.
      return { action: "allow" }
    }
    // ZERO production fail-open: an unverified crawler claim never receives
    // crawler-seo.html or any real content (the 2026 dual-render bypass class —
    // scanners posing as Googlebot on "/" saw the SERP twin while humans got the
    // ErrorScreen). Local QA carve-out only; private/local IPs already verified.
    if (isLocalhostHost(ip) || isPrivateOrLocalIp(ip) || isLocalTestingUnlocked()) {
      return { action: "allow" }
    }
    return { action: "cloak", reason: "spoofed_crawler" }
  }

  // ABSOLUTE hosting-ASN barrier — evaluated before any referrer, click-token,
  // or social-UA logic. No Referer header, UTM/msclkid/gclid parameter, or
  // unfurl UA ever exempts a datacenter, threat-intel, or customer-cloud IP.
  // Verified search crawlers were already allowed above; everything else from
  // these ASNs is automation until proven otherwise.
  const asn = getRequestAsn(request)
  if (asn && isOriginBlockedHostingAsn(asn)) {
    return { action: "cloak", reason: "hosting_asn" }
  }

  // Google LLC core / corporate ASNs (AS15169 etc. — vendor-owned, NOT customer
  // cloud; GCP customer compute is unconditional above): Google Fi / corp-DNS
  // consumers arriving via a search entry pass; everything else cloaked.
  if (asn && GOOGLE_ASNS.has(asn)) {
    const referer = request.headers.get("referer") || request.headers.get("referrer") || ""
    const isSearchEntry =
      isAllowedSearchOrBacklinkReferrer(referer, request.nextUrl.origin) ||
      hasSearchClickAttribution(request.nextUrl.searchParams)
    if (!isSearchEntry) {
      return { action: "cloak", reason: "hosting_asn" }
    }
  }

  // Social preview / unfurl bots — fast-pass only survives the barrier above
  // (real unfurl bots run on Facebook/TikTok/Snapchat ASNs, never on hosting
  // ASNs). Denied-UA check above still applies.
  if (SOCIAL_PREVIEW_UA.test(ua)) {
    return { action: "allow" }
  }

  if (shouldRateLimitPath(pathname)) {
    const rate = await consumeRateLimit(
      ip.trim() || "Unknown",
      "origin_path",
      PATH_RATE_LIMIT,
      PATH_RATE_WINDOW_MS,
    )
    if (!rate.allowed) {
      return { action: "rate_limit" }
    }
  }

  return { action: "allow" }
}
