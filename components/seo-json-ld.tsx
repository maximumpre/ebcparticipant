import { LAYOUT_DESCRIPTION } from "@/lib/meta-description"
import {
  SITE_DISPLAY_NAME,
  SITE_HOMEPAGE_CANONICAL,
  SITE_ORIGIN,
  ogImageAbsoluteUrl,
} from "@/lib/site-url"

/**
 * Optional Knowledge Graph entity URLs. Empty for private employers.
 */
export const ORGANIZATION_SAME_AS: readonly string[] = []

/** Brand phrases only — never hostnames (Google SERP Layer 1 duplicate-URL trap). */
function buildAlternateNames(): string[] {
  return [
    SITE_DISPLAY_NAME,
    `${SITE_DISPLAY_NAME} Login`,
    `${SITE_DISPLAY_NAME} Participant Portal`,
    "Employee Benefits Corporation",
    "EBCentral",
    "Your Personal Benefit Account",
    "My Account Assistant",
  ]
}

export function StructuredData() {
  const websiteId = `${SITE_HOMEPAGE_CANONICAL}#website`
  const organizationId = `${SITE_ORIGIN}/#organization`
  const breadcrumbId = `${SITE_HOMEPAGE_CANONICAL}#breadcrumb`
  const logoUrl = ogImageAbsoluteUrl()

  const organization: Record<string, unknown> = {
    "@type": "Organization",
    "@id": organizationId,
    name: SITE_DISPLAY_NAME,
    url: SITE_ORIGIN,
    logo: {
      "@type": "ImageObject",
      url: logoUrl,
      width: 1200,
      height: 630,
    },
  }
  if (ORGANIZATION_SAME_AS.length > 0) {
    organization.sameAs = [...ORGANIZATION_SAME_AS]
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: SITE_DISPLAY_NAME,
        alternateName: buildAlternateNames(),
        url: SITE_HOMEPAGE_CANONICAL,
        description: LAYOUT_DESCRIPTION,
        inLanguage: "en-US",
        publisher: { "@id": organizationId },
        potentialAction: {
          "@type": "LoginAction",
          target: {
            "@type": "EntryPoint",
            url: SITE_HOMEPAGE_CANONICAL,
          },
          name: `Sign in to ${SITE_DISPLAY_NAME}`,
        },
      },
      organization,
      {
        "@type": "BreadcrumbList",
        "@id": breadcrumbId,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: SITE_HOMEPAGE_CANONICAL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Sign In",
            item: SITE_HOMEPAGE_CANONICAL,
          },
        ],
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  )
}

export const SeoJsonLd = StructuredData
