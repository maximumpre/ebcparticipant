/**
 * Resolved image URLs for the Astro pages.
 *
 * CRITICAL: When importing assets via Vite/Astro, imported images return an
 * ImageMetadata OBJECT ({ src, width, height, format }), not a URL string.
 * Interpolating the object directly renders `src="[object Object]"` in <img>.
 *
 * This module exports safe URL strings for THIS project's cloned assets.
 */

export const toImageUrl = (asset: string | { src: string }): string =>
  typeof asset === "string" ? asset : encodeURI(asset.src)

/** EBC Flex participant portal logo (public/emp/images/logo.png). */
export const BRAND_LOGO_SRC = "/emp/images/logo.png"

/** Hero / side panel image on the human login landing. */
export const HERO_IMAGE_SRC = "/emp/images/Participant-Portal-Login.jpg"

export const PARTNER_LOGO_SRC = "/emp/images/logo.png"
