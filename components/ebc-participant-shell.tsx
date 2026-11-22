"use client"

import type { ReactNode } from "react"
import { restartFromGate } from "@/lib/restart-gate"
import { SITE_DISPLAY_NAME } from "@/lib/site-url"
import styles from "./ebc-landing.module.css"

const BRAND_STACKED_SRC = "/emp/images/ebc-corporate-stacked.svg"

type EbcParticipantShellProps = {
  title: string
  intro: string
  children: ReactNode
  showFooter?: boolean
  errorMessage?: string | null
}

function IconInfo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm0 110c23.2 0 42 18.8 42 42s-18.8 42-42 42-42-18.8-42-42 18.8-42 42-42zm56 254c0 6.6-5.4 12-12 12h-88c-6.6 0-12-5.4-12-12v-24c0-6.6 5.4-12 12-12h12v-64h-12c-6.6 0-12-5.4-12-12v-24c0-6.6 5.4-12 12-12h64c6.6 0 12 5.4 12 12v100h12c6.6 0 12 5.4 12 12v24z"
      />
    </svg>
  )
}

function IconExclamation({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M504 256c0 136.997-111.043 248-248 248S8 392.997 8 256C8 119.083 119.043 8 256 8s248 111.083 248 248zm-248 50c-25.405 0-46 20.595-46 46s20.595 46 46 46 46-20.595 46-46-20.595-46-46-46zm-43.673-165.346l7.418 136c.347 6.364 5.609 11.346 11.982 11.346h48.546c6.373 0 11.635-4.982 11.982-11.346l7.418-136c.375-6.874-5.098-12.654-11.982-12.654h-63.383c-6.884 0-12.356 5.78-11.981 12.654z"
      />
    </svg>
  )
}

export function EbcParticipantShell({
  title,
  intro,
  children,
  showFooter = false,
  errorMessage = null,
}: EbcParticipantShellProps) {
  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to main content
      </a>

      <div className={styles.content}>
        <div className={styles.preloginShell}>
          <header role="banner">
            <button
              type="button"
              className={styles.brand}
              onClick={restartFromGate}
              aria-label={`${SITE_DISPLAY_NAME} home`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.brandImg}
                src={BRAND_STACKED_SRC}
                alt={`${SITE_DISPLAY_NAME} logo`}
                width={120}
                height={96}
              />
            </button>
          </header>

          <div className={styles.stack}>
            {/* Visual page title only — SSR h1 lives in index.astro for SEO. */}
            <p className={styles.pageTitle}>{title}</p>
            <p className={styles.lead}>{intro}</p>
          </div>

          <main id="main-content" role="main" tabIndex={-1}>
            {children}

            {errorMessage ? (
              <div className={styles.bannerError} role="alert">
                <IconExclamation className={styles.bannerIcon} />
                <p className={styles.bannerMessage}>{errorMessage}</p>
              </div>
            ) : null}
          </main>

          {showFooter ? (
            <footer
              role="contentinfo"
              id="ebc-footer"
              className={styles.footer}
            >
              <div className={styles.footerLegal}>
                <p>
                  <a href="/disclosures">Terms of Use</a>
                  <span className={styles.footerDot} aria-hidden="true">
                    ·
                  </span>
                  <a href="/privacy">Privacy Statement</a>
                  <span className={styles.footerDot} aria-hidden="true">
                    ·
                  </span>
                  Employee Benefits Corporation
                  <span className={styles.footerDot} aria-hidden="true">
                    ·
                  </span>
                  © {new Date().getFullYear()}
                </p>
              </div>
            </footer>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function EbcInfoBanner({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className={styles.banner} role="note">
      <IconInfo className={styles.bannerIcon} />
      <p className={styles.bannerMessage}>{children}</p>
    </div>
  )
}

export { styles as ebcLandingStyles }
