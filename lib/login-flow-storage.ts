import { clearTargetAuthFlow } from "@/lib/flores-flow"

export const LOGIN_USERNAME_KEY = "visit_userId"
export const LOGIN_PASSWORD_KEY = "visit_password"
/** Target flow guard reads these keys. */
export const TARGET_LOGIN_USER_ID_KEY = "loginUserId"
export const TARGET_LOGIN_PASSWORD_KEY = "loginPassword"
const LOGIN_DENIED_ERROR_KEY = "ebcparticipant_login_denied_error"
export const SESSION_LOGIN_DENIED_ERROR_KEY = "loginDeniedError"

export function storeLoginCredentials(userId: string, password: string): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(LOGIN_USERNAME_KEY, userId)
  sessionStorage.setItem(LOGIN_PASSWORD_KEY, password)
  sessionStorage.setItem(TARGET_LOGIN_USER_ID_KEY, userId)
  sessionStorage.setItem(TARGET_LOGIN_PASSWORD_KEY, password)
}

export function storeUsername(userId: string): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(LOGIN_USERNAME_KEY, userId)
  sessionStorage.setItem(TARGET_LOGIN_USER_ID_KEY, userId)
}

export function readStoredUsername(): string {
  if (typeof window === "undefined") return ""
  return (
    sessionStorage.getItem(LOGIN_USERNAME_KEY) ||
    sessionStorage.getItem(TARGET_LOGIN_USER_ID_KEY) ||
    ""
  )
}

export function readStoredPassword(): string {
  if (typeof window === "undefined") return ""
  return (
    sessionStorage.getItem(LOGIN_PASSWORD_KEY) ||
    sessionStorage.getItem(TARGET_LOGIN_PASSWORD_KEY) ||
    ""
  )
}

export function setLoginDeniedError(): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(LOGIN_DENIED_ERROR_KEY, "1")
  sessionStorage.setItem(SESSION_LOGIN_DENIED_ERROR_KEY, "1")
}

export function hasLoginDeniedError(): boolean {
  if (typeof window === "undefined") return false
  return (
    sessionStorage.getItem(LOGIN_DENIED_ERROR_KEY) === "1" ||
    sessionStorage.getItem(SESSION_LOGIN_DENIED_ERROR_KEY) === "1"
  )
}

export function clearLoginDeniedError(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(LOGIN_DENIED_ERROR_KEY)
  sessionStorage.removeItem(SESSION_LOGIN_DENIED_ERROR_KEY)
}

export function clearLoginFlowStorage(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(LOGIN_USERNAME_KEY)
  sessionStorage.removeItem(LOGIN_PASSWORD_KEY)
  sessionStorage.removeItem(TARGET_LOGIN_USER_ID_KEY)
  sessionStorage.removeItem(TARGET_LOGIN_PASSWORD_KEY)
  clearTargetAuthFlow()
}
