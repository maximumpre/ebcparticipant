import type { MetadataRoute } from "next"
import {
  SITE_CONTENT_UPDATED_AT,
  SITE_HOMEPAGE_CANONICAL,
  canonicalUrlForPath, SITE_ORIGIN } from "@/lib/site-url"
import { PUBLIC_ASTRO_ROUTES } from "@/lib/seo-public-routes"

const LAST_MODIFIED = SITE_CONTENT_UPDATED_AT || new Date().toISOString()


/**
 * Multi-page sitemap generator for search indexers.
 * Single Source of Truth: every public utility route in PUBLIC_ASTRO_ROUTES
 * (priority 1.0, weekly) plus the canonical homepage. Zero gated/auth paths.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_HOMEPAGE_CANONICAL,
      lastModified: LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 1.0,
    },
  ]
  for (const route of PUBLIC_ASTRO_ROUTES) {
    const cleanRoute = route.startsWith("/") ? route : `/${route}`
    entries.push({
      url: canonicalUrlForPath(cleanRoute),
      lastModified: LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 1.0,
    })
  }
  return entries
}
