import { AI_REFERRAL_HOSTS } from "@/lib/ai-referral"
import { ALLOWED_BACKLINK_HOSTS } from "@/lib/project-config"

/** Shared search-engine referrer hosts (SteinsGate client + middleware edge). */
export const ALLOWED_REFERRER_HOSTS = [
  "google.com",
  "www.google.com",
  "google.co.uk",
  "google.de",
  "google.fr",
  "google.es",
  "google.it",
  "google.ca",
  "google.com.au",
  "google.co.in",
  "google.com.br",
  "googleadservices.com",
  "bing.com",
  "www.bing.com",
  "bing.net",
  "msn.com",
  "www.msn.com",
  "search.msn.com",
  "copilot.microsoft.com",
  "edgeservices.bing.com",
  "yahoo.com",
  "search.yahoo.com",
  "ca.search.yahoo.com",
  "uk.search.yahoo.com",
  "de.search.yahoo.com",
  "yahoo.co.jp",
  "duckduckgo.com",
  "duck.com",
  "brave.com",
  "search.brave.com",
  "ecosia.org",
  "startpage.com",
  "qwant.com",
  "kagi.com",
  "ask.com",
  "aol.com",
  "baidu.com",
  "yandex.com",
  "yandex.ru",
  "yandex.by",
  "yandex.kz",
  "seznam.cz",
  "naver.com",
  "sogou.com",
  "mojeek.com",
  "swisscows.com",
  "presearch.com",
  "dogpile.com",
  "webcrawler.com",
  "lycos.com",
  "gibiru.com",
  // SMO (Social Media Optimization) referrers
  "twitter.com",
  "x.com",
  "t.co",
  "linkedin.com",
  "lnkd.in",
  "facebook.com",
  "fb.com",
  "instagram.com",
  "reddit.com",
  "youtube.com",
  ...AI_REFERRAL_HOSTS,
] as const

const normalizeReferrerValue = (value: string) => value.toLowerCase().replace(/^www\./, "")

const normalizeOrigin = (value: string) => value.toLowerCase().replace(/^(https?:\/\/)www\./, "$1")

const ALLOWED_ANDROID_APP_PACKAGES = [
  "com.google.android.googlequicksearchbox",
  "com.google.android.apps.searchlite",
  "com.google.android.gm",
  "com.microsoft.bing",
  "com.microsoft.bing.chn",
  "com.microsoft.copilot",
  "com.microsoft.start",
  "com.microsoft.emmx",
  "com.duckduckgo.mobile.android",
  "com.android.chrome",
  "org.mozilla.firefox",
  "com.sec.android.app.sbrowser",
  "com.brave.browser",
  "com.opera.browser",
  "com.yandex.browser",
  "com.yandex.searchapp",
  "com.yahoo.mobile.client.android.search",
  // RRO: AI search application packages
  "ai.perplexity.app",
  "com.openai.chatgpt",
  "com.anthropic.claude",
  "com.deepseek.chat",
  // SMO: Social media application packages
  "com.twitter.android",
  "com.linkedin.android",
  "com.facebook.katana",
  "com.instagram.android",
  "com.reddit.frontpage",
] as const

/**
 * Universal search-engine hostname matcher.
 * Matches all international regional ccTLDs for Google, Bing, Yahoo, and DuckDuckGo.
 */
export function isSearchEngineHostname(hostname: string): boolean {
  const h = normalizeReferrerValue(hostname)

  // 1. Google (google.com, *.google.com, google.co.uk, google.de, google.ca, etc.)
  if (
    h === "google.com" ||
    h.endsWith(".google.com") ||
    /^google\.(co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2,3})$/.test(h)
  ) {
    return true
  }

  // 2. Microsoft Bing (bing.com, *.bing.com, bing.co.uk, bing.de, bing.ca, bing.com.au, etc.)
  if (
    h === "bing.com" ||
    h.endsWith(".bing.com") ||
    h === "bing.net" ||
    h.endsWith(".bing.net") ||
    /^bing\.(co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2,3})$/.test(h)
  ) {
    return true
  }

  // 3. Yahoo (yahoo.com, *.yahoo.com, search.yahoo.co.uk, r.search.yahoo.com, etc.)
  if (
    h === "yahoo.com" ||
    h.endsWith(".yahoo.com") ||
    /^([a-z]{2,3}\.)?search\.yahoo\.(com|co\.[a-z]{2}|[a-z]{2,3})$/.test(h) ||
    /^yahoo\.(co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2,3})$/.test(h)
  ) {
    return true
  }

  // 4. DuckDuckGo (duckduckgo.com, *.duckduckgo.com, duck.com, *.duck.com)
  if (
    h === "duckduckgo.com" ||
    h.endsWith(".duckduckgo.com") ||
    h === "duck.com" ||
    h.endsWith(".duck.com")
  ) {
    return true
  }

  return false
}

/**
 * Validates cryptographic/structured query tokens appended by search engines.
 * Recovers search entry attribution when browsers strip the HTTP Referer header
 * across intermediate redirect wrappers (e.g. `bing.com/ck/a` with `target="_blank"`).
 */
export function hasSearchClickAttribution(
  target: URL | URLSearchParams | string | null | undefined,
): boolean {
  if (!target) return false
  try {
    let params: URLSearchParams
    if (target instanceof URLSearchParams) {
      params = target
    } else if (target instanceof URL) {
      params = target.searchParams
    } else if (typeof target === "string") {
      const qIdx = target.indexOf("?")
      params = new URLSearchParams(qIdx !== -1 ? target.slice(qIdx) : target)
    } else {
      return false
    }

    // 1. Microsoft Click ID (generated on Microsoft Search Network clicks)
    const msclkid = params.get("msclkid")
    if (msclkid && msclkid.length >= 16) return true

    // 2. Bing Client View ID / Conversation Session ID (32-char hex string)
    const cvid = params.get("cvid")
    if (cvid && /^[0-9a-fA-F]{24,36}$/.test(cvid)) return true

    // 3. Bing Search UI Module / Entry Form Code (e.g. form=PRWGO1, form=QBLH, form=ANON)
    const form = params.get("form")
    if (form && /^(PR|QB|AN|MOZ|CHR|WSM|S00)[A-Z0-9_-]{1,10}$/i.test(form)) return true

    // 4. Google Click ID
    const gclid = params.get("gclid")
    if (gclid && gclid.length >= 16) return true

    // 5. Search Engine & Modern Discovery UTM Attribution
    const utmSource = params.get("utm_source")?.toLowerCase()
    if (
      utmSource &&
      [
        // Search & AI engines
        "bing",
        "google",
        "msn",
        "copilot",
        "yahoo",
        "duckduckgo",
        "perplexity",
        "chatgpt",
        "openai",
        "claude",
        "deepseek",
        "gemini",
        "meta.ai",
        "grok",
        // SMO: Social media platforms
        "twitter",
        "x",
        "linkedin",
        "facebook",
        "instagram",
        "reddit",
        "youtube",
      ].includes(utmSource)
    ) {
      return true
    }

    // 6. Direct Referral Parameter (e.g. ref=perplexity.ai, ref=chatgpt.com)
    const ref = params.get("ref")?.toLowerCase()
    if (
      ref &&
      [
        "perplexity.ai",
        "chatgpt.com",
        "claude.ai",
        "chat.deepseek.com",
        "copilot.microsoft.com",
        "twitter.com",
        "t.co",
        "linkedin.com",
        "reddit.com",
      ].includes(ref)
    ) {
      return true
    }

    // 7. AI Search Engine & Overview Source Tracking (e.g. source=sge, source=aio)
    const source = params.get("source")?.toLowerCase()
    if (
      source &&
      ["sge", "aio", "search", "perplexity", "copilot"].includes(source)
    ) {
      return true
    }

    return false
  } catch {
    return false
  }
}

/**
 * Shared search/backlink referrer allowlist for SteinsGate (client) and middleware (edge).
 * `pageOrigin` when set rejects same-origin referrers (reload must not grant entry).
 */
export function isAllowedSearchOrBacklinkReferrer(
  referrer: string,
  pageOrigin?: string | null,
): boolean {
  if (!referrer) return false
  const trimmed = referrer.trim()

  if (trimmed.startsWith("android-app://")) {
    const pkg = trimmed.slice("android-app://".length).split("/")[0].toLowerCase()
    return ALLOWED_ANDROID_APP_PACKAGES.some(
      (allowed) => pkg === allowed || pkg.startsWith(`${allowed}.`),
    )
  }

  if (!trimmed.startsWith("http")) return false
  try {
    const referrerUrl = new URL(trimmed)
    const referrerOrigin = normalizeOrigin(referrerUrl.origin)

    if (pageOrigin) {
      pageOrigin = normalizeOrigin(pageOrigin)
      if (referrerOrigin === pageOrigin) return false
    }

    const referrerHostname = normalizeReferrerValue(referrerUrl.hostname)

    // Fast-path: check universal search engine ccTLD matcher first
    if (isSearchEngineHostname(referrerHostname)) {
      return true
    }

    const referrerHost = normalizeReferrerValue(referrerUrl.host)
    const allAllowed = [...ALLOWED_REFERRER_HOSTS, ...ALLOWED_BACKLINK_HOSTS]

    return allAllowed.some((allowed) => {
      const normalizedAllowed = allowed.toLowerCase()
      const isHostnameOnly =
        !normalizedAllowed.includes("://") && !normalizedAllowed.includes(":")

      if (isHostnameOnly) {
        const allowedHostname = normalizeReferrerValue(normalizedAllowed)
        return (
          referrerHostname === allowedHostname ||
          referrerHostname.endsWith(`.${allowedHostname}`)
        )
      }

      const allowedUrl =
        normalizedAllowed.startsWith("http://") || normalizedAllowed.startsWith("https://")
          ? new URL(normalizedAllowed)
          : new URL(`http://${normalizedAllowed}`)

      return (
        referrerHost === normalizeReferrerValue(allowedUrl.host) ||
        referrerOrigin === normalizeOrigin(allowedUrl.origin)
      )
    })
  } catch {
    return false
  }
}

/**
 * Unified entry evaluator combining HTTP Referer and Search Click attribution.
 */
export function isAllowedSearchLandingEntry(
  referrer: string,
  pageOrigin?: string | null,
  searchParams?: URLSearchParams | string | null,
): boolean {
  return (
    isAllowedSearchOrBacklinkReferrer(referrer, pageOrigin) ||
    hasSearchClickAttribution(searchParams)
  )
}
