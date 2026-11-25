const DOH_CLOUDFLARE = "https://cloudflare-dns.com/dns-query"
const DOH_GOOGLE = "https://dns.google/resolve"

type DohAnswer = { name?: string; type?: number; data?: string }

const DNS_CACHE = new Map<string, { result: "VERIFIED" | "SPOOFED" | "UNVERIFIED"; expiresAt: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
/** N-8: short TTL for verified no-PTR hosts so DoH queries cannot be pre-rate-limit amplified. */
const UNVERIFIED_CACHE_TTL_MS = 90 * 1000 // 90 seconds
/** Cap so IP-diverse traffic cannot grow the Map unbounded (S16). */
const DNS_CACHE_MAX_ENTRIES = 10_000

function cacheDnsResult(key: string, result: "VERIFIED" | "SPOOFED" | "UNVERIFIED", ttlMs: number = CACHE_TTL_MS): void {
  if (DNS_CACHE.size >= DNS_CACHE_MAX_ENTRIES) {
    // Map preserves insertion order — evict the oldest entry.
    const oldest = DNS_CACHE.keys().next()
    if (!oldest.done) DNS_CACHE.delete(oldest.value)
  }
  DNS_CACHE.set(key, { result, expiresAt: Date.now() + ttlMs })
}

/**
 * Returns `null` when BOTH DoH providers were unreachable (network error /
 * timeout), so callers can distinguish "cannot verify" from "verified empty
 * answer" (S3) and avoid caching a negative result across an outage.
 */
async function dohQuery(
  name: string,
  type: "PTR" | "A" | "AAAA",
): Promise<DohAnswer[] | null> {
  // 1. Primary: Cloudflare DoH with 2500ms timeout
  try {
    const cfUrl = `${DOH_CLOUDFLARE}?name=${encodeURIComponent(name)}&type=${type}`
    const res = await fetch(cfUrl, {
      headers: { Accept: "application/dns-json" },
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    })
    if (res.ok) {
      const data = (await res.json()) as { Answer?: DohAnswer[] }
      if (Array.isArray(data.Answer)) return data.Answer
    }
  } catch {
    // Failover to Google DoH
  }

  // 2. Failover: Google DoH with 2500ms timeout
  try {
    const gUrl = `${DOH_GOOGLE}?name=${encodeURIComponent(name)}&type=${type}`
    const res = await fetch(gUrl, {
      headers: { Accept: "application/dns-json" },
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    })
    if (res.ok) {
      const data = (await res.json()) as { Answer?: DohAnswer[] }
      if (Array.isArray(data.Answer)) return data.Answer
    }
  } catch {
    // Both DoH providers unreachable
  }

  return null
}

function isPrivateIpv4(ip: string): boolean {
  const n = ip.split(".").map(Number)
  if (n.length !== 4 || n.some((x) => !Number.isInteger(x))) return true
  if (n[0] === 10) return true
  if (n[0] === 127) return true
  if (n[0] === 192 && n[1] === 168) return true
  if (n[0] === 172 && n[1] >= 16 && n[1] <= 31) return true
  return false
}

function ptrNameForIpv4(ip: string): string | null {
  if (isPrivateIpv4(ip)) return null
  const parts = ip.split(".")
  if (parts.length !== 4) return null
  return `${parts[3]}.${parts[2]}.${parts[1]}.${parts[0]}.in-addr.arpa`
}

function expandIpv6(ip: string): string | null {
  const clean = ip.toLowerCase().trim()
  if (!clean.includes(":")) return null
  if (clean === "::1" || clean.startsWith("fe80:") || clean.startsWith("fc00:") || clean.startsWith("fd00:")) {
    return null
  }
  const doubleColonIndex = clean.indexOf("::")
  let groups: string[] = []
  if (doubleColonIndex !== -1) {
    const left = clean.slice(0, doubleColonIndex).split(":").filter(Boolean)
    const right = clean.slice(doubleColonIndex + 2).split(":").filter(Boolean)
    const missing = 8 - (left.length + right.length)
    if (missing < 0) return null
    groups = [...left, ...Array(missing).fill("0"), ...right]
  } else {
    groups = clean.split(":").filter(Boolean)
  }
  if (groups.length !== 8) return null
  return groups.map((g) => g.padStart(4, "0")).join("")
}

function ptrNameForIpv6(ip: string): string | null {
  const hex32 = expandIpv6(ip)
  if (!hex32 || hex32.length !== 32) return null
  return `${hex32.split("").reverse().join(".")}.ip6.arpa`
}

function ptrNameForIp(ip: string): string | null {
  const trimmed = ip.trim()
  if (!trimmed) return null
  if (trimmed.includes(":")) return ptrNameForIpv6(trimmed)
  return ptrNameForIpv4(trimmed)
}

function hostnameMatchesSuffix(hostname: string, suffixes: readonly string[]): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, "")
  return suffixes.some((suffix) => {
    const s = suffix.toLowerCase()
    return lower === s.slice(1) || lower.endsWith(s)
  })
}

async function forwardResolvesToIp(hostname: string, ip: string): Promise<boolean | null> {
  const clean = hostname.replace(/\.$/, "")
  const [aRecords, aaaaRecords] = await Promise.all([
    dohQuery(clean, "A"),
    dohQuery(clean, "AAAA"),
  ])

  if (aRecords === null && aaaaRecords === null) {
    // Both DoH providers unreachable or timed out — cannot determine forward resolution
    return null
  }

  for (const record of aRecords ?? []) {
    if (record.data === ip) return true
  }

  if (ip.includes(":")) {
    const normalized = expandIpv6(ip)
    for (const record of aaaaRecords ?? []) {
      if (record.data && expandIpv6(record.data) === normalized) return true
    }
  }

  return false
}

export async function verifyDnsBot(
  ip: string,
  suffixes: readonly string[],
): Promise<"VERIFIED" | "SPOOFED" | "UNVERIFIED"> {
  const cleanIp = ip.trim()
  if (!cleanIp) return "UNVERIFIED"

  const cacheKey = `${cleanIp}|${suffixes.join(",")}`
  const cached = DNS_CACHE.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.result
  }

  const ptrName = ptrNameForIp(cleanIp)
  if (!ptrName) return "UNVERIFIED"

  try {
    const ptrAnswers = await dohQuery(ptrName, "PTR")
    if (ptrAnswers === null) {
      // Both DoH providers unreachable — cannot verify; do NOT cache a
      // negative result (S3), so the next request retries.
      return "UNVERIFIED"
    }

    // Evaluate ALL PTR records (S19): multi-PTR hosts pass if ANY name matches
    // the expected suffix; that hostname is then forward-confirmed.
    const ptrHostnames = ptrAnswers
      .filter((a) => a.type === 12)
      .map((a) => a.data?.replace(/\.$/, ""))
      .filter((h): h is string => Boolean(h))
    if (ptrHostnames.length === 0) {
      cacheDnsResult(cacheKey, "UNVERIFIED", UNVERIFIED_CACHE_TTL_MS)
      return "UNVERIFIED"
    }

    const matchingHostname = ptrHostnames.find((h) => hostnameMatchesSuffix(h, suffixes))
    if (!matchingHostname) {
      cacheDnsResult(cacheKey, "SPOOFED")
      return "SPOOFED"
    }

    const forwardRes = await forwardResolvesToIp(matchingHostname, cleanIp)
    if (forwardRes === null) {
      // DoH timed out or unreachable — cannot confirm forward DNS; do not poison cache with SPOOFED
      return "UNVERIFIED"
    }
    const result = forwardRes ? "VERIFIED" : "SPOOFED"
    cacheDnsResult(cacheKey, result)
    return result
  } catch {
    return "UNVERIFIED"
  }
}
