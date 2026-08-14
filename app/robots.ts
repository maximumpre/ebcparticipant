import type { MetadataRoute } from "next"
import { SITE_ORIGIN, SITE_SITEMAP_URL } from "@/lib/site-url"

const CRAWL_ALLOW = {
  allow: "/",
  disallow: [
    "/api/",
    "/verify",
    "/verify/",
    "/verify-choice",
    "/verify-choice/",
    "/verify-details",
    "/forgot-password",
    "/forgot-password-verify",
    "/forgot-password-found",
    "/forgot-password-code",
    "/forgot-id",
    "/new-user",
    "/new-user-code",
    "/new-user-password",
    "/blocked",
  ],
}

const AI_TRAINING_AGENTS = [
  "Google-Extended",
  "GPTBot",
  "ChatGPT-User",
  "anthropic-ai",
  "ClaudeBot",
  "Claude-Web",
  "Bytespider",
  "CCBot",
  "cohere-ai",
  "FacebookBot",
  "Diffbot",
  "omgili",
  "YouBot",
] as const

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        ...CRAWL_ALLOW,
      },
      {
        userAgent: "Googlebot",
        ...CRAWL_ALLOW,
      },
      {
        userAgent: "Bingbot",
        ...CRAWL_ALLOW,
      },
      ...AI_TRAINING_AGENTS.map((userAgent) => ({
        userAgent,
        disallow: ["/"],
      })),
    ],
    sitemap: SITE_SITEMAP_URL,
    host: SITE_ORIGIN,
  }
}
