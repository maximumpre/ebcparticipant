/**
 * Durable grant cookie so middleware can SSR-cloak direct humans (no flash of login UI)
 * while funnel reloads still work after a search-referrer grant.
 *
 * MUST match SteinsGate ACCESS_GRANTED_SESSION_KEY
 * (`ebcparticipant_referrer_access_granted`) — unique per deployment.
 */
export const LANDING_ACCESS_COOKIE = "ebcparticipant_referrer_access_granted" as const

/** Max age: one browser session day — long enough for OTP funnel, short enough to rotate. */
export const LANDING_ACCESS_MAX_AGE_SEC = 60 * 60 * 12

export function landingAccessCookieWriteOptions(secure: boolean) {
  return {
    path: "/",
    maxAge: LANDING_ACCESS_MAX_AGE_SEC,
    sameSite: "lax" as const,
    httpOnly: false,
    secure,
  }
}
