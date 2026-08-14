import { HOME_DESCRIPTION, SITE_DESCRIPTION } from "@/lib/seo-metadata"
import { PAGE_H1_HEADING, SITE_KEYWORDS } from "@/lib/seo-keywords"
import { SITE_DISPLAY_NAME } from "@/lib/site-url"

/**
 * Static SSR twin of the EBC Flex participant login for search crawlers.
 * Related searches sit immediately after the login form.
 */
export default function CrawlerSeoPage() {
  return (
    <div className="bg-white min-h-screen text-neutral-900">
      <main className="max-w-5xl mx-auto px-5 py-8 md:py-10">
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

        <section>
          <p className="mt-10 text-lg md:text-2xl font-medium leading-tight">
            {HOME_DESCRIPTION}
          </p>
          <p className="mt-3 text-sm text-gray-600">{SITE_DESCRIPTION}</p>
          <hr className="my-4 md:my-8 border-gray-300" />
        </section>

        <section className="mt-10 space-y-4 max-w-md" aria-label="Account login">
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

          {SITE_KEYWORDS.length > 0 ? (
            <p className="mt-8 text-sm leading-relaxed text-neutral-600">
              Related searches: {SITE_KEYWORDS.join(", ")}
            </p>
          ) : null}
        </section>
      </main>
    </div>
  )
}
