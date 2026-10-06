/** Display name for notifications and metadata. */
export const SITE_DISPLAY_NAME = "EBC Flex" as const

export const SITE_ORIGIN = "https://www.portal-ebcflexs.com" as const

/** @deprecated Use SITE_ORIGIN */
export const SITE_URL = SITE_ORIGIN

export const SITE_HOMEPAGE_CANONICAL = `${SITE_ORIGIN}/` as const

export const SITE_CONTENT_UPDATED_AT = "2026-10-01T00:00:00.000Z" as const

export const SITE_SITEMAP_URL = `${SITE_ORIGIN}/sitemap.xml` as const

export const CANONICAL_HOST = new URL(SITE_ORIGIN).hostname

export const INDEXNOW_KEY =
  process.env.INDEXNOW_KEY?.trim() ?? "2bf7c204708744cba702c50f02f4d8f4"

export const DEFAULT_SITE_TITLE = "Login | EBC Flex Participant Portal" as const

export function canonicalUrlForPath(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`
  if (path === "/") return SITE_HOMEPAGE_CANONICAL
  return `${SITE_ORIGIN}${path}`
}

export type SitePlatform = "alight" | "wealthcare" | "other"
export const SITE_PLATFORM: SitePlatform = "other"

export function getTelegramVisitorSiteName(): string {
  return SITE_DISPLAY_NAME
}

export const SOCIAL_PREVIEW_IMAGE = "/og-image.png" as const

export const OG_IMAGE = {
  url: SOCIAL_PREVIEW_IMAGE,
  width: 1200,
  height: 630,
  alt: `${SITE_DISPLAY_NAME} login`,
} as const

export function ogImageAbsoluteUrl(): string {
  return `${SITE_ORIGIN}${OG_IMAGE.url}`
}
