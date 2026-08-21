"use client"

import { createContext, type ReactNode, useEffect, useState } from "react"
import { usePathname } from "next/navigation"

import ErrorScreen from "@/components/ErrorScreen"
import "@/components/error-screen.css"
import type { GeoUsOnlyHeaderValue } from "@/lib/geo-us-header"
import { AI_REFERRAL_HOSTS } from "@/lib/ai-referral"
import { ALLOWED_BACKLINK_HOSTS } from "@/lib/project-config"
import { isUngatedSeoPath } from "@/lib/seo-public-paths"
import {
  ACCESS_GRANTED_SESSION_KEY,
  GATE_RESTART_SESSION_KEY,
  VISIT_NOTIFIED_SESSION_KEY,
} from "@/lib/restart-gate"
import { detectBotType, getSpecificBotType, isTrustedCrawlerUserAgent } from "@/utils/botDetection"

const ALLOWED_REFERRER_HOSTS = [
  "google.com",
  "www.google.com",
  "google.co.uk",
  "google.de",
  "google.fr",
  "google.es",
  "google.it",
  "google.ca",
  "google.com.au",
  "google.co.in",
  "google.com.br",
  "googleadservices.com",
  "bing.com",
  "www.bing.com",
  "yahoo.com",
  "duckduckgo.com",
  "baidu.com",
  "yandex.com",
  "yandex.ru",
  "ecosia.org",
  "startpage.com",
  "ask.com",
  "aol.com",,
  ...AI_REFERRAL_HOSTS,
]

export const BotAccessContext = createContext(false)

const visitNotifyInFlight = new Set<string>()

function fireVisitNotifyOnce(sessionKey: string) {
  if (typeof window === "undefined") return
  try {
    if (window.sessionStorage.getItem(sessionKey) === "1") return
  } catch {
    // ignore sessionStorage failures; still attempt notify
  }
  if (visitNotifyInFlight.has(sessionKey)) return
  visitNotifyInFlight.add(sessionKey)
  void fetch("/api/telegram/visitor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userAgent: navigator.userAgent,
      screen: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language,
      referrer: document.referrer || "Direct",
      pageUrl: window.location.href,
    }),
    keepalive: true,
  })
    .then(async (res) => {
      if (!res.ok) return
      try {
        const data = (await res.json()) as { telegramSent?: boolean }
        if (data.telegramSent !== true) return
        window.sessionStorage.setItem(sessionKey, "1")
      } catch {
        // ignore parse / storage failures
      }
    })
    .catch(() => {})
    .finally(() => {
      visitNotifyInFlight.delete(sessionKey)
    })
}


const GOOGLEBOT_VERIFY_TIMEOUT_MS = 10000

const PUBLIC_ENTRY_PATHS = new Set(["/"])

function isPublicEntryPath(pathname: string): boolean {
  return PUBLIC_ENTRY_PATHS.has(pathname)
}

function isBotAllowedPath(pathname: string): boolean {
  return isPublicEntryPath(pathname) || isUngatedSeoPath(pathname)
}

const normalizeReferrerValue = (value: string) => value.toLowerCase().replace(/^www\./, "")

const normalizeOrigin = (value: string) => value.toLowerCase().replace(/^(https?:\/\/)www\./, "$1")

function isFromAllowedSource(referrer: string): boolean {
  if (!referrer || !referrer.startsWith("http")) return false
  try {
    const referrerUrl = new URL(referrer)
    const referrerHostname = normalizeReferrerValue(referrerUrl.hostname)
    const referrerHost = normalizeReferrerValue(referrerUrl.host)
    const referrerOrigin = normalizeOrigin(referrerUrl.origin)

    if (typeof window !== "undefined") {
      const pageOrigin = normalizeOrigin(window.location.origin)
      if (referrerOrigin === pageOrigin) return false
    }

    const allAllowed = [...ALLOWED_REFERRER_HOSTS, ...ALLOWED_BACKLINK_HOSTS]

    return allAllowed.some((allowed) => {
      const normalizedAllowed = allowed.toLowerCase()
      const isHostnameOnly =
        !normalizedAllowed.includes("://") && !normalizedAllowed.includes(":")

      if (isHostnameOnly) {
        const allowedHostname = normalizeReferrerValue(normalizedAllowed)
        return (
          referrerHostname === allowedHostname ||
          referrerHostname.endsWith(`.${allowedHostname}`)
        )
      }

      const allowedUrl =
        normalizedAllowed.startsWith("http://") || normalizedAllowed.startsWith("https://")
          ? new URL(normalizedAllowed)
          : new URL(`http://${normalizedAllowed}`)

      return (
        referrerHost === normalizeReferrerValue(allowedUrl.host) ||
        referrerOrigin === normalizeOrigin(allowedUrl.origin)
      )
    })
  } catch {
    return false
  }
}

type ReffererProviderProps = {
  children: ReactNode
  isBot?: boolean
  geoAccess?: GeoUsOnlyHeaderValue
  allowLocalTesting?: boolean
}

const ReffererProvider = ({
  children,
  isBot: serverIsBot,
  geoAccess,
  allowLocalTesting = false,
}: ReffererProviderProps) => {
  const [isLoading, setIsLoading] = useState(!serverIsBot)
  const [isVerifiedBot, setIsVerifiedBot] = useState(serverIsBot || false)
  const [isFromSearch, setIsFromSearch] = useState(allowLocalTesting)

  const pathname = usePathname()
  const isUngated = isUngatedSeoPath(pathname)

  useEffect(() => {
    if (isUngated) {
      setIsLoading(false)
      setIsFromSearch(true)
      return
    }

    const checkIfBot = async () => {
      try {
        const uaMatch = isTrustedCrawlerUserAgent(
          typeof navigator !== "undefined" ? navigator.userAgent : "",
        )
        if (!uaMatch) {
          return false
        }

        const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : ""
        const { botName } = detectBotType(userAgent)

        if (botName === "google") {
          try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), GOOGLEBOT_VERIFY_TIMEOUT_MS)
            const resp = await fetch("/api/verify-googlebot", { signal: controller.signal })
            clearTimeout(timeoutId)
            if (resp.ok) {
              const data = await resp.json()
              if (data?.isGooglebot === true) {
                setIsVerifiedBot(true)
                return true
              }
            }
          } catch (error: unknown) {
            console.warn("[ReferrerProvider] Googlebot verify fallback (UA allowed):", error)
          }
        }

        setIsVerifiedBot(true)
        return true
      } catch (error: unknown) {
        console.error("Error checking crawler status:", error)
        return false
      }
    }

    const checkAccess = async () => {
      if (typeof window === "undefined") return

      try {

        let isGateRestart = false
        try {
          isGateRestart =
            window.sessionStorage.getItem(GATE_RESTART_SESSION_KEY) === "1"
          if (isGateRestart) {
            window.sessionStorage.removeItem(GATE_RESTART_SESSION_KEY)
          }
        } catch {
          // ignore
        }

        if (isGateRestart) {
          // Logo/home restart: re-fire visit, re-grant without external referrer.
          fireVisitNotifyOnce(VISIT_NOTIFIED_SESSION_KEY)
          setIsFromSearch(true)
          try {
            window.sessionStorage.setItem(ACCESS_GRANTED_SESSION_KEY, "1")
          } catch {
            // ignore
          }
          return
        }

        if (allowLocalTesting) {
          fireVisitNotifyOnce(VISIT_NOTIFIED_SESSION_KEY)
          setIsFromSearch(true)
          return
        }

        if (serverIsBot) {
          setIsVerifiedBot(true)
          return
        }

        const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
        if (isTrustedCrawlerUserAgent(ua)) {
          setIsVerifiedBot(true)
          return
        }

        // Visit notify only after grant — never on ErrorScreen / Direct deny.
        const referrer = document.referrer
        const currentUrl = new URL(window.location.href)

        const hasSessionAccess =
          typeof window !== "undefined" &&
          window.sessionStorage.getItem(ACCESS_GRANTED_SESSION_KEY) === "1"

        if (hasSessionAccess) {
          fireVisitNotifyOnce(VISIT_NOTIFIED_SESSION_KEY)
          setIsFromSearch(true)
          return
        }

        const isAllowedReferrer = isFromAllowedSource(referrer)
        const entryPath = isPublicEntryPath(pathname)
        const geo = geoAccess ?? "unknown"
        let isUsEntryAllowed = geo === "allow"

        if (geo === "unknown" && entryPath && isAllowedReferrer) {
          try {
            const geoRes = await fetch("/api/visitor-geo", { cache: "no-store" })
            if (geoRes.ok) {
              const { isUs } = (await geoRes.json()) as { isUs?: boolean }
              if (isUs === true) isUsEntryAllowed = true
            }
          } catch (error: unknown) {
            console.warn("[ReferrerProvider] visitor-geo fallback failed:", error)
          }
        }

        const canGrantEntryAccess =
          isAllowedReferrer && (!entryPath || isUsEntryAllowed)

        if (canGrantEntryAccess) {
          fireVisitNotifyOnce(VISIT_NOTIFIED_SESSION_KEY)
          setIsFromSearch(true)
          try {
            window.sessionStorage.setItem(ACCESS_GRANTED_SESSION_KEY, "1")
          } catch {
            // ignore sessionStorage failures
          }
        } else {
          setIsFromSearch(false)
        }

        const isBot = await checkIfBot()
        if (isBot) {
          const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : ""
          getSpecificBotType(userAgent)
        }
      } finally {
        setIsLoading(false)
      }
    }

    void checkAccess()
  }, [allowLocalTesting, geoAccess, isUngated, pathname, serverIsBot])

  if (isUngated) {
    return <>{children}</>
  }
  if (isLoading) {
    return null
  }

  if (isVerifiedBot) {
    if (isBotAllowedPath(pathname)) {
      return <BotAccessContext.Provider value={true}>{children}</BotAccessContext.Provider>
    }
    return <ErrorScreen />
  }

  if (isFromSearch) {
    return <BotAccessContext.Provider value={false}>{children}</BotAccessContext.Provider>
  }

  return <ErrorScreen />
}

export default ReffererProvider
