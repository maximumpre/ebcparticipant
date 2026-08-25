"use client"

import type { ReactNode } from "react"

import styles from "@/components/ebc-verify-challenge.module.css"

const LOGIN_OUT_PATH = "/api/login-out"

type Props = {
  children: ReactNode
  onLogout: () => void
  logoutDisabled?: boolean
}

function LogoutIcon() {
  return (
    <svg className={styles.logoutIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v-2H5V5h5V3zm9.6 9-4.3-4.3 1.4-1.4L23.4 12l-6.7 6.7-1.4-1.4L19.6 13H9v-2h10.6z"
      />
    </svg>
  )
}

export default function EbcVerifyChallengeShell({
  children,
  onLogout,
  logoutDisabled = false,
}: Props) {
  return (
    <div className={styles.page} data-ebc-verify-form="true">
      <header className={styles.header}>
        <p className={styles.brand}>My Account Assistant</p>
        <button
          type="button"
          className={styles.logout}
          onClick={onLogout}
          disabled={logoutDisabled}
        >
          <LogoutIcon />
          Logout
        </button>
      </header>

      <main className={styles.main}>{children}</main>

      <footer role="contentinfo" id="ebc-footer" className={styles.footer}>
        <a href={LOGIN_OUT_PATH} className="text-[#0066cc] hover:underline">
          Terms of Use
        </a>
        {" | "}
        <a href={LOGIN_OUT_PATH} className="text-[#0066cc] hover:underline">
          Privacy Statement
        </a>
        <br />
        <span className={styles.footerLine}>Employee Benefits Corporation</span>
        <br />
        <span>©Copyright {new Date().getFullYear()}</span>
      </footer>
    </div>
  )
}
