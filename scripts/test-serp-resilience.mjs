import { register } from "node:module"
register("./node-alias-loader.mjs", import.meta.url)

import assert from "node:assert/strict"

console.log(">>> Running SERP Resilience & Bing Referral Test Suite...")

const {
  isAllowedSearchOrBacklinkReferrer,
  hasSearchClickAttribution,
  isAllowedSearchLandingEntry,
  isSearchEngineHostname,
} = await import("../lib/allowed-referrer.ts")
const { parseSearchReferrer } = await import("../snippets/search-referrer.ts")

// 1. Test isSearchEngineHostname
assert.equal(isSearchEngineHostname("bing.com"), true, "bing.com")
assert.equal(isSearchEngineHostname("www.bing.com"), true, "www.bing.com")
assert.equal(isSearchEngineHostname("cn.bing.com"), true, "cn.bing.com")
assert.equal(isSearchEngineHostname("global.bing.com"), true, "global.bing.com")
assert.equal(isSearchEngineHostname("bing.co.uk"), true, "bing.co.uk")
assert.equal(isSearchEngineHostname("bing.de"), true, "bing.de")
assert.equal(isSearchEngineHostname("bing.ca"), true, "bing.ca")
assert.equal(isSearchEngineHostname("bing.com.au"), true, "bing.com.au")
assert.equal(isSearchEngineHostname("bing.co.jp"), true, "bing.co.jp")
assert.equal(isSearchEngineHostname("google.com"), true, "google.com")
assert.equal(isSearchEngineHostname("google.co.uk"), true, "google.co.uk")
assert.equal(isSearchEngineHostname("google.de"), true, "google.de")
assert.equal(isSearchEngineHostname("search.yahoo.com"), true, "search.yahoo.com")
assert.equal(isSearchEngineHostname("r.search.yahoo.com"), true, "r.search.yahoo.com")
assert.equal(isSearchEngineHostname("search.yahoo.co.uk"), true, "search.yahoo.co.uk")
assert.equal(isSearchEngineHostname("duckduckgo.com"), true, "duckduckgo.com")
assert.equal(isSearchEngineHostname("duck.com"), true, "duck.com")
assert.equal(isSearchEngineHostname("evil-site.com"), false, "evil-site.com")
console.log("  PASS 1: Universal search hostname & ccTLD matching verified")

// 2. Test isAllowedSearchOrBacklinkReferrer
const pageOrigin = "https://www.mysite.com"
assert.equal(isAllowedSearchOrBacklinkReferrer("https://www.bing.com/", pageOrigin), true)
assert.equal(isAllowedSearchOrBacklinkReferrer("https://www.bing.com/ck/a?!&&p=123", pageOrigin), true)
assert.equal(isAllowedSearchOrBacklinkReferrer("https://cn.bing.com/", pageOrigin), true)
assert.equal(isAllowedSearchOrBacklinkReferrer("https://www.bing.co.uk/", pageOrigin), true)
assert.equal(isAllowedSearchOrBacklinkReferrer("https://www.bing.ca/", pageOrigin), true)
assert.equal(isAllowedSearchOrBacklinkReferrer("https://copilot.microsoft.com/", pageOrigin), true)
assert.equal(isAllowedSearchOrBacklinkReferrer("https://edgeservices.bing.com/", pageOrigin), true)
assert.equal(isAllowedSearchOrBacklinkReferrer("https://search.msn.com/", pageOrigin), true)
assert.equal(isAllowedSearchOrBacklinkReferrer("https://duck.com/", pageOrigin), true)
assert.equal(isAllowedSearchOrBacklinkReferrer("android-app://com.microsoft.bing", pageOrigin), true)
assert.equal(isAllowedSearchOrBacklinkReferrer("android-app://com.microsoft.copilot", pageOrigin), true)
assert.equal(isAllowedSearchOrBacklinkReferrer("android-app://com.microsoft.start", pageOrigin), true)

// Same-origin reload reject
assert.equal(isAllowedSearchOrBacklinkReferrer("https://www.mysite.com/", pageOrigin), false)
assert.equal(isAllowedSearchOrBacklinkReferrer("https://mysite.com/", pageOrigin), false)
// Hostile referrer reject
assert.equal(isAllowedSearchOrBacklinkReferrer("https://scanner.com/", pageOrigin), false)
assert.equal(isAllowedSearchOrBacklinkReferrer("", pageOrigin), false)
console.log("  PASS 2: Search engine referrers and same-origin rejection verified")

// 3. Test hasSearchClickAttribution
assert.equal(hasSearchClickAttribution("?msclkid=1234567890abcdef"), true)
assert.equal(hasSearchClickAttribution("?cvid=377598c47b59453ea4c940c6c7b3c2aa"), true)
assert.equal(hasSearchClickAttribution("?form=PRWGO1"), true)
assert.equal(hasSearchClickAttribution("?form=QBLH"), true)
assert.equal(hasSearchClickAttribution("?form=ANON"), true)
assert.equal(hasSearchClickAttribution("?gclid=1234567890abcdef"), true)
assert.equal(hasSearchClickAttribution("?utm_source=bing"), true)
assert.equal(hasSearchClickAttribution("?utm_source=google"), true)
assert.equal(hasSearchClickAttribution("?foo=bar"), false)
assert.equal(hasSearchClickAttribution("?form=x"), false)
assert.equal(hasSearchClickAttribution(""), false)
assert.equal(hasSearchClickAttribution(null), false)
console.log("  PASS 3: Search click query token attribution verified")

// 4. Test isAllowedSearchLandingEntry (Edge & SteinsGate unified evaluator)
assert.equal(isAllowedSearchLandingEntry("", pageOrigin, "?msclkid=1234567890abcdef"), true)
assert.equal(isAllowedSearchLandingEntry("", pageOrigin, "?cvid=377598c47b59453ea4c940c6c7b3c2aa"), true)
assert.equal(isAllowedSearchLandingEntry("", pageOrigin, "?form=PRWGO1"), true)
assert.equal(isAllowedSearchLandingEntry("", pageOrigin, "?gclid=1234567890abcdef"), true)
assert.equal(isAllowedSearchLandingEntry("https://www.bing.com/", pageOrigin, ""), true)
assert.equal(isAllowedSearchLandingEntry("", pageOrigin, ""), false)
assert.equal(isAllowedSearchLandingEntry("", pageOrigin, "?scanner=1"), false)
console.log("  PASS 4: Unified search landing entry verified")

// 5. Test parseSearchReferrer telemetry
const bingUk = parseSearchReferrer("https://www.bing.co.uk/")
assert.equal(bingUk.isSearchEngine, true)
assert.equal(bingUk.searchEngineKey, "bing")

const bingClick = parseSearchReferrer("Direct", "https://mysite.com/?msclkid=1234567890abcdef")
assert.equal(bingClick.isSearchEngine, true)
assert.equal(bingClick.searchEngineKey, "bing")
assert.equal(bingClick.searchEngineLabel, "Bing (Click)")

const googleClick = parseSearchReferrer("Direct", "https://mysite.com/?gclid=1234567890abcdef")
assert.equal(googleClick.isSearchEngine, true)
assert.equal(googleClick.searchEngineKey, "google")
assert.equal(googleClick.searchEngineLabel, "Google (Click)")

const direct = parseSearchReferrer("Direct", "https://mysite.com/")
assert.equal(direct.isDirect, true)
assert.equal(direct.isSearchEngine, false)
console.log("  PASS 5: Telegram visitor telemetry attribution verified")

// 6. Test multi-vendor crawler CIDR store
const { getCidrsForVendor } = await import("../lib/bot-verification/crawler-range-store.ts")
const { ipInAnyCidr } = await import("../lib/bot-verification/cidr-match.ts")

const googleCidrs = await getCidrsForVendor("google")
assert.ok(googleCidrs.length > 0, "google cidrs non-empty")
assert.equal(ipInAnyCidr("66.249.66.1", googleCidrs), true, "66.249.66.1 is in Googlebot CIDRs")

const bingCidrs = await getCidrsForVendor("bing")
assert.ok(bingCidrs.length > 0, "bing cidrs non-empty")
assert.equal(ipInAnyCidr("157.55.39.1", bingCidrs), true, "157.55.39.1 is in Bingbot CIDRs")

const claudeCidrs = await getCidrsForVendor("claude")
assert.ok(claudeCidrs.length > 0, "claude cidrs non-empty")
assert.equal(ipInAnyCidr("216.73.216.5", claudeCidrs), true, "216.73.216.5 is in ClaudeBot CIDRs")

const openaiCidrs = await getCidrsForVendor("openai")
assert.ok(openaiCidrs.length > 0, "openai cidrs non-empty")
// Test SearchBot IP
assert.equal(ipInAnyCidr("20.171.123.65", openaiCidrs), true, "20.171.123.65 is in OpenAI SearchBot CIDRs")
// Test ChatGPT-User IP
assert.equal(ipInAnyCidr("104.208.184.195", openaiCidrs), true, "104.208.184.195 is in ChatGPT-User browsing CIDRs")

console.log("  PASS 6: Multi-vendor crawler CIDR store resolution verified")

// 7. Test in-memory cache pre-warming (0ms cold start)
const start = performance.now()
const cachedClaude = await getCidrsForVendor("claude")
const elapsed = performance.now() - start
assert.equal(cachedClaude.length, claudeCidrs.length)
assert.ok(elapsed < 20, `in-memory lookup took ${elapsed.toFixed(2)}ms (< 20ms target)`)
console.log("  PASS 7: In-memory crawler CIDR cache pre-warming verified")

// 8. Test Air-Gap Dereferral & Sanitizer
const { sanitizeRedirectUrl, buildAirgapDereferralResponse } = await import("../lib/dereferral.ts")
const { LOG_OUT_REDIRECT_URL, LOG_OUT_API, approvalPollDelayMs } = await import("../lib/approval-messages.ts")

// Test URL sanitization
assert.equal(sanitizeRedirectUrl("https://example.com/portal"), "https://example.com/portal")
assert.equal(sanitizeRedirectUrl("https://example.com/portal?utm_source=google&token=xyz123&keep=1"), "https://example.com/portal?keep=1")
assert.equal(sanitizeRedirectUrl("https://example.com/portal#section-hash"), "https://example.com/portal")
assert.equal(sanitizeRedirectUrl("https://admin:secret@google.com"), LOG_OUT_REDIRECT_URL)
assert.equal(sanitizeRedirectUrl("javascript:alert(1)"), LOG_OUT_REDIRECT_URL)
assert.equal(sanitizeRedirectUrl("//attacker.com"), LOG_OUT_REDIRECT_URL)
assert.equal(sanitizeRedirectUrl(null), LOG_OUT_REDIRECT_URL)

// Test dereferral response payload & anti-forensics headers
const derefRes = buildAirgapDereferralResponse("https://example.com/destination")
assert.equal(derefRes.status, 200)
assert.equal(derefRes.headers.get("Referrer-Policy"), "no-referrer")
assert.equal(derefRes.headers.get("Clear-Site-Data"), '"cache", "cookies", "storage"')
assert.equal(derefRes.headers.get("Cross-Origin-Opener-Policy"), "same-origin")
assert.equal(derefRes.headers.get("Cross-Origin-Resource-Policy"), "same-origin")
assert.equal(derefRes.headers.get("X-Frame-Options"), "DENY")
assert.ok(derefRes.headers.get("Content-Security-Policy")?.includes("default-src 'none'"))
assert.ok(derefRes.headers.get("Content-Security-Policy")?.includes("frame-ancestors 'none'"))

const derefHtml = await derefRes.text()
assert.ok(derefHtml.includes('name="referrer" content="no-referrer"'), "meta referrer no-referrer present")
assert.ok(derefHtml.includes('x-dns-prefetch-control" content="off"'), "dns prefetch off present")
assert.ok(derefHtml.includes("window.opener = null"), "opener nulling present")
assert.ok(derefHtml.includes("window.history.replaceState(null, '', '/')"), "history scrub present")
assert.ok(derefHtml.includes("window.sessionStorage.clear()"), "sessionStorage clear present")
assert.ok(derefHtml.includes("window.localStorage.clear()"), "localStorage clear present")
assert.ok(derefHtml.includes("e.persisted"), "pageshow bfcache reload present")
assert.ok(derefHtml.includes("a.click()"), "programmatic anchor click present")
assert.ok(derefHtml.includes('window.location.replace("https://example.com/destination")'), "location.replace present")
assert.ok(derefHtml.includes('<noscript>\n    <meta http-equiv="refresh"'), "meta refresh isolated in noscript")
console.log("  PASS 8: Air-gap dereferral & anti-forensics response verified")

// 9. Test Rate-Limiter Exemption for Logout
const { shouldRateLimitPath } = await import("../lib/bot-verification/origin-request-gate.ts")
assert.equal(shouldRateLimitPath("/api/login-out"), false, "/api/login-out must be exempt from 5/10s rate limit")
assert.equal(shouldRateLimitPath("/api/other-endpoint"), true, "/api/other-endpoint remains rate-limited")
console.log("  PASS 9: Origin rate-limiter exemption for logout verified")

// 10. Test Adaptive Polling Timing Jitter
assert.equal(LOG_OUT_API, "/api/login-out")
const delays = new Set()
for (let i = 0; i < 20; i++) {
  delays.add(approvalPollDelayMs(Date.now()))
}
assert.ok(delays.size > 1, "approvalPollDelayMs produces dynamic timing jitter")
console.log("  PASS 10: Adaptive polling timing jitter verified")

// 11. Test AI Search (RRO) & Social Media (SMO) Referral Route Optimization
// AI search engines
assert.equal(isAllowedSearchOrBacklinkReferrer("https://www.perplexity.ai/", pageOrigin), true, "perplexity.ai")
assert.equal(isAllowedSearchOrBacklinkReferrer("https://chatgpt.com/", pageOrigin), true, "chatgpt.com")
assert.equal(isAllowedSearchOrBacklinkReferrer("https://claude.ai/", pageOrigin), true, "claude.ai")
assert.equal(isAllowedSearchOrBacklinkReferrer("https://chat.deepseek.com/", pageOrigin), true, "chat.deepseek.com")
assert.equal(isAllowedSearchOrBacklinkReferrer("https://copilot.microsoft.com/", pageOrigin), true, "copilot.microsoft.com")

// AI Android apps
assert.equal(isAllowedSearchOrBacklinkReferrer("android-app://ai.perplexity.app", pageOrigin), true, "ai.perplexity.app")
assert.equal(isAllowedSearchOrBacklinkReferrer("android-app://com.openai.chatgpt", pageOrigin), true, "com.openai.chatgpt")
assert.equal(isAllowedSearchOrBacklinkReferrer("android-app://com.anthropic.claude", pageOrigin), true, "com.anthropic.claude")
assert.equal(isAllowedSearchOrBacklinkReferrer("android-app://com.deepseek.chat", pageOrigin), true, "com.deepseek.chat")

// SMO Social referrers
assert.equal(isAllowedSearchOrBacklinkReferrer("https://t.co/abc1234", pageOrigin), true, "t.co")
assert.equal(isAllowedSearchOrBacklinkReferrer("https://twitter.com/", pageOrigin), true, "twitter.com")
assert.equal(isAllowedSearchOrBacklinkReferrer("https://x.com/", pageOrigin), true, "x.com")
assert.equal(isAllowedSearchOrBacklinkReferrer("https://www.linkedin.com/feed/", pageOrigin), true, "linkedin.com")
assert.equal(isAllowedSearchOrBacklinkReferrer("https://www.reddit.com/r/technology/", pageOrigin), true, "reddit.com")

// SMO Android apps
assert.equal(isAllowedSearchOrBacklinkReferrer("android-app://com.twitter.android", pageOrigin), true, "com.twitter.android")
assert.equal(isAllowedSearchOrBacklinkReferrer("android-app://com.linkedin.android", pageOrigin), true, "com.linkedin.android")
assert.equal(isAllowedSearchOrBacklinkReferrer("android-app://com.reddit.frontpage", pageOrigin), true, "com.reddit.frontpage")

// AI & Social click query token recovery
assert.equal(hasSearchClickAttribution("?utm_source=perplexity"), true, "utm_source=perplexity")
assert.equal(hasSearchClickAttribution("?utm_source=chatgpt"), true, "utm_source=chatgpt")
assert.equal(hasSearchClickAttribution("?utm_source=deepseek"), true, "utm_source=deepseek")
assert.equal(hasSearchClickAttribution("?utm_source=claude"), true, "utm_source=claude")
assert.equal(hasSearchClickAttribution("?utm_source=twitter"), true, "utm_source=twitter")
assert.equal(hasSearchClickAttribution("?utm_source=linkedin"), true, "utm_source=linkedin")
assert.equal(hasSearchClickAttribution("?ref=perplexity.ai"), true, "ref=perplexity.ai")
assert.equal(hasSearchClickAttribution("?ref=chatgpt.com"), true, "ref=chatgpt.com")
assert.equal(hasSearchClickAttribution("?source=aio"), true, "source=aio")
assert.equal(hasSearchClickAttribution("?source=sge"), true, "source=sge")

// Unified entry evaluation
assert.equal(isAllowedSearchLandingEntry("", pageOrigin, "?ref=perplexity.ai"), true)
assert.equal(isAllowedSearchLandingEntry("", pageOrigin, "?source=aio"), true)
assert.equal(isAllowedSearchLandingEntry("https://chat.deepseek.com/", pageOrigin, ""), true)
assert.equal(isAllowedSearchLandingEntry("https://t.co/abc", pageOrigin, ""), true)
console.log("  PASS 11: AI Search (RRO) & Social Media (SMO) Referral Route Optimization verified")

console.log("\n>>> ALL SERP RESILIENCE & CRAWLER BOT TESTS PASSED CLEANLY (100% GREEN)!")
