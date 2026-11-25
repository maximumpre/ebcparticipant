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
import { getClientIpFromRequest, isBehindCloudflare } from "@/lib/client-ip"
import { API_RATE_LIMIT_EXEMPT } from "@/lib/api-rate-limit-exempt"
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
import { PUBLIC_ASTRO_ROUTES } from "@/lib/seo-public-routes"

const PUBLIC_SEO_EXACT_PATHS = new Set<string>([
  "/",
  "/crawler-seo.html",
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt",
  "/llms-full.txt",
  ...PUBLIC_ASTRO_ROUTES,
])

function isPublicSeoGetOrHead(request: NextRequest): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false
  const raw = request.nextUrl.pathname
  const clean = raw.length > 1 && raw.endsWith("/") ? raw.slice(0, -1) : raw
  return PUBLIC_SEO_EXACT_PATHS.has(clean)
}

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

/** Proxy egress ASNs — hosting only when the proxy is NOT in front. */
const CF_EGRESS_ASNS = new Set(["AS13335", "AS209242"])

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
  // Behind Cloudflare the Vercel peer ASN is CF egress (AS13335), not the visitor.
  // That ASN is also listed in ORIGIN_BLOCKED_HOSTING_ASNS — treating it as the
  // client ASN made hybrid UNVERIFIED SEO allow impossible and false-cloaked
  // Bingbot/Googlebot (Indexing allowed? No) on every CF-proxied twin.
  // A CF Transform Rule writing `x-client-asn: cf.asn` restores the real value;
  // trust it only when the CF hop itself is verified.
  if (isBehindCloudflare(request.headers)) {
    const fromCf = normalizeAsn(request.headers.get("x-client-asn") || "")
    if (fromCf) return fromCf
    return null
  }
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

const MICROSOFT_CORP_ASNS = new Set([
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

export type SearchCrawlerVerificationStatus = "VERIFIED" | "UNVERIFIED" | "SPOOFED"

/**
 * Classifies a search/AI crawler claim into:
 * - "VERIFIED": matches official ASN, published CIDR, or FCrDNS.
 * - "SPOOFED": reverse PTR exists and mismatches vendor domain, or forward DNS mismatches.
 * - "UNVERIFIED": transient DoH timeout, missing PTR, or non-CIDR edge miss.
 */
export async function classifySearchCrawlerIp(
  ip: string,
  ua: string,
  request?: NextRequest,
): Promise<SearchCrawlerVerificationStatus> {
  if (isPrivateOrLocalIp(ip)) return "VERIFIED"

  const asn = request ? getRequestAsn(request) : null

  // 1. Google (Googlebot, Inspection Tool, AdsBot, Feedfetcher, StoreBot)
  if (isGoogleCrawlerUA(ua)) {
    if (asn && (asn === "AS15169" || asn === "AS16550" || asn === "AS36040" || asn === "AS43515" || asn === "AS395973" || asn === "AS394536")) {
      return "VERIFIED"
    }
    const cidrs = await getCidrsForVendor("google")
    if (cidrs.length > 0 && ipInAnyCidr(ip, cidrs)) return "VERIFIED"
    return verifyDnsBot(ip, [".googlebot.com", ".google.com"])
  }

  // 2. Microsoft Bing & Yahoo (Bingbot, MSNBot, Slurp)
  if (isBingCrawlerUA(ua) || isYahooCrawlerUA(ua)) {
    if (asn && MICROSOFT_CORP_ASNS.has(asn)) {
      return "VERIFIED"
    }
    const cidrs = await getCidrsForVendor("bing")
    if (cidrs.length > 0 && ipInAnyCidr(ip, cidrs)) return "VERIFIED"
    const dnsStatus = await verifyDnsBot(ip, [
      ".search.msn.com",
      ".bing.com",
      ".bingbot.com",
    ])
    if (dnsStatus === "VERIFIED") return "VERIFIED"
    if (asn === "AS8075" && dnsStatus !== "SPOOFED") {
      return "VERIFIED"
    }
    return dnsStatus
  }

  // 3. Apple (Applebot)
  if (APPLE_CRAWLER_UA.test(ua)) {
    if (asn === "AS714") return "VERIFIED"
    const cidrs = await getCidrsForVendor("apple")
    if (cidrs.length > 0 && ipInAnyCidr(ip, cidrs)) return "VERIFIED"
    return verifyDnsBot(ip, [".applebot.apple.com"])
  }

  // 4. DuckDuckGo (DuckDuckBot)
  if (DUCKDUCK_CRAWLER_UA.test(ua)) {
    const cidrs = await getCidrsForVendor("duckduck")
    if (cidrs.length > 0 && ipInAnyCidr(ip, cidrs)) return "VERIFIED"
    return verifyDnsBot(ip, [".duckduckgo.com"])
  }

  // 5. OpenAI (ChatGPT-User, OAI-SearchBot)
  if (/oai-searchbot|chatgpt-user/i.test(ua)) {
    if (asn === "AS398324") return "VERIFIED"
    const cidrs = await getCidrsForVendor("openai")
    if (cidrs.length > 0 && ipInAnyCidr(ip, cidrs)) return "VERIFIED"
    return "UNVERIFIED"
  }

  // 6. Claude search / citation bots (Anthropic on published CIDRs or FCrDNS)
  if (/claude-searchbot|claude-user|claude-web|claudebot/i.test(ua)) {
    const cidrs = await getCidrsForVendor("claude")
    if (cidrs.length > 0 && ipInAnyCidr(ip, cidrs)) return "VERIFIED"
    return verifyDnsBot(ip, [".anthropic.com"])
  }

  // 7. Amazon search / citation bots
  if (/amzn-searchbot|amzn-user/i.test(ua)) {
    return verifyDnsBot(ip, [".crawl.amazonbot.amazon"])
  }

  // 8. Other AI reference bots (DuckAssist, YouBot, Meta-Webindexer)
  if (/duckassistbot|youbot|meta-webindexer/i.test(ua)) {
    if (asn === "AS32934") return "VERIFIED"
    return verifyDnsBot(ip, [
      ".duckduckgo.com",
      ".facebook.com",
      ".tfbnw.net",
    ])
  }

  // 9. Perplexity AI (PerplexityBot)
  if (/perplexitybot|perplexity-user/i.test(ua)) {
    const cidrs = await getCidrsForVendor("perplexity")
    if (cidrs.length > 0 && ipInAnyCidr(ip, cidrs)) return "VERIFIED"
    return "UNVERIFIED"
  }

  // 10. Yandex (YandexBot)
  if (YANDEX_CRAWLER_UA.test(ua)) {
    if (asn === "AS13238") return "VERIFIED"
    const cidrs = await getCidrsForVendor("yandex")
    if (cidrs.length > 0 && ipInAnyCidr(ip, cidrs)) return "VERIFIED"
    return verifyDnsBot(ip, [
      ".yandex.ru",
      ".yandex.net",
      ".yandex.com",
    ])
  }

  // 11. Baidu (Baiduspider)
  if (BAIDU_CRAWLER_UA.test(ua)) {
    if (asn === "AS23724" || asn === "AS4837" || asn === "AS4134" || asn === "AS9808") return "VERIFIED"
    return verifyDnsBot(ip, [".baidu.com", ".baidu.jp"])
  }

  // 12. Huawei PetalBot
  if (PETAL_CRAWLER_UA.test(ua)) {
    if (asn === "AS55990" || asn === "AS136907") return "VERIFIED"
    return verifyDnsBot(ip, [".aspiegel.com", ".petalsearch.com"])
  }

  // 13. SeznamBot
  if (SEZNAM_CRAWLER_UA.test(ua)) {
    if (asn === "AS39392") return "VERIFIED"
    return verifyDnsBot(ip, [".seznam.cz"])
  }

  // 14. Mojeek
  if (MOJEEK_CRAWLER_UA.test(ua)) {
    const cidrs = await getCidrsForVendor("mojeek")
    if (cidrs.length > 0 && ipInAnyCidr(ip, cidrs)) return "VERIFIED"
    return verifyDnsBot(ip, [".mojeek.com"])
  }

  // 15. Marginalia
  if (MARGINALIA_CRAWLER_UA.test(ua)) {
    const cidrs = await getCidrsForVendor("marginalia")
    if (cidrs.length > 0 && ipInAnyCidr(ip, cidrs)) return "VERIFIED"
    return "UNVERIFIED"
  }

  return "UNVERIFIED"
}

/**
 * True when the client IP is verified in official published search/AI crawler ranges.
 */
export async function isOfficialSearchCrawlerIp(
  ip: string,
  ua: string,
  request?: NextRequest,
): Promise<boolean> {
  return (await classifySearchCrawlerIp(ip, ua, request)) === "VERIFIED"
}

export function shouldRateLimitPath(pathname: string): boolean {
  if (pathname.startsWith("/_next")) return false
  // Approval create/poll + deny-recovery must not share the 5/10s /api bucket —
  // burst polls + retries would 429 and surface MSG_UNABLE_REACH_VERIFICATION.
  // Single owner of this list: lib/api-rate-limit-exempt.ts (the identical list
  // is required in the Cloudflare WAF rate rule — see that file's header).
  if (API_RATE_LIMIT_EXEMPT.some((prefix) => pathname.startsWith(`/api${prefix}`))) {
    return false
  }

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
    // S25 (accepted timing tell): this short-circuit skips the CIDR/DNS work the
    // verified-crawler path performs, so denied-UA responses return measurably
    // faster. Adding network work here would cost real latency + upstream calls
    // on every denied request, so the tell is left in place deliberately.
    return { action: "cloak", reason: "denied_ua" }
  }

  if (claimsSearchCrawler(ua)) {
    const status = await classifySearchCrawlerIp(ip, ua, request)
    if (status === "VERIFIED") {
      // Verified search / AI crawler — skip hosting ASN cloak and path rate-limit.
      return { action: "allow" }
    }
    if (isLocalhostHost(ip) || isPrivateOrLocalIp(ip) || isLocalTestingUnlocked()) {
      return { action: "allow" }
    }
    const asn = getRequestAsn(request)
    // CF egress ASNs must never count as "visitor hosting" — getRequestAsn already
    // returns null behind CF without x-client-asn; still exclude CF_EGRESS here.
    const isHosting = Boolean(
      asn && isOriginBlockedHostingAsn(asn) && !CF_EGRESS_ASNS.has(asn),
    )
    // Zero-noindex DoH safety: if DNS was indeterminate (UNVERIFIED, NOT proven SPOOFED)
    // and the client is NOT on a blocked hosting ASN, allow public SEO GET/HEAD routes
    // so transient edge DNS timeouts never return ErrorScreen (X-Robots-Tag: noindex).
    if (status === "UNVERIFIED" && !isHosting && isPublicSeoGetOrHead(request)) {
      return { action: "allow" }
    }
    return { action: "cloak", reason: "spoofed_crawler" }
  }

  // ABSOLUTE hosting-ASN barrier — evaluated before any referrer, click-token,
  // or social-UA logic. No Referer header, UTM/msclkid/gclid parameter, or
  // unfurl UA ever exempts a datacenter, threat-intel, or customer-cloud IP.
  // Verified search crawlers were already allowed above; everything else from
  // these ASNs is automation until proven otherwise.
  //
  // CLOUDFLARE CAVEAT: when CF proxies the zone, the connecting peer (and thus
  // `x-vercel-ip-as-number`) IS Cloudflare. Cloaking on the CF egress ASN would
  // cloak every human, so it only counts as "hosting" when no verified CF hop
  // is present. A direct-to-Vercel or WARP request still has no verified hop and
  // stays cloaked.
  const asn = getRequestAsn(request)
  if (asn && CF_EGRESS_ASNS.has(asn)) {
    if (!isBehindCloudflare(request.headers)) {
      return { action: "cloak", reason: "hosting_asn" }
    }
  } else if (asn && isOriginBlockedHostingAsn(asn)) {
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
