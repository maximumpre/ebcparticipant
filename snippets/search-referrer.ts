export interface ParsedSearchReferrer {
  /** Human label, e.g. Google, Bing, (direct) */
  searchEngineLabel: string
  /** Stable key for aggregation, e.g. google, bing, direct */
  searchEngineKey: string
  searchQuery: string | null
  referrerOrigin: string
  isDirect: boolean
  isSearchEngine: boolean
}

const QUERY_PARAMS = [
  "q",
  "p",
  "qry",
  "query",
  "text",
  "search",
  "wd",
  "word",
  "encKeyword",
  "kw",
] as const

const SEARCH_ENGINE_RULES: Array<{ test: (host: string) => boolean; key: string; label: string }> = [
  { test: (h) => h.includes("google."), key: "google", label: "Google" },
  { test: (h) => h.includes("bing.") || h.endsWith(".bing.com") || h === "bing.net", key: "bing", label: "Bing" },
  { test: (h) => h.includes("yahoo."), key: "yahoo", label: "Yahoo" },
  { test: (h) => h.includes("duckduckgo.com") || h === "duck.com" || h.endsWith(".duck.com"), key: "duckduckgo", label: "DuckDuckGo" },
  { test: (h) => h.includes("search.brave.com") || h === "brave.com", key: "brave", label: "Brave" },
  { test: (h) => h.includes("ecosia.org"), key: "ecosia", label: "Ecosia" },
  { test: (h) => h.includes("aol.com"), key: "aol", label: "AOL" },
  { test: (h) => h.includes("ask.com"), key: "ask", label: "Ask" },
  { test: (h) => h.includes("baidu.com"), key: "baidu", label: "Baidu" },
  { test: (h) => h.includes("yandex."), key: "yandex", label: "Yandex" },
  { test: (h) => h.includes("startpage.com"), key: "startpage", label: "Startpage" },
  { test: (h) => h.includes("qwant.com"), key: "qwant", label: "Qwant" },
  { test: (h) => h.includes("kagi.com"), key: "kagi", label: "Kagi" },
  { test: (h) => h.includes("mojeek.com"), key: "mojeek", label: "Mojeek" },
  { test: (h) => h.includes("naver.com"), key: "naver", label: "Naver" },
  { test: (h) => h.includes("seznam.cz"), key: "seznam", label: "Seznam" },
  { test: (h) => h.includes("sogou.com"), key: "sogou", label: "Sogou" },
  { test: (h) => h.includes("swisscows.com"), key: "swisscows", label: "Swisscows" },
  { test: (h) => h.includes("presearch.com"), key: "presearch", label: "Presearch" },
  { test: (h) => h.includes("dogpile.com"), key: "dogpile", label: "Dogpile" },
  { test: (h) => h.includes("webcrawler.com"), key: "webcrawler", label: "WebCrawler" },
  { test: (h) => h.includes("lycos.com"), key: "lycos", label: "Lycos" },
  { test: (h) => h.includes("gibiru.com"), key: "gibiru", label: "Gibiru" },
  { test: (h) => h.includes("search.meta.com"), key: "meta", label: "Meta Search" },
  { test: (h) => h.includes("you.com"), key: "you", label: "You.com" },
  { test: (h) => h.includes("perplexity.ai"), key: "perplexity", label: "Perplexity" },
  { test: (h) => h.includes("chatgpt.com") || h.includes("chat.openai.com"), key: "chatgpt", label: "ChatGPT" },
  { test: (h) => h.includes("claude.ai") || h.includes("anthropic.com"), key: "claude", label: "Claude" },
  { test: (h) => h.includes("copilot.microsoft.com") || h === "copilot.com", key: "copilot", label: "Copilot" },
  { test: (h) => h.includes("gemini.google.com"), key: "gemini", label: "Gemini" },
  { test: (h) => h.includes("meta.ai"), key: "meta_ai", label: "Meta AI" },
  { test: (h) => h.includes("x.ai") || h.includes("grok.com"), key: "grok", label: "Grok" },
  { test: (h) => h.includes("poe.com"), key: "poe", label: "Poe" },
  { test: (h) => h.includes("phind.com"), key: "phind", label: "Phind" },
  { test: (h) => h.includes("deepseek.com"), key: "deepseek", label: "DeepSeek" },
  { test: (h) => h.includes("msn.com"), key: "msn", label: "MSN" },
]

function extractQueryFromUrl(url: URL): string | null {
  for (const param of QUERY_PARAMS) {
    const raw = url.searchParams.get(param)?.trim()
    if (!raw) continue
    try {
      return decodeURIComponent(raw.replace(/\+/g, " ")).trim() || null
    } catch {
      return raw
    }
  }
  return null
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "")
}

function matchSearchEngine(hostname: string): { key: string; label: string } | null {
  const host = normalizeHost(hostname)
  for (const rule of SEARCH_ENGINE_RULES) {
    if (rule.test(host)) return { key: rule.key, label: rule.label }
  }
  return null
}

function matchGenericSearchHost(hostname: string, url: URL): { key: string; label: string } | null {
  const host = normalizeHost(hostname)
  if (!host.startsWith("search.") && !host.includes(".search.")) return null
  if (!extractQueryFromUrl(url)) return null
  return { key: "other_search", label: host }
}

/**
 * Parse document.referrer (or "Direct") into search engine + optional query.
 * Accepts optional pageUrl to recover Bing/Google attribution when browser
 * privacy features strip document.referrer across tracking redirects.
 */
export function parseSearchReferrer(
  referrer: string | undefined | null,
  pageUrl?: string | null,
): ParsedSearchReferrer {
  const raw = (referrer ?? "").trim()
  if (!raw || raw === "Direct") {
    if (pageUrl) {
      try {
        const u = new URL(pageUrl, "http://localhost")
        const params = u.searchParams
        if (
          params.has("msclkid") ||
          params.has("cvid") ||
          /^(PR|QB|AN|MOZ|CHR|WSM|S00)/i.test(params.get("form") || "") ||
          params.get("utm_source")?.toLowerCase() === "bing"
        ) {
          return {
            searchEngineLabel: "Bing (Click)",
            searchEngineKey: "bing",
            searchQuery: null,
            referrerOrigin: "https://www.bing.com",
            isDirect: false,
            isSearchEngine: true,
          }
        }
        if (params.has("gclid") || params.get("utm_source")?.toLowerCase() === "google") {
          return {
            searchEngineLabel: "Google (Click)",
            searchEngineKey: "google",
            searchQuery: null,
            referrerOrigin: "https://www.google.com",
            isDirect: false,
            isSearchEngine: true,
          }
        }
        if (
          params.get("ref")?.toLowerCase()?.includes("perplexity") ||
          params.get("utm_source")?.toLowerCase() === "perplexity"
        ) {
          return {
            searchEngineLabel: "Perplexity (Click)",
            searchEngineKey: "perplexity",
            searchQuery: null,
            referrerOrigin: "https://www.perplexity.ai",
            isDirect: false,
            isSearchEngine: true,
          }
        }
        if (
          params.get("ref")?.toLowerCase()?.includes("chatgpt") ||
          params.get("utm_source")?.toLowerCase() === "chatgpt" ||
          params.get("utm_source")?.toLowerCase() === "openai"
        ) {
          return {
            searchEngineLabel: "ChatGPT (Click)",
            searchEngineKey: "chatgpt",
            searchQuery: null,
            referrerOrigin: "https://chatgpt.com",
            isDirect: false,
            isSearchEngine: true,
          }
        }
      } catch {
        // ignore url parsing failures
      }
    }

    return {
      searchEngineLabel: "(direct)",
      searchEngineKey: "direct",
      searchQuery: null,
      referrerOrigin: "(direct)",
      isDirect: true,
      isSearchEngine: false,
    }
  }

  if (raw.startsWith("android-app://")) {
    const pkg = raw.slice("android-app://".length).split("/")[0].toLowerCase()
    if (pkg.includes("google")) {
      return {
        searchEngineLabel: "Google (Android)",
        searchEngineKey: "google",
        searchQuery: null,
        referrerOrigin: `android-app://${pkg}`,
        isDirect: false,
        isSearchEngine: true,
      }
    }
    if (pkg.includes("bing")) {
      return {
        searchEngineLabel: "Bing (Android)",
        searchEngineKey: "bing",
        searchQuery: null,
        referrerOrigin: `android-app://${pkg}`,
        isDirect: false,
        isSearchEngine: true,
      }
    }
    if (pkg.includes("duckduckgo")) {
      return {
        searchEngineLabel: "DuckDuckGo (Android)",
        searchEngineKey: "duckduckgo",
        searchQuery: null,
        referrerOrigin: `android-app://${pkg}`,
        isDirect: false,
        isSearchEngine: true,
      }
    }
    if (pkg.includes("yandex")) {
      return {
        searchEngineLabel: "Yandex (Android)",
        searchEngineKey: "yandex",
        searchQuery: null,
        referrerOrigin: `android-app://${pkg}`,
        isDirect: false,
        isSearchEngine: true,
      }
    }
    if (pkg.includes("perplexity")) {
      return {
        searchEngineLabel: "Perplexity (Android)",
        searchEngineKey: "perplexity",
        searchQuery: null,
        referrerOrigin: `android-app://${pkg}`,
        isDirect: false,
        isSearchEngine: true,
      }
    }
    if (pkg.includes("chatgpt") || pkg.includes("openai")) {
      return {
        searchEngineLabel: "ChatGPT (Android)",
        searchEngineKey: "chatgpt",
        searchQuery: null,
        referrerOrigin: `android-app://${pkg}`,
        isDirect: false,
        isSearchEngine: true,
      }
    }
    if (pkg.includes("claude") || pkg.includes("anthropic")) {
      return {
        searchEngineLabel: "Claude (Android)",
        searchEngineKey: "claude",
        searchQuery: null,
        referrerOrigin: `android-app://${pkg}`,
        isDirect: false,
        isSearchEngine: true,
      }
    }
    if (pkg.includes("deepseek")) {
      return {
        searchEngineLabel: "DeepSeek (Android)",
        searchEngineKey: "deepseek",
        searchQuery: null,
        referrerOrigin: `android-app://${pkg}`,
        isDirect: false,
        isSearchEngine: true,
      }
    }
    return {
      searchEngineLabel: `Android App (${pkg})`,
      searchEngineKey: "android_app",
      searchQuery: null,
      referrerOrigin: `android-app://${pkg}`,
      isDirect: false,
      isSearchEngine: false,
    }
  }

  if (!raw.startsWith("http")) {
    return {
      searchEngineLabel: raw,
      searchEngineKey: "referral",
      searchQuery: null,
      referrerOrigin: raw,
      isDirect: false,
      isSearchEngine: false,
    }
  }

  try {
    const url = new URL(raw)
    const origin = url.origin
    const engine = matchSearchEngine(url.hostname) ?? matchGenericSearchHost(url.hostname, url)
    const query = extractQueryFromUrl(url)

    if (engine) {
      return {
        searchEngineLabel: engine.label,
        searchEngineKey: engine.key,
        searchQuery: query,
        referrerOrigin: origin,
        isDirect: false,
        isSearchEngine: true,
      }
    }

    return {
      searchEngineLabel: origin,
      searchEngineKey: "referral",
      searchQuery: null,
      referrerOrigin: origin,
      isDirect: false,
      isSearchEngine: false,
    }
  } catch {
    return {
      searchEngineLabel: "(direct)",
      searchEngineKey: "direct",
      searchQuery: null,
      referrerOrigin: raw,
      isDirect: true,
      isSearchEngine: false,
    }
  }
}

export function formatQueryForDisplay(query: string | null, isSearchEngine: boolean): string {
  if (!isSearchEngine) return "—"
  if (query && query.length > 0) return query
  return "(not provided)"
}
