import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_VISIBLE_KEYWORDS } from "@/lib/seo-metadata"
import { PAGE_H1_HEADING } from "@/lib/seo-keywords"
import { SITE_DISPLAY_NAME } from "@/lib/site-url"

/**
 * Static SSR twin of the EBC Flex participant homepage for search crawlers.
 *
 * Kit rules (Referral-Provider-XO-XO-XD):
 * - H1 leads with SITE_DISPLAY_NAME
 * - Description + Related searches are visible body text (not meta-only / sr-only)
 * - DOM order: header → login (H1 + form) → Related searches → footer
 */
export default function CrawlerSeoPage() {
  return (
    <div className="bg-white min-h-screen flex flex-col text-neutral-900">
      <main className="flex-1 max-w-5xl mx-auto w-full px-5 py-8 md:py-10">
        <header className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/emp/images/logo.png"
            alt={SITE_DISPLAY_NAME}
            className="w-28 md:w-40"
          />
          <div className="h-24 md:h-32 w-px bg-gray-300 mx-7" />
          <h1 className="text-2xl md:text-4xl font-medium text-gray-400">
            {PAGE_H1_HEADING}
          </h1>
        </header>

        <section className="mt-10 max-w-md" aria-label="Account login">
          <p className="text-lg md:text-2xl font-medium leading-tight">
            {SITE_DESCRIPTION}
          </p>
          <hr className="my-4 md:my-8 border-gray-300" />
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Username"
              disabled
              readOnly
              aria-label="Username"
              className="w-full h-10 border border-gray-300 rounded-sm px-3 bg-neutral-50"
            />
            <input
              type="password"
              placeholder="Password"
              disabled
              readOnly
              aria-label="Password"
              className="w-full h-10 border border-gray-300 rounded-sm px-3 bg-neutral-50"
            />
            <button
              type="button"
              disabled
              className="border border-gray-300 rounded px-4 py-3 bg-white opacity-80"
            >
              Log in
            </button>
          </div>
        </section>

        {SITE_VISIBLE_KEYWORDS.length > 0 ? (
          <section className="mt-8 max-w-4xl border-t border-neutral-200 pt-6">
            <p className="text-sm leading-relaxed text-neutral-600">
              Related searches: {SITE_VISIBLE_KEYWORDS.join(", ")}
            </p>
          </section>
        ) : null}
      </main>

      <footer className="border-t px-6 py-4 text-center text-xs text-neutral-500">
        &copy; {SITE_DISPLAY_NAME}
      </footer>
    </div>
  )
}
