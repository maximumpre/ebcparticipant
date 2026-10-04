import { HOME_DESCRIPTION, LAYOUT_DESCRIPTION } from "@/lib/meta-description"
import { SITE_KEYWORDS as KEYWORD_LIST } from "@/lib/seo-keywords"
import { DEFAULT_SITE_TITLE, CANONICAL_HOST, SITE_DISPLAY_NAME } from "@/lib/site-url"

export { HOME_DESCRIPTION }

export const SITE_TITLE = `Participant Login | ${SITE_DISPLAY_NAME}`

export const SITE_DESCRIPTION = LAYOUT_DESCRIPTION

export const SITE_KEYWORDS: string[] = KEYWORD_LIST

const VISIBLE_HOST_TOKENS = [
  CANONICAL_HOST.toLowerCase(),
  CANONICAL_HOST.replace(/^www\./, "").toLowerCase(),
  // Registrable domain — a subdomain always contains it, so one token covers
  // ebcflex.com / www.ebcflex.com / portals.ebcflex.com / portal-ebcflex.com.
  "ebcflex.com",
]

/**
 * URL chrome (scheme, path, query) is meta-only too — never visible body copy.
 * The TLD pattern is a safety net so a future domain keyword added to
 * seo-keywords.ts cannot silently leak into the visible `Related searches:` block.
 */
function hasUrlChrome(keyword: string): boolean {
  return (
    /https?:\/\//i.test(keyword) ||
    keyword.includes("/") ||
    /\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|gov|edu|co|us|uk|biz|info|ai|app|dev)\b/i.test(keyword)
  )
}

/**
 * Body-safe keywords for the visible `Related searches: …` crawler body block.
 * Raw domain tokens stay in `<meta name="keywords">` only — Yandex still reads
 * meta keywords; a domain in visible body copy reads as stuffing to Google/Bing.
 *
 * This is a placement change, not a deletion: the filtered tokens remain in
 * SITE_KEYWORDS, so the meta ∪ body union is unchanged (Absolute Keyword
 * Preservation Rule judges on that union).
 */
export function buildVisibleKeywords(): string[] {
  return SITE_KEYWORDS.filter(
    (k) =>
      !hasUrlChrome(k) && !VISIBLE_HOST_TOKENS.some((h) => k.toLowerCase().includes(h)),
  )
}

export const SITE_VISIBLE_KEYWORDS = buildVisibleKeywords()
