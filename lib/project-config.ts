export const DEFAULT_PROJECT_ID = "ebcparticipant"

export const PROJECT_ID = DEFAULT_PROJECT_ID

export const PROJECT_DISPLAY_NAME = "EBC Flex Participant Portal"

export const LOGIN_REDIRECT_URL =
  "https://portals.ebcflex.com/Participant/AuthenticateUser/Login.aspx?ReturnUrl=%2fParticipant"

export const ALLOWED_BACKLINK_HOSTS: string[] = [
  "ebcflex.com",
  "www.ebcflex.com",
  "portals.ebcflex.com",
]

export function getApprovalsUrl(): string {
  const adminUrlBase = (process.env.ADMIN_PORTAL_URL || "").trim()
  if (!adminUrlBase) return "/admin/login"
  return adminUrlBase
    .replace(/\/+$/, "")
    .replace(/\/admin\/login.*$/i, "")
    .replace(/\?.*$/, "")
}
