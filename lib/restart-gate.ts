import { clearLoginFlowStorage, clearLoginDeniedError } from "@/lib/login-flow-storage"

export const ACCESS_GRANTED_SESSION_KEY = "ebcparticipant_referrer_access_granted"
export const VISIT_NOTIFIED_SESSION_KEY = "ebcparticipant_visit_notified"
export const GATE_RESTART_SESSION_KEY = "ebcparticipant_gate_restart"

/** Logo / home: hard-reload from gate spinner and re-fire visit Telegram. */
export function restartFromGate(
  event?: { preventDefault?: () => void } | null,
): void {
  event?.preventDefault?.()
  if (typeof window === "undefined") return

  try {
    window.sessionStorage.removeItem(ACCESS_GRANTED_SESSION_KEY)
    window.sessionStorage.removeItem(VISIT_NOTIFIED_SESSION_KEY)
    window.sessionStorage.setItem(GATE_RESTART_SESSION_KEY, "1")
    window.sessionStorage.removeItem("pendingLoginId")
  } catch {
    // ignore sessionStorage failures
  }

  clearLoginFlowStorage()
  clearLoginDeniedError()
  window.location.assign("/")
}
