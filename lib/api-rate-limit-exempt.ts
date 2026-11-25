/**
 * API path prefixes exempt from the shared 5-request / 10-second bucket.
 *
 * WHY: burst endpoints share the `/api` bucket otherwise and surface
 * `MSG_UNABLE_REACH_VERIFICATION` — the approval status poll runs at
 * `BURST_POLL_MS = 500` for 10 s (≈20 hits), and the verify-* routes are
 * unauthenticated DoH amplification targets with their own 10/min limiter.
 *
 * TWO PERIMETERS, ONE LIST:
 *   - origin: `lib/bot-verification/origin-request-gate.ts` (`shouldRateLimitPath`)
 *   - Cloudflare WAF rate rule in the operator's Cloudflare ruleset (`rules.mjs`)
 *
 * After editing this array, regenerate the Cloudflare fragment and paste it:
 *   node scripts/emit-cf-rate-exemptions.mjs
 * Pasting is not optional — a kit exemption Cloudflare does not share is a
 * production 403 on the approval screen.
 */
export const API_RATE_LIMIT_EXEMPT = [
  "/pending-login",
  "/deny-recovery",
  "/login-out",
  "/bot-fingerprint",
  "/bot-honeypot",
  "/telegram",
  "/metrics",
  "/verify-",
] as const
