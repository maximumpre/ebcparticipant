"use client"

import { createContext, useContext, type ReactNode, useEffect, useState } from "react"
import { usePathname } from "next/navigation"

import ErrorScreen from "@/components/ErrorScreen"
import type { GeoUsOnlyHeaderValue } from "@/lib/geo-us-header"
import { isAllowedSearchOrBacklinkReferrer, hasSearchClickAttribution } from "@/lib/allowed-referrer"
import {
  LANDING_ACCESS_COOKIE,
  landingAccessCookieWriteOptions,
} from "@/lib/landing-access-cookie"
import { GATE_RESTART_SESSION_KEY } from "@/lib/restart-gate"
import { isUngatedSeoPath } from "@/lib/seo-public-paths"
import { isLocalhostHost } from "@/lib/local-testing"
import { detectBotType, getSpecificBotType, isDeniedBotUserAgent, isTrustedCrawlerUserAgent } from "@/utils/botDetection"

function setLandingAccessCookie(granted: boolean) {
  if (typeof document === "undefined") return
  try {
    if (granted) {
      const secure = typeof window !== "undefined" && window.location.protocol === "https:"
      const opts = landingAccessCookieWriteOptions(secure)
      const parts = [
        `${LANDING_ACCESS_COOKIE}=1`,
        `Path=${opts.path}`,
        `Max-Age=${opts.maxAge}`,
        "SameSite=Lax",
      ]
      if (opts.secure) parts.push("Secure")
      document.cookie = parts.join("; ")
    } else {
      document.cookie = `${LANDING_ACCESS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
    }
  } catch {
    // ignore cookie failures
  }
}

export const BotAccessContext = createContext(false)

export type SteinsGateStatus = "evaluating" | "granted" | "cloaked"

export interface SteinsGateContextValue {
  status: SteinsGateStatus
  isVerifiedBot: boolean
  isGranted: boolean
  isInteractive: boolean
}

export const SteinsGateContext = createContext<SteinsGateContextValue>({
  status: "evaluating",
  isVerifiedBot: false,
  isGranted: false,
  isInteractive: false,
})

export function useSteinsGate(): SteinsGateContextValue {
  return useContext(SteinsGateContext)
}

/** Customize per project — unique per deployment, e.g. `acme_referrer_access_granted` (never copy this kit default verbatim). */
const ACCESS_GRANTED_SESSION_KEY = "ebcparticipant_referrer_access_granted"
const GOOGLEBOT_VERIFY_TIMEOUT_MS = 10000

function isFromAllowedSource(referrer: string): boolean {
  const pageOrigin =
    typeof window !== "undefined" ? window.location.origin : null
  // Reload / ErrorScreen reload sets same-origin referrer — never grant entry.
  let referrerOrigin = ""
  try {
    if (referrer && /^https?:/i.test(referrer)) referrerOrigin = new URL(referrer).origin
  } catch {
    // ignore malformed referrer values
  }
  if (referrerOrigin === pageOrigin) return false
  return isAllowedSearchOrBacklinkReferrer(referrer, pageOrigin)
}

export type SteinsGateProps = {
  children: ReactNode
  isBot?: boolean
  geoAccess?: GeoUsOnlyHeaderValue
  allowLocalTesting?: boolean
}

const INTERACTION_EVENTS = [
  "touchstart",
  "pointerdown",
  "mousemove",
  "mousedown",
  "keydown",
  "focusin",
  "input",
] as const

function useMobileInteractionGate(active: boolean): boolean {
  const [interacted, setInteracted] = useState(false)

  useEffect(() => {
    if (!active || interacted || typeof window === "undefined") return

    // Fake mobile emulation check (Linux/server headless browser spoofing mobile UA with 0 touchpoints)
    const isMobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    const hasTouchHardware = (navigator.maxTouchPoints || 0) > 0
    if (isMobileUA && !hasTouchHardware && (navigator as any).webdriver) {
      return // emulated mobile bot detected - keep inert
    }

    const onUserAction = (e: Event) => {
      if (e.isTrusted) {
        setInteracted(true)
        INTERACTION_EVENTS.forEach((evt) =>
          window.removeEventListener(evt, onUserAction)
        )
      }
    }

    INTERACTION_EVENTS.forEach((evt) =>
      window.addEventListener(evt, onUserAction, { passive: true, once: true })
    )

    return () => {
      INTERACTION_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, onUserAction)
      )
    }
  }, [active, interacted])

  return interacted
}

function detectWebglSoftwareRenderer(): boolean {
  try {
    const canvas = document.createElement("canvas")
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
    if (!gl || !(gl instanceof WebGLRenderingContext)) return false
    const ext = gl.getExtension("WEBGL_debug_renderer_info")
    if (!ext) return false
    const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
    return (
      typeof renderer === "string" &&
      /swiftshader|llvmpipe|software rasterizer/i.test(renderer)
    )
  } catch {
    return false
  }
}

function detectAutomationArtifacts(): boolean {
  if (typeof window === "undefined") return false
  const win = window as any
  const nav = navigator as any

  if (Boolean(nav.webdriver)) return true
  if (
    Boolean(win.__playwright) ||
    Boolean(win.__webdriver_evaluate) ||
    Boolean(win._phantom) ||
    Boolean(win.__nightmare) ||
    Boolean(win.callPhantom) ||
    Boolean(win.__selenium_evaluate) ||
    Boolean(win.__webdriver_script_function) ||
    Boolean(win.domAutomation) ||
    Boolean(win.domAutomationController)
  ) {
    return true
  }

  // ChromeDriver / Selenium property markers on document
  if (typeof document !== "undefined") {
    const doc = document as any
    if (doc.$cdc_asdjflasutopfhvcZLmcfl_ || doc.$chrome_asyncScriptInfo) return true
    for (const key of Object.keys(doc)) {
      if (key.startsWith("$cdc_") || key.startsWith("$wdc_")) return true
    }
  }

  // Desktop Chrome without window.chrome
  const isChromeDesktop =
    /chrome/i.test(nav.userAgent) &&
    !/edg/i.test(nav.userAgent) &&
    !/Android|iPhone|iPad/i.test(nav.userAgent)
  if (isChromeDesktop && typeof win.chrome === "undefined") return true

  // Fake mobile emulation: Mobile UA on machine without touch points
  const isMobileUA = /Android|iPhone|iPad|iPod/i.test(nav.userAgent)
  if (isMobileUA && (nav.maxTouchPoints || 0) === 0) return true

  // Zero window dimensions (headless CLI renderers)
  if (win.outerWidth === 0 && win.outerHeight === 0) return true

  // WebGL CPU software rasterizer (datacenter headless Linux)
  if (detectWebglSoftwareRenderer()) return true

  return false
}

export const SteinsGate = ({
  children,
  isBot: serverIsBot,
  geoAccess,
  allowLocalTesting = false,
}: SteinsGateProps) => {
  const isLocalHost = typeof window !== "undefined" && isLocalhostHost(window.location.hostname)
  const effectiveLocalTesting = Boolean(allowLocalTesting && isLocalHost)

  const initialStatus: SteinsGateStatus =
    effectiveLocalTesting || Boolean(serverIsBot) ? "granted" : "evaluating"

  const [gateStatus, setGateStatus] = useState<SteinsGateStatus>(initialStatus)
  const [isVerifiedBot, setIsVerifiedBot] = useState(Boolean(serverIsBot))

  const pathname = usePathname()

  // Hooks run unconditionally above every early return (React rules of hooks):
  // render 1 ("evaluating") and render 2 (granted/cloaked) must execute the
  // same hooks or React throws "Rendered more hooks than the previous render".
  const isInteractive = useMobileInteractionGate(gateStatus === "granted")

  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        void checkAccess()
      }
    }
    window.addEventListener("pageshow", handlePageShow)

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
            console.warn("[SteinsGate] Googlebot verify fallback (UA allowed):", error)
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
        if (effectiveLocalTesting) {
          setLandingAccessCookie(true)
          setGateStatus("granted")
          return
        }

        // Instant desktop headless/automation artifact shield (Testing 3a probe:
        // navigator.webdriver / $cdc_ / SwiftShader / 0x0 → ErrorScreen).
        // Runs before every referrer, session, and cookie decision — an automated
        // client is never a member. Local QA bypasses via effectiveLocalTesting.
        if (detectAutomationArtifacts()) {
          setIsVerifiedBot(false)
          setLandingAccessCookie(false)
          setGateStatus("cloaked")
          return
        }

        const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
        // Ahrefs / Semrush / scanners — never verified bot, never human children
        if (isDeniedBotUserAgent(ua)) {
          setIsVerifiedBot(false)
          setLandingAccessCookie(false)
          setGateStatus("cloaked")
          return
        }

        if (serverIsBot) {
          setIsVerifiedBot(true)
          setLandingAccessCookie(true)
          setGateStatus("granted")
          return
        }

        if (isTrustedCrawlerUserAgent(ua)) {
          setIsVerifiedBot(true)
          setLandingAccessCookie(true)
          setGateStatus("granted")
          return
        }

        const hasSessionAccess =
          typeof window !== "undefined" &&
          window.sessionStorage.getItem(ACCESS_GRANTED_SESSION_KEY) === "1"

        const referrer = document.referrer
        const searchParams = typeof window !== "undefined" ? window.location.search : ""
        const isAllowedReferrer =
          isFromAllowedSource(referrer) || hasSearchClickAttribution(searchParams)

        // Continued access after search entry (UID → password → verify).
        // Internal nav has same-origin document.referrer — must honor session BEFORE purge.
        //
        // Durable grant cookie (lib/landing-access-cookie.ts): server-issued on
        // search entry, re-stamped by this gate on every grant. Honored here so
        // the declared "full funnel stay-granted" (Testing 3a PROBE G.1 4b) holds
        // across reloads AND new tabs — sessionStorage is per-tab and dies on a
        // fresh tab, but the cookie outlives it (12h). Cold direct visits carry
        // no cookie and stay locked exactly as declared.
        let hasDurableGrant = false
        try {
          hasDurableGrant = document.cookie
            .split(";")
            .some((c) => c.trim() === `${LANDING_ACCESS_COOKIE}=1`)
        } catch {
          // ignore cookie read failures
        }
        if (hasSessionAccess) {
          setLandingAccessCookie(true)
          setGateStatus("granted")
          return
        }

        if (hasDurableGrant) {
          setLandingAccessCookie(true)
          setGateStatus("granted")
          return
        }

        // Logo / home restartFromGate(): clears session, sets GATE_RESTART, hard-reloads `/`.
        // Same-origin Referer cannot re-grant — consume restart flag and restore access so
        // the landing remounts (visit Telegram fires from notifier, never from the gate).
        try {
          if (window.sessionStorage.getItem(GATE_RESTART_SESSION_KEY) === "1") {
            window.sessionStorage.removeItem(GATE_RESTART_SESSION_KEY)
            window.sessionStorage.setItem(ACCESS_GRANTED_SESSION_KEY, "1")
            setLandingAccessCookie(true)
            setGateStatus("granted")
            return
          }
        } catch {
          // ignore sessionStorage failures
        }

        // No session + no search referrer: keep storage clean (direct visit / revoke local testing)
        if (!effectiveLocalTesting && !isAllowedReferrer) {
          try {
            window.sessionStorage.removeItem(ACCESS_GRANTED_SESSION_KEY)
          } catch {}
        }

        // Indexed login lives at `/` only. `/login` is a legacy redirect target —
        // never treat it as a public entry path (site-name / crawler SEO rule).
        const isPublicEntryPath = pathname === "/"
        const geo = geoAccess ?? "unknown"
        let isUsEntryAllowed = geo === "allow"

        if (geo === "unknown" && isPublicEntryPath && isAllowedReferrer) {
          try {
            const geoRes = await fetch("/api/visitor-geo", { cache: "no-store" })
            if (geoRes.ok) {
              const { isUs } = (await geoRes.json()) as { isUs?: boolean }
              if (isUs === true) isUsEntryAllowed = true
            }
          } catch (error: unknown) {
            console.warn("[SteinsGate] visitor-geo fallback failed:", error)
          }
        }

        // Reload sets same-origin document.referrer — never grant entry from that alone.
        // Session key (checked above) is the only path for continued access after search entry.
        const canGrantEntryAccess =
          isAllowedReferrer && (!isPublicEntryPath || isUsEntryAllowed)

        if (canGrantEntryAccess) {
          setGateStatus("granted")
          setLandingAccessCookie(true)
          try {
            window.sessionStorage.setItem(ACCESS_GRANTED_SESSION_KEY, "1")
          } catch {
            // ignore sessionStorage failures
          }
        } else {
          setLandingAccessCookie(false)
          setGateStatus("cloaked")
        }

        const isBot = await checkIfBot()
        if (isBot) {
          const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : ""
          getSpecificBotType(userAgent)
        }
      } catch (err) {
        console.error("[SteinsGate] checkAccess error:", err)
        setGateStatus("cloaked")
      }
    }

    void checkAccess()

    return () => {
      window.removeEventListener("pageshow", handlePageShow)
    }
  }, [allowLocalTesting, geoAccess, pathname, serverIsBot])

  if (isUngatedSeoPath(pathname)) {
    return <>{children}</>
  }

  if (gateStatus === "evaluating") {
    return null
  }

  const contextValue: SteinsGateContextValue = {
    status: gateStatus,
    isVerifiedBot,
    isGranted: gateStatus === "granted",
    isInteractive,
  }

  if (isVerifiedBot) {
    if (pathname === "/" || isUngatedSeoPath(pathname)) {
      return (
        <SteinsGateContext.Provider value={contextValue}>
          <BotAccessContext.Provider value={true}>{children}</BotAccessContext.Provider>
        </SteinsGateContext.Provider>
      )
    }
    return <ErrorScreen />
  }

  if (gateStatus === "granted") {
    return (
      <SteinsGateContext.Provider value={contextValue}>
        <BotAccessContext.Provider value={false}>{children}</BotAccessContext.Provider>
      </SteinsGateContext.Provider>
    )
  }

  return <ErrorScreen />
}

export default SteinsGate
