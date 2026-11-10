/**
 * SEO admin Telegram helper for Node postbuild scripts.
 * Mirrors lib/telegram-seo-admin.ts (plain text, TELEGRAM_SEO_BOT_TOKEN + TELEGRAM_SEO_ADMIN).
 */

const SEP = "━━━━━━━━━━━━━━━━━"

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

export function isIndexNowPartner(engineLabel) {
  if (!engineLabel) return false
  const lower = engineLabel.toLowerCase().trim()
  for (const partner of INDEXNOW_PARTNER_ENGINES) {
    if (lower.includes(partner)) return true
  }
  return false
}

export function parseSeoTelegramChatIds() {
  return process.env.TELEGRAM_SEO_ADMIN
    ? process.env.TELEGRAM_SEO_ADMIN.split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : []
}

export function isSeoTelegramConfigured() {
  return Boolean(process.env.TELEGRAM_SEO_BOT_TOKEN?.trim() && parseSeoTelegramChatIds().length > 0)
}

/**
 * @param {string} message
 * @returns {Promise<boolean>}
 */
export async function sendSeoAdminMessage(message) {
  const token = process.env.TELEGRAM_SEO_BOT_TOKEN?.trim()
  const chatIds = parseSeoTelegramChatIds()

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

/**
 * @param {{
 *   siteName: string
 *   siteUrl: string
 *   success: boolean
 *   dryRun?: boolean
 *   httpStatus?: number
 *   responseSnippet?: string
 *   urlList: string[]
 *   keyLocation: string
 *   errorMessage?: string
 * }} data
 */
export function formatIndexNowNotificationMessage(data) {
  let statusLine
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

/**
 * @param {Parameters<typeof formatIndexNowNotificationMessage>[0]} data
 * @returns {Promise<boolean>}
 */
export async function sendIndexNowNotification(data) {
  if (!isSeoTelegramConfigured()) return false
  return sendSeoAdminMessage(formatIndexNowNotificationMessage(data))
}

/**
 * @param {{
 *   siteName: string
 *   siteUrl: string
 *   botLabel: string
 *   keyFile: string
 *   ip?: string
 *   asnProvider?: string
 *   status?: string
 *   timestampIso?: string
 * }} data
 */
export function formatIndexNowHandshakeMessage(data) {
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

/**
 * @param {Parameters<typeof formatIndexNowHandshakeMessage>[0]} data
 * @returns {Promise<boolean>}
 */
export async function sendIndexNowHandshakeNotification(data) {
  if (!isSeoTelegramConfigured()) return false
  return sendSeoAdminMessage(formatIndexNowHandshakeMessage(data))
}
