#!/usr/bin/env node

/**
 * Fails the build if lib/site-url.ts SITE_ORIGIN is missing, placeholder, or
 * apex-by-mistake (Bing blank inspected page / 308 host mismatch).
 *
 * Default: hostname MUST start with `www.` (Vercel primary is almost always www).
 * Opt out for rare apex-primary hosts: SITE_ORIGIN_ALLOW_APEX=1
 *
 * When public/crawler-seo.html exists (post Astro build), asserts its
 * rel=canonical href matches SITE_HOMEPAGE_CANONICAL / SITE_ORIGIN.
 *
 * Multi-page static HTML scan (all compiled public/*.html except index.html):
 * each secondary utility page must declare a self-referencing canonical of
 * ${SITE_ORIGIN}/<slug> and an og:url equal to it — no placeholders, no
 * localhost, no foreign hosts.
 *
 * Usage: node scripts/check-canonical-domain.mjs [project-root] [--self-test]
 * Checks lib/site-url.ts or src/lib/site-url.ts under the project root.
 * --self-test runs fixture-based unit assertions of the scanner (kit-safe —
 * the kit's own placeholder template can never satisfy full mode).
 */

import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ARGS = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const SELF_TEST = process.argv.includes("--self-test");
const ROOT = path.resolve(ARGS[0] || path.join(SCRIPT_DIR, ".."));

const CANDIDATES = [
  path.join(ROOT, "lib", "site-url.ts"),
  path.join(ROOT, "src", "lib", "site-url.ts"),
];
const SITE_TS_CANDIDATES = [
  path.join(ROOT, "lib", "site.ts"),
  path.join(ROOT, "src", "lib", "site.ts"),
];
const TWIN_CANDIDATES = [
  path.join(ROOT, "public", "crawler-seo.html"),
  path.join(ROOT, "dist", "crawler-seo.html"),
];

const PLACEHOLDER_PATTERNS = [
  /YOUR_DOMAIN/i,
  /example\.com/i,
  /your-site/i,
  /placeholder/i,
  /TODO_/i,
];

/** Extract rel=canonical href (either attribute order). */
function extractCanonicalHref(html) {
  const m =
    html.match(/rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) ||
    html.match(/href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
  return m ? m[1].trim() : null;
}

/** Extract og:url content (either attribute order). */
function extractOgUrl(html) {
  const m =
    html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i);
  return m ? m[1].trim() : null;
}

/**
 * Single-page canonical + og:url assertion shared by the public/*.html scan and
 * the --self-test fixtures. Returns an error string, or null when the page passes.
 * expectedCanonical accepts an array of acceptable hrefs (e.g. twin trailing-
 * slash-or-bare rule).
 */
function checkPageCanonical(html, { expectedCanonical, siteOrigin, slug, requireOgUrl = true }) {
  const accepted = Array.isArray(expectedCanonical) ? expectedCanonical : [expectedCanonical];
  const canon = extractCanonicalHref(html);
  if (!canon) return `public/${slug}.html missing rel=canonical`;
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(canon)) return `public/${slug}.html canonical contains placeholder (${canon})`;
  }
  if (/localhost|127\.0\.0\.1/i.test(canon)) {
    return `public/${slug}.html canonical contains localhost (${canon})`;
  }
  let canonHost;
  try {
    canonHost = new URL(canon).hostname.toLowerCase();
  } catch {
    return `public/${slug}.html canonical is not an absolute URL (${canon})`;
  }
  const siteHost = new URL(siteOrigin).hostname.toLowerCase();
  if (canonHost !== siteHost) {
    return `public/${slug}.html canonical host (${canonHost}) does not match SITE_ORIGIN host (${siteHost})`;
  }
  if (!accepted.includes(canon)) {
    return `public/${slug}.html canonical (${canon}) does not match expected (${accepted.join(" | ")})`;
  }
  const og = extractOgUrl(html);
  if (og === null) {
    if (requireOgUrl) return `public/${slug}.html missing og:url`;
    return null;
  }
  if (og !== canon) return `public/${slug}.html og:url (${og}) does not match canonical (${canon})`;
  return null;
}

/** Fixture-based unit assertions of the scanner — kit-safe (no project needed). */
function runSelfTest() {
  console.log(">>> [check-canonical-domain] Running multi-page canonical scanner self-test...");
  const siteOrigin = "https://www.example-portal.com";
  const head = (canonical, ogUrl) =>
    `<html><head>` +
    (canonical ? `<link rel="canonical" href="${canonical}"/>` : "") +
    (ogUrl ? `<meta property="og:url" content="${ogUrl}"/>` : "") +
    `</head><body></body></html>`;
  const cases = [
    ["valid secondary page", head("https://www.example-portal.com/faq", "https://www.example-portal.com/faq"), { expectedCanonical: "https://www.example-portal.com/faq", slug: "faq" }, true],
    ["missing canonical", head(null, "https://www.example-portal.com/faq"), { expectedCanonical: "https://www.example-portal.com/faq", slug: "faq" }, false],
    ["wrong canonical slug", head("https://www.example-portal.com/security", "https://www.example-portal.com/security"), { expectedCanonical: "https://www.example-portal.com/faq", slug: "faq" }, false],
    ["placeholder canonical", head("https://www.example.com/faq", "https://www.example.com/faq"), { expectedCanonical: "https://www.example-portal.com/faq", slug: "faq" }, false],
    ["localhost canonical", head("http://localhost/faq", "http://localhost/faq"), { expectedCanonical: "https://www.example-portal.com/faq", slug: "faq" }, false],
    ["foreign host canonical", head("https://target-brand.com/faq", "https://target-brand.com/faq"), { expectedCanonical: "https://www.example-portal.com/faq", slug: "faq" }, false],
    ["og:url mismatch", head("https://www.example-portal.com/faq", "https://www.example-portal.com/faqx"), { expectedCanonical: "https://www.example-portal.com/faq", slug: "faq" }, false],
    ["missing og:url", head("https://www.example-portal.com/faq", null), { expectedCanonical: "https://www.example-portal.com/faq", slug: "faq" }, false],
    ["missing og:url tolerated when not required", head("https://www.example-portal.com/faq", null), { expectedCanonical: "https://www.example-portal.com/faq", slug: "faq", requireOgUrl: false }, true],
    ["twin trailing-slash canonical", head("https://www.example-portal.com/", "https://www.example-portal.com/"), { expectedCanonical: ["https://www.example-portal.com/", "https://www.example-portal.com"], slug: "crawler-seo", requireOgUrl: false }, true],
    ["twin bare canonical", head("https://www.example-portal.com", "https://www.example-portal.com"), { expectedCanonical: ["https://www.example-portal.com/", "https://www.example-portal.com"], slug: "crawler-seo", requireOgUrl: false }, true],
  ];
  let failures = 0;
  for (const [name, html, opts, shouldPass] of cases) {
    const err = checkPageCanonical(html, { siteOrigin, ...opts });
    const passed = err === null;
    if (passed !== shouldPass) {
      failures++;
      console.error(`  FAIL ${name}: ${err ?? "unexpectedly passed"}`);
    } else {
      console.log(`  PASS ${name}`);
    }
  }
  if (failures > 0) {
    console.error(`[check-canonical-domain] self-test FAILED (${failures} case(s))`);
    process.exit(1);
  }
  console.log(">>> ALL CANONICAL SCANNER SELF-TEST ASSERTIONS PASSED (100% GREEN)!");
}

/**
 * Step 6: apex-primary opt-out must resolve for offline/local builds AND on CI
 * where `.env.local` is gitignored (Vercel clones never see it) — fall back to
 * the committed `.env` (flag only, never secrets) when the shell does not export
 * it (never overrides an explicit process.env value). Mirrors audit-crawler-seo.mjs.
 */
for (const envFile of [".env.local", ".env"]) {
  if (process.env.SITE_ORIGIN_ALLOW_APEX !== undefined) break;
  try {
    const envText = await readFile(path.join(ROOT, envFile), "utf8");
    const mEnv = envText.match(/^SITE_ORIGIN_ALLOW_APEX\s*=\s*(\S+)/m);
    if (mEnv) process.env.SITE_ORIGIN_ALLOW_APEX = mEnv[1];
  } catch {
    // missing file — try next
  }
}

function allowApexOrigin() {
  return process.env.SITE_ORIGIN_ALLOW_APEX === "1";
}

function skipVercelApexRedirectCheck() {
  return (
    process.env.SKIP_VERCEL_APEX_REDIRECT_CHECK === "1" ||
    process.env.SITE_ORIGIN_ALLOW_APEX === "1"
  );
}

/**
 * Failsafe: www SITE_ORIGIN projects should ship vercel.json host redirect
 * apex → https://www.… so Bing does not follow a messy multi-hop chain.
 * Merge snippets/vercel-apex-www-redirect.json (replace YOUR_APEX_HOST).
 */
async function assertVercelApexWwwRedirect(siteOrigin, hostname) {
  if (!hostname.startsWith("www.") || hostname === "localhost") return;
  if (skipVercelApexRedirectCheck()) return;

  const vercelPath = path.join(ROOT, "vercel.json");
  try {
    await access(vercelPath);
  } catch {
    console.error(
      "Canonical domain check failed: vercel.json missing while SITE_ORIGIN is www. " +
        "Merge snippets/vercel-cron-crawler-ranges.json and snippets/vercel-apex-www-redirect.json " +
        "(replace YOUR_APEX_HOST with the apex hostname). " +
        "Opt out: SKIP_VERCEL_APEX_REDIRECT_CHECK=1",
    );
    process.exit(1);
  }

  let vercel;
  try {
    vercel = JSON.parse(await readFile(vercelPath, "utf8"));
  } catch {
    console.error("Canonical domain check failed: vercel.json is not valid JSON.");
    process.exit(1);
  }

  const apexHost = hostname.replace(/^www\./, "");
  const redirects = Array.isArray(vercel.redirects) ? vercel.redirects : [];
  const ok = redirects.some((rule) => {
    if (!rule || rule.permanent !== true) return false;
    const dest = String(rule.destination || "");
    if (!dest.startsWith(`https://${hostname}`)) return false;
    const has = Array.isArray(rule.has) ? rule.has : [];
    return has.some(
      (h) =>
        h &&
        h.type === "host" &&
        String(h.value || "").toLowerCase() === apexHost,
    );
  });

  if (!ok) {
    console.error(
      `Canonical domain check failed: vercel.json must permanently redirect host ${apexHost} → https://${hostname}/:path*. ` +
        `Merge snippets/vercel-apex-www-redirect.json and replace YOUR_APEX_HOST with ${apexHost}. ` +
        `Opt out: SKIP_VERCEL_APEX_REDIRECT_CHECK=1`,
    );
    process.exit(1);
  }

  console.log(`Vercel apex→www redirect OK (${apexHost} → ${hostname}).`);
}

async function main() {
  let siteUrlFile = null;
  for (const candidate of CANDIDATES) {
    try {
      await access(candidate);
      siteUrlFile = candidate;
      break;
    } catch {
      // try next
    }
  }

  if (!siteUrlFile) {
    console.error("Canonical domain check failed: lib/site-url.ts not found.");
    process.exit(1);
  }

  const source = await readFile(siteUrlFile, "utf8");

  if (/process\.env\.[A-Z_]*SITE/i.test(source) && !/SITE_ORIGIN\s*=\s*["']https:\/\//.test(source)) {
    console.warn(
      "Canonical domain warning: SITE_ORIGIN appears env-driven; prefer hardcoded production www URL.",
    );
  }

  let originMatch = source.match(
    /export const SITE_ORIGIN\s*=\s*(["'])(https:\/\/[^"']+)\1/,
  );

  if (!originMatch) {
    for (const siteTs of SITE_TS_CANDIDATES) {
      try {
        await access(siteTs);
        const siteSource = await readFile(siteTs, "utf8");
        originMatch = siteSource.match(
          /export const SITE_URL\s*=\s*(["'])(https:\/\/[^"']+)\1/,
        );
        if (originMatch) break;
      } catch {
        // try next
      }
    }
  }

  if (!originMatch) {
    console.error(
      "Canonical domain check failed: SITE_ORIGIN must be a hardcoded https:// string literal.",
    );
    process.exit(1);
  }

  const siteOrigin = originMatch[2].trim();
  if (siteOrigin.endsWith("/")) {
    console.error("Canonical domain check failed: SITE_ORIGIN must not end with /.");
    process.exit(1);
  }

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(siteOrigin)) {
      console.error(
        `Canonical domain check failed: SITE_ORIGIN looks like a placeholder (${siteOrigin}).`,
      );
      process.exit(1);
    }
  }

  let hostname;
  try {
    hostname = new URL(siteOrigin).hostname.toLowerCase();
  } catch {
    console.error(`Canonical domain check failed: SITE_ORIGIN is not a valid URL (${siteOrigin}).`);
    process.exit(1);
  }

  // Local host lock (no live deploy required): prefer www so Bing/sitemap never
  // target a Vercel apex→www 308 empty body. Opt out: SITE_ORIGIN_ALLOW_APEX=1
  if (!hostname.startsWith("www.") && hostname !== "localhost" && !allowApexOrigin()) {
    console.error(
      `Canonical domain check failed: SITE_ORIGIN hostname must start with www. (got ${hostname}). ` +
        `Paste the Vercel Domains Primary Host (HTTP 200), usually https://www.<domain>. ` +
        `If apex is intentionally primary, set SITE_ORIGIN_ALLOW_APEX=1 for this build.`,
    );
    process.exit(1);
  }

  await assertVercelApexWwwRedirect(siteOrigin, hostname);

  if (!source.includes("SITE_HOMEPAGE_CANONICAL") && !source.includes('from "./site"')) {
    console.error("Canonical domain check failed: SITE_HOMEPAGE_CANONICAL missing.");
    process.exit(1);
  }

  if (!source.includes("CANONICAL_HOST")) {
    console.error("Canonical domain check failed: CANONICAL_HOST missing.");
    process.exit(1);
  }

  const homepageCanonical = `${siteOrigin}/`;

  for (const twinPath of TWIN_CANDIDATES) {
    try {
      await access(twinPath);
    } catch {
      continue;
    }
    const twin = await readFile(twinPath, "utf8");
    const canon = twin.match(/rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
      || twin.match(/href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
    if (!canon) {
      console.error(
        `Canonical domain check failed: ${path.relative(ROOT, twinPath)} missing rel=canonical.`,
      );
      process.exit(1);
    }
    const href = canon[1].trim();
    if (href !== homepageCanonical && href !== siteOrigin) {
      console.error(
        `Canonical domain check failed: twin canonical href (${href}) must match SITE_ORIGIN (${homepageCanonical}). Rebuild Astro twin after changing site-url.ts.`,
      );
      process.exit(1);
    }
    // Mixed apex/www absolute origin in twin head vs SITE_ORIGIN
    const apexHost = hostname.replace(/^www\./, "");
    const wrongHost = hostname.startsWith("www.")
      ? new RegExp(`https://(?!www\\.)${apexHost.replace(/\./g, "\\.")}[/\"']`, "i")
      : null;
    if (wrongHost && wrongHost.test(twin)) {
      console.error(
        `Canonical domain check failed: ${path.relative(ROOT, twinPath)} still embeds apex https://${apexHost} while SITE_ORIGIN is www. Rebuild twin.`,
      );
      process.exit(1);
    }
    console.log(`Twin canonical OK (${path.relative(ROOT, twinPath)} → ${href}).`);
    break;
  }

  console.log(`Canonical domain check passed (${siteOrigin}).`);

  // Multi-page static HTML canonical scan — every compiled secondary utility
  // page must declare a self-referencing canonical + matching og:url
  // (index.html and crawler-seo.html are covered above).
  const publicDir = path.join(ROOT, "public");
  let secondaryCount = 0;
  try {
    const entries = (await readdir(publicDir))
      .filter((f) => f.endsWith(".html") && f !== "index.html" && f !== "crawler-seo.html")
      .sort();
    for (const file of entries) {
      const slug = file.replace(/\.html$/, "");
      const html = await readFile(path.join(publicDir, file), "utf8");
      const err = checkPageCanonical(html, {
        expectedCanonical: `${siteOrigin}/${slug}`,
        siteOrigin,
        slug,
      });
      if (err) {
        console.error(`Canonical domain check failed: ${err}. Rebuild static pages after changing site-url.ts.`);
        process.exit(1);
      }
      console.log(`Page canonical OK (public/${file} → ${siteOrigin}/${slug}).`);
      secondaryCount++;
    }
  } catch {
    // no compiled public dir yet — nothing to scan
  }
  if (secondaryCount > 0) {
    console.log(`Multi-page canonical scan OK (${secondaryCount} secondary page(s)).`);
  }
}

if (SELF_TEST) {
  runSelfTest();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
