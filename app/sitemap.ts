import type { MetadataRoute } from "next"
import { SITE_HOMEPAGE_CANONICAL } from "@/lib/site-url"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_HOMEPAGE_CANONICAL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ]
}
