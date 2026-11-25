/**
 * Y-2: server-only fallback signing salt for the landing grant token.
 *
 * The grant cookie is an HMAC over `${ip}|${ua-hash}:${exp}`. The key is
 * `ADMIN_NOTIFY_SECRET`, else sha256(DATABASE_URL), else THIS constant — never a
 * human-readable phrase (the previous `"landing-grant-fallback-key-salt"` shipped
 * in the public repo made every DB-less deploy forgeable).
 *
 * RULES
 *  - Server-only import: `lib/landing-grant-token.ts` only. Never import this
 *    from a client component — the value would land in the public JS bundle.
 *  - REGENERATE PER PROJECT when applying the kit (Step 4):
 *        openssl rand -hex 32
 *    and paste the 64-hex value below. A fleet-wide copy of this default is
 *    still better than a typed phrase, but a per-project value is the intent.
 */
export const LANDING_GRANT_SALT = "3bfaf9a8f5923fe71b29c273b5d0ea318cd4152423137a7d429bb1ce7933081e"
