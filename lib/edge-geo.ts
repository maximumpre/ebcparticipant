import type { NextRequest } from "next/server"
import { isBehindCloudflare } from "@/lib/client-ip"

/** True when this process is actually running on Vercel. */
function isOnVercel(): boolean {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV)
}

export function getRequestCountryCode(request: NextRequest): string | null {
  const h = request.headers

  // CLOUDFLARE FIRST: when CF proxies the zone, `x-vercel-ip-country` describes
  // the Cloudflare datacenter the request left from, not the visitor.
  // `cf-ipcountry` is set by the verified CF hop and is authoritative.
  // `XX` = unknown, `T1` = Tor — both fall through to the Vercel chain below.
  if (isBehindCloudflare(h)) {
    const cf = h.get("cf-ipcountry")?.trim().toUpperCase()
    if (cf && cf !== "XX" && cf !== "T1") return cf
  }

  if (isOnVercel()) {
    // S6 fix: on Vercel, prefer the Vercel PLATFORM geo first. `x-vercel-ip-country`
    // is assigned by the edge from the real client connection and cannot be forged
    // by the client, whereas `cf-ipcountry` / `x-country-code` / `x-gcore-country`
    // are client-settable when no Cloudflare/Gcore proxy is actually in front.
    // The CDN headers are now only a fallback for the rare case where Vercel geo
    // is absent (e.g. internal/platform-generated requests).
    const header = h.get("x-vercel-ip-country")
    if (header) {
      return header.trim().toUpperCase() || null
    }

    // Next.js edge geo fallback
    const fromGeo = (request as NextRequest & { geo?: { country?: string } }).geo?.country
    if (fromGeo && typeof fromGeo === "string") {
      return fromGeo.trim().toUpperCase() || null
    }
  }

  // Non-Vercel deploys (and Vercel requests without platform geo): CDN proxy
  // headers, original trust order preserved.
  // 1. Cloudflare proxy country header
  const cfHeader = h.get("cf-ipcountry")
  if (cfHeader) {
    const clean = cfHeader.trim().toUpperCase()
    if (clean && clean !== "XX" && clean !== "T1") return clean
  }

  // 2. Gcore CDN proxy country headers
  const gcoreHeader = h.get("x-country-code") || h.get("x-gcore-country")
  if (gcoreHeader) {
    const clean = gcoreHeader.trim().toUpperCase()
    if (clean) return clean
  }

  return null
}
