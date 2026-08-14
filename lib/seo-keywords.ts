import { PROJECT_DISPLAY_NAME } from "@/lib/project-config"
import { CANONICAL_HOST, DEFAULT_SITE_TITLE, SITE_DISPLAY_NAME } from "@/lib/site-url"

export const PAGE_H1_HEADING = `${SITE_DISPLAY_NAME} Login`

function mergeKeywords(...lists: Array<readonly string[]>): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const list of lists) {
    for (const keyword of list) {
      const key = keyword.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      result.push(keyword)
    }
  }
  return result
}

export const BRAND_KEYWORDS = [
  SITE_DISPLAY_NAME,
  PROJECT_DISPLAY_NAME,
  "EBC Flex",
  "EBC Flex login",
  "EBC Flex participant portal",
  "EBC Flex participant login",
  "Employee Benefits Corporation",
  "Employee Benefits Corporation login",
  "EBCentral",
  "EBCentral login",
  "EBC participant portal",
  "EBC participant login",
  DEFAULT_SITE_TITLE,
] as const

export const HOST_KEYWORDS = [
  CANONICAL_HOST,
  CANONICAL_HOST.replace(/^www\./, ""),
  "portal-ebcflex.com",
  "www.portal-ebcflex.com",
  "portals.ebcflex.com",
  "www.ebcflex.com",
  "ebcflex.com",
] as const

export const INTENT_KEYWORDS = [
  "sign in",
  "login",
  "participant login",
  "participant portal login",
  "benefits login",
  "employee benefits login",
  "benefit account login",
  "FSA login",
  "HSA login",
  "account access",
  "verify account",
  "forgot username",
  "reset password",
] as const

/**
 * Keywords harvested from login-out destination
 * https://portals.ebcflex.com/Participant/AuthenticateUser/Login.aspx
 * Remapped onto portal-ebcflex.com — additive only.
 */
export const DESTINATION_KEYWORDS = [
  "portals.ebcflex.com",
  "portals.ebcflex.com login",
  "portals.ebcflex.com/Participant",
  "AuthenticateUser/Login.aspx",
  "Participant Login",
  "Your Personal Benefit Account",
  "individual benefit account",
  "log in as an employer",
  "My Account Assistant",
  "Not a user yet",
  "Forgot Username",
  "Reset Password",
  "Register EBC Flex",
] as const

export const TRAFFIC_KEYWORDS = [
  "ebc flex participant portal login",
  "ebcflex participant login",
  "ebc flex sign in",
  "employee benefits corporation participant portal",
  "ebc flex claims login",
  "ebcflex.com participant",
  "portal ebcflex login",
  "ebc flex FSA login",
  "ebc flex HSA login",
  "ebc flex benefit card login",
] as const

export function buildSiteKeywords(): string[] {
  return mergeKeywords(
    HOST_KEYWORDS,
    BRAND_KEYWORDS,
    INTENT_KEYWORDS,
    DESTINATION_KEYWORDS,
    TRAFFIC_KEYWORDS,
  )
}

export const SITE_KEYWORDS = buildSiteKeywords()
