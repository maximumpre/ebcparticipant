import { hmacSha256Hex, timingSafeEqualHex } from "./edge-crypto"
import { resolveAdminNotifySecret } from "./admin-notify-secret"
import { isLocalTestingUnlocked } from "./local-testing"
import { LANDING_GRANT_SALT } from "./landing-grant-salt"

/**
 * Landing grant token — HMAC `exp:sig` over `${ip}|${ua-hash}`.
 *
 * CG-01 / X-8 / Y-2 / Y-4:
 *  - Server-issued only (middleware mints it whenever it serves an allowed
 *    landing entry). The client never writes this cookie (it is httpOnly).
 *  - Key: ADMIN_NOTIFY_SECRET → sha256(DATABASE_URL) → per-project salt.
 *    Never a typed constant shared across the pack (Y-2).
 *  - Subject binds client IP **and** a UA hash; a token minted for one client
 *    cannot be replayed from another IP or UA (Y-4 salt-and-pepper without
 *    breaking plain reloads, where both values are stable).
 *
 * Edge-safe: uses `lib/edge-crypto.ts` (no `node:crypto`) so middleware/proxy
 * bundles on Vercel Edge. Do not import from a "use client" component — use
 * `lib/landing-access-cookie.ts` there instead.
 */
export const LANDING_GRANT_MAX_AGE_SEC = 60 * 60 * 12

/** Max age for the short-lived entry mint (matches the middleware cookie write). */
export const LANDING_GRANT_ENTRY_MAX_AGE_SEC = 60 * 60

function getGrantSigningKey(): string {
  const secret = resolveAdminNotifySecret()
  if (secret) return secret
  // Y-2: never fall back to a literal phrase; use the per-project server salt.
  return LANDING_GRANT_SALT
}

function hashUa(userAgent: string): string {
  return hmacSha256Hex("landing-grant-ua", (userAgent || "").trim()).slice(0, 16)
}

/** Stable subject string bound into the token. */
function grantSubject(ip: string, userAgent: string): string {
  const cleanIp = (ip || "unknown").trim().toLowerCase()
  return `${cleanIp}|${hashUa(userAgent)}`
}

export function createLandingGrantToken(
  ip: string,
  userAgent: string,
  maxAgeSec: number = LANDING_GRANT_MAX_AGE_SEC,
): string {
  const exp = Date.now() + Math.max(1, Math.floor(maxAgeSec)) * 1000
  const key = getGrantSigningKey()
  const sig = hmacSha256Hex(key, `${grantSubject(ip, userAgent)}:${exp}`).slice(0, 32)
  return `${exp}:${sig}`
}

export function verifyLandingGrantToken(
  token: string | undefined | null,
  ip: string,
  userAgent: string,
): boolean {
  if (!token?.trim()) return false

  // Local QA convenience: the literal "1" is only honoured with the gate unlocked.
  if (isLocalTestingUnlocked() && (token === "1" || token === "local_test_grant")) {
    return true
  }

  const parts = token.split(":")
  if (parts.length !== 2) return false

  const [expRaw, sig] = parts
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp <= Date.now()) return false

  const key = getGrantSigningKey()
  const expectedSig = hmacSha256Hex(key, `${grantSubject(ip, userAgent)}:${exp}`).slice(0, 32)
  return timingSafeEqualHex(sig, expectedSig)
}
