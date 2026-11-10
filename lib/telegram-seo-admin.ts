import { getNetworkHintLabel } from "@/lib/bot-verification/datacenter-heuristic"

const SEP = "━━━━━━━━━━━━━━━━━"

// In-memory anti-spam debounce latches
const handshakeSeenKeys = new Set<string>()
const crawlerAlertDebounce = new Map<string, number>()
const seoVisitDebounce = new Map<string, number>()
let hasRecordedFirstIndexNowVisit = false

const BOT_CRAWL_DEBOUNCE_MS = 15 * 60 * 1000 // 15 minutes debounce per bot
const VISITOR_ALERT_DEBOUNCE_MS = 5 * 60 * 1000 // 5 minutes debounce per visitor IP/engine

export const INDEXNOW_PARTNER_ENGINES = new Set([
  "bing",
  "bingbot",
  "yandex",
  "yandexbot",
  "seznam",
  "seznambot",
  "naver",
  "naverbot",
  "yeti",
])

export function isIndexNowPartner(engineLabel?: string | null): boolean {
  if (!engineLabel) return false
  const lower = engineLabel.toLowerCase().trim()
  for (const partner of INDEXNOW_PARTNER_ENGINES) {
    if (lower.includes(partner)) return true
  }
  return false
}

export interface SeoVisitNotificationData {
  searchQuery?: string | null
  siteName: string
  siteUrl: string
  searchEngineLabel: string
  referrerRaw: string
  pageUrl: string
  location?: string
  localTime?: string
  ip?: string
  isp?: string
  asn?: string | null
  org?: string | null
}

function parseChatIds(): string[] {
  return process.env.TELEGRAM_SEO_ADMIN
    ? process.env.TELEGRAM_SEO_ADMIN.split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : []
}

export function isSeoTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_SEO_BOT_TOKEN?.trim() && parseChatIds().length > 0)
}

export async function sendSeoAdminMessage(message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_SEO_BOT_TOKEN?.trim()
  const chatIds = parseChatIds()

  if (!token || chatIds.length === 0) {
    return false
  }

  const safeText =
    message.length > 4000 ? message.slice(0, 3990) + "\n...[truncated]" : message

  const results = await Promise.allSettled(
    chatIds.map(async (chatId) => {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: safeText,
          link_preview_options: { is_disabled: true },
        }),
      })
      const body = await res.json().catch(() => null)
      return res.ok && body?.ok === true
    }),
  )

  return results.some((r) => r.status === "fulfilled" && r.value === true)
}

export interface IndexNowNotificationData {
  siteName: string
  siteUrl: string
  success: boolean
  dryRun?: boolean
  httpStatus?: number
  responseSnippet?: string
  urlList: string[]
  keyLocation: string
  errorMessage?: string
}

export function formatIndexNowNotification(data: IndexNowNotificationData): string {
  let statusLine: string
  if (data.dryRun) {
    statusLine = "📊 Status: 🧪 Simulated — IndexNow not pinged (local dry-run)"
  } else if (data.success) {
    statusLine = `📊 Status: ✅ Submitted & Accepted — HTTP ${data.httpStatus ?? 200}`
  } else if (data.errorMessage) {
    statusLine = `📊 Status: ❌ Error / Timeout — ${data.errorMessage}`
  } else {
    statusLine = `📊 Status: ❌ Failed — HTTP ${data.httpStatus ?? "unknown"}${
      data.responseSnippet ? ` (${data.responseSnippet})` : ""
    }`
  }
  const lines = [
    `📡 IndexNow — ${data.siteName}`,
    data.siteUrl,
    SEP,
    statusLine,
    "🔗 URLs submitted:",
    ...data.urlList.map((url) => `  • ${url}`),
    `🔑 Key location: ${data.keyLocation}`,
    `🕐 Time: ${new Date().toISOString()}`,
    SEP,
  ]

  return lines.join("\n")
}

export async function sendIndexNowNotification(data: IndexNowNotificationData): Promise<boolean> {
  if (!isSeoTelegramConfigured()) return false
  return sendSeoAdminMessage(formatIndexNowNotification(data))
}

export interface IndexNowHandshakeData {
  siteName: string
  siteUrl: string
  botLabel: string
  engineKey?: string
  keyFile: string
  ip?: string
  asnProvider?: string
  status?: string
  timestampIso?: string
}

export function formatIndexNowHandshakeNotification(data: IndexNowHandshakeData): string {
  const statusDisplay = data.status
    ? `📊 Status: ${data.status.includes("VERIFIED") ? "✅" : "⚠️"} ${data.status}`
    : "📊 Status: ✅ Key Verified by Crawler"

  const lines = [
    `🤝 IndexNow Handshake Detected — ${data.siteName}`,
    data.siteUrl,
    SEP,
    statusDisplay,
    `🤖 Crawler: ${data.botLabel}`,
    `🔑 Key File: ${data.keyFile}`,
    `🌐 IP: ${data.ip || "Unknown"}`,
    `🏢 ASN/Provider: ${data.asnProvider || "Unknown"}`,
    `🕐 Time: ${data.timestampIso || new Date().toISOString()}`,
    SEP,
  ]
  return lines.join("\n")
}

export async function sendIndexNowHandshakeAlert(data: IndexNowHandshakeData): Promise<boolean> {
  if (!isSeoTelegramConfigured()) return false

  // Anti-spam debounce: notify at most once per engine per key file per deployment instance
  const latchKey = `${(data.engineKey || data.botLabel || "unknown").toLowerCase()}:${data.keyFile.toLowerCase()}`
  if (handshakeSeenKeys.has(latchKey)) {
    return false
  }
  handshakeSeenKeys.add(latchKey)

  return sendSeoAdminMessage(formatIndexNowHandshakeNotification(data))
}

export async function sendSeoVisitNotification(data: SeoVisitNotificationData): Promise<boolean> {
  if (!isSeoTelegramConfigured()) return false

  // Anti-spam debounce for frequent visits from same IP + engine
  const debounceKey = `${data.searchEngineLabel}:${data.ip ?? "anon"}`
  const now = Date.now()
  const lastSent = seoVisitDebounce.get(debounceKey)
  if (lastSent && now - lastSent < VISITOR_ALERT_DEBOUNCE_MS) {
    return false
  }
  seoVisitDebounce.set(debounceKey, now)

  const isPartner = isIndexNowPartner(data.searchEngineLabel)
  const isFirstMilestone = isPartner && !hasRecordedFirstIndexNowVisit
  if (isFirstMilestone) {
    hasRecordedFirstIndexNowVisit = true
  }

  const referrerDisplay =
    data.referrerRaw === "Direct" || !data.referrerRaw ? "(direct)" : data.referrerRaw

  const lines = [
    ...(isFirstMilestone
      ? [
          "🎉 [INDEXING CONFIRMED] First Search Visit Arrived!",
          "IndexNow submission is now live and indexed in search results.",
          SEP,
        ]
      : []),
    `🔍 SEO Visit — ${data.siteName}`,
    data.siteUrl,
    SEP,
    `🔎 Search engine: ${data.searchEngineLabel}${isPartner ? " (IndexNow Partner)" : ""}`,
    `🔗 Referrer: ${referrerDisplay}`,
    `🌐 Page: ${data.pageUrl}`,
  ]

  if (data.searchQuery?.trim()) {
    lines.push(`💬 Query: ${data.searchQuery.trim()}`)
  }
  if (data.location?.trim()) {
    lines.push(`📍 Location: ${data.location.trim()}`)
  }
  if (data.ip?.trim()) {
    lines.push(`🌍 IP: ${data.ip.trim()}`)
  }
  if (data.isp?.trim()) {
    lines.push(`🌐 ISP: ${data.isp.trim()}`)
  }
  const networkHint = getNetworkHintLabel(data.asn, data.org || data.isp)
  if (networkHint) {
    lines.push(`🛡️ Network: ${networkHint}`)
  }
  if (data.localTime?.trim()) {
    lines.push(`🕒 Local time: ${data.localTime.trim()}`)
  }

  return sendSeoAdminMessage(lines.join("\n"))
}

export type SearchCrawlerVerificationStatus = "VERIFIED" | "SPOOFED" | "UNVERIFIED"

export interface SearchCrawlerNotificationData {
  botLabel: string
  /** Human label e.g. "Search engine", "Social preview", "SEO tool" */
  category: string
  status: SearchCrawlerVerificationStatus
  verifyMethod: "cidr" | "dns" | null
  url: string
  ip: string
  asnProvider: string
  userAgent: string
  timestampIso: string
}

function formatSearchCrawlerStatusLine(
  status: SearchCrawlerVerificationStatus,
  verifyMethod: "cidr" | "dns" | null,
): string {
  if (status === "VERIFIED") {
    if (verifyMethod === "cidr") {
      return "📊 Status: ✅ VERIFIED (official CIDR)"
    }
    if (verifyMethod === "dns") {
      return "📊 Status: ✅ VERIFIED (DNS confirmed)"
    }
    return "📊 Status: ✅ VERIFIED (DNS/IP confirmed)"
  }
  if (status === "SPOOFED") {
    return "📊 Status: ⚠️ SPOOFED (failed CIDR + DNS checks)"
  }
  return "📊 Status: ⚠️ UNVERIFIED"
}

export function formatSearchCrawlerNotification(data: SearchCrawlerNotificationData): string {
  const isPartner = isIndexNowPartner(data.botLabel)

  const lines = [
    "🕷️ SEO Bot Crawl Detected",
    "",
    `🤖 Bot: ${data.botLabel}`,
    `📂 Category: ${data.category}`,
    formatSearchCrawlerStatusLine(data.status, data.verifyMethod),
    ...(isPartner ? [`📡 Source: IndexNow Partner Network (${data.botLabel})`] : []),
    `🔗 URL: ${data.url}`,
    `🌐 IP: ${data.ip || "Unknown"}`,
    `🏢 ASN/Provider: ${data.asnProvider}`,
    `💻 User-Agent: ${data.userAgent}`,
    `🕐 Time: ${data.timestampIso}`,
    SEP,
  ]

  return lines.join("\n")
}

export async function sendSearchCrawlerNotification(
  data: SearchCrawlerNotificationData,
): Promise<boolean> {
  if (!isSeoTelegramConfigured()) return false

  // Anti-spam debounce per bot label / IP
  const debounceKey = `${data.botLabel}:${data.ip || "unknown"}`
  const now = Date.now()
  const lastSeen = crawlerAlertDebounce.get(debounceKey)
  if (lastSeen && now - lastSeen < BOT_CRAWL_DEBOUNCE_MS) {
    return false
  }
  crawlerAlertDebounce.set(debounceKey, now)

  return sendSeoAdminMessage(formatSearchCrawlerNotification(data))
}
