import type React from "react";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

const CANONICAL_LOGIN_URL = "https://portal-ebcflex.com";
const SITE_DOMAIN = "portals.ebcflex.com";
const SITE_BRAND = "EBC Flex Participant Portal";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || CANONICAL_LOGIN_URL,
  ),
  title: {
    default: "Participant Login | EBC Flex",
    template: "%s | EBC Flex Participant Portal",
  },
  keywords: [
    "EBC Flex",
    "EBC Flex participant portal",
    "portals.ebcflex.com",
    "participant login",
    "participant portal",
    "benefits login",
    "employee benefits portal",
    "account access",
    "benefits account login",
    "participant authenticate user",
    "EBC Flex login",
    "EBC Flex participant sign in",
    "employee benefits account",
    "benefits portal access",
  ],
  description: `${SITE_BRAND} – ${SITE_DOMAIN}. Sign in securely to access your participant benefits account and resources.`,

  authors: [{ name: SITE_BRAND }],
  creator: SITE_BRAND,
  publisher: SITE_BRAND,
  applicationName: SITE_BRAND,
  referrer: "origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "EBC Flex Participant Portal Login",
    description: `${SITE_BRAND} at ${SITE_DOMAIN}. Sign in securely to access your participant benefits account and resources.`,
    siteName: SITE_BRAND,
    url: CANONICAL_LOGIN_URL,
    images: [
      {
        url: "/favicon.ico",
        width: 32,
        height: 32,
        alt: `${SITE_BRAND}`,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "EBC Flex Participant Portal Login",
    description: `${SITE_BRAND} at ${SITE_DOMAIN}. Sign in securely to access your participant benefits account and resources.`,
    images: ["favicon.ico"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
  themeColor: "#254650",
  category: "Business",
  alternates: {
    canonical: CANONICAL_LOGIN_URL,
    languages: {
      "en-US": CANONICAL_LOGIN_URL,
    },
  },
  other: {
    "geo.region": "US",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_BRAND,
  url: CANONICAL_LOGIN_URL,
  description:
    "EBC Flex participant sign in portal. Login to manage your benefits, view account resources, and access your participant profile.",
  publisher: {
    "@type": "Organization",
    name: SITE_BRAND,
  },
  inLanguage: "en-US",
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", url: CANONICAL_LOGIN_URL },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-US">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${geist.className} font-sans antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
