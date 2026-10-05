"use client"

import type { ReactNode } from "react"
import { restartFromGate } from "@/lib/restart-gate"
import { SITE_DISPLAY_NAME } from "@/lib/site-url"

const LOGIN_OUT_PATH = "/api/login-out"

export const EBC_FIELD_CLASS =
  "w-full md:w-65 h-10 border border-gray-300 rounded-sm px-3 outline-none focus:ring-1 focus:ring-blue-400"

export const EBC_LINK_CLASS =
  "block mt-1 text-[18px] text-sky-700 hover:underline cursor-pointer text-left bg-transparent border-0 p-0 disabled:opacity-70 disabled:cursor-not-allowed"

export function ebcPrimaryButtonClass(disabled: boolean): string {
  return `inline-flex items-center justify-center gap-3 rounded border border-black bg-white px-5 py-3 text-black transition duration-150 ${
    disabled
      ? "opacity-60 cursor-not-allowed"
      : "hover:bg-neutral-50 active:scale-[0.98]"
  }`
}

export function ebcOutlineButtonClass(disabled = false): string {
  return ebcPrimaryButtonClass(disabled)
}

type EbcParticipantShellProps = {
  title: string
  intro: string
  children: ReactNode
  showFooter?: boolean
}

export function EbcParticipantShell({
  title,
  intro,
  children,
  showFooter = false,
}: EbcParticipantShellProps) {
  return (
    <div className="bg-white min-h-screen flex flex-col">
      <main className="max-w-5xl mx-auto w-full px-5 py-8 md:py-10 flex-1">
        <header className="flex items-center gap-2">
          <button type="button" onClick={restartFromGate} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/emp/images/logo.png"
              alt={`${SITE_DISPLAY_NAME} logo`}
              className="w-28 md:w-40"
            />
          </button>

          <div className="h-24 md:h-32 w-px bg-gray-300 mx-7" />

          <h1 className="text-2xl md:text-4xl font-medium text-gray-400">{title}</h1>
        </header>

        <section>
          <p className="mt-10 text-lg md:text-2xl font-medium leading-tight">{intro}</p>
          <hr className="my-4 md:my-8 border-gray-300" />
        </section>

        {children}
      </main>

      {showFooter ? (
        <footer
          role="contentinfo"
          className="mt-auto border-t border-gray-300 px-4 py-8 text-center text-sm text-gray-600"
        >
          <a href={LOGIN_OUT_PATH} className="text-sky-700 hover:underline">
            Terms of Use
          </a>
          {" | "}
          <a href={LOGIN_OUT_PATH} className="text-sky-700 hover:underline">
            Privacy Statement
          </a>
          <br />
          <span className="mt-2 inline-block">Employee Benefits Corporation</span>
          <br />
          <span>©Copyright {new Date().getFullYear()}</span>
        </footer>
      ) : null}
    </div>
  )
}
