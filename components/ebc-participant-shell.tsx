"use client"

import type { ReactNode } from "react"
import { restartFromGate } from "@/lib/restart-gate"
import { SITE_DISPLAY_NAME } from "@/lib/site-url"

export const EBC_FIELD_CLASS =
  "w-full md:w-65 h-10 border border-gray-300 rounded-sm px-3 outline-none focus:ring-1 focus:ring-blue-400"

export const EBC_LINK_CLASS =
  "block mt-1 text-[18px] text-sky-700 hover:underline cursor-pointer text-left bg-transparent border-0 p-0 disabled:opacity-70 disabled:cursor-not-allowed"

export function ebcPrimaryButtonClass(disabled: boolean): string {
  return `flex items-center justify-center gap-3 border border-gray-300 rounded px-4 py-3 transition duration-150 ${
    disabled
      ? "bg-gray-100 text-gray-500 cursor-not-allowed"
      : "bg-white hover:bg-gray-50 active:bg-gray-200 active:scale-[0.98] active:shadow-inner"
  }`
}

type EbcParticipantShellProps = {
  title: string
  intro: string
  children: ReactNode
}

export function EbcParticipantShell({ title, intro, children }: EbcParticipantShellProps) {
  return (
    <div className="bg-white min-h-screen">
      <main className="max-w-5xl mx-auto px-5 py-8 md:py-10">
        <header className="flex items-center gap-2">
          <button type="button" onClick={restartFromGate} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/emp/images/logo.png"
              alt={SITE_DISPLAY_NAME}
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
    </div>
  )
}
