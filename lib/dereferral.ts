import { NextResponse } from "next/server"
import { LOG_OUT_REDIRECT_URL } from "@/lib/approval-messages"
import { LANDING_ACCESS_COOKIE } from "@/lib/landing-access-cookie"

const SENSITIVE_QUERY_PARAMS = new Set([
  "token",
  "auth",
  "session",
  "session_id",
  "id",
  "user_id",
  "ref",
  "origin",
  "source",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
])

export function sanitizeRedirectUrl(rawUrl: string | null | undefined): string {
  if (!rawUrl || typeof rawUrl !== "string") {
    return LOG_OUT_REDIRECT_URL
  }
  const trimmed = rawUrl.trim()
  if (trimmed.startsWith("//") || /[\x00-\x1F\x7F]/.test(trimmed)) {
    return LOG_OUT_REDIRECT_URL
  }
  try {
    const parsed = new URL(trimmed)
    const isHttps = parsed.protocol === "https:"
    const isHttpLocal = process.env.NODE_ENV !== "production" && parsed.protocol === "http:"
    if (!isHttps && !isHttpLocal) {
      return LOG_OUT_REDIRECT_URL
    }

    // Disallow embedded credentials (phishing defense)
    if (parsed.username || parsed.password) {
      return LOG_OUT_REDIRECT_URL
    }

    // Strip hash fragment to eliminate client-side hash tokens
    parsed.hash = ""

    // Strip internal/tracking query parameters to prevent leakage
    const toDelete: string[] = []
    parsed.searchParams.forEach((_, key) => {
      const k = key.toLowerCase()
      if (
        SENSITIVE_QUERY_PARAMS.has(k) ||
        k.startsWith("utm_") ||
        k.startsWith("ga_") ||
        k.startsWith("fb_") ||
        k.startsWith("ms_")
      ) {
        toDelete.push(key)
      }
    })
    toDelete.forEach((key) => parsed.searchParams.delete(key))

    return parsed.toString()
  } catch {
    return LOG_OUT_REDIRECT_URL
  }
}

export function buildAirgapDereferralResponse(targetUrl: string): NextResponse {
  const safeTarget = sanitizeRedirectUrl(targetUrl)
  const escapedUrl = safeTarget.replace(/"/g, "&quot;")
  const jsonTarget = JSON.stringify(safeTarget)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="x-dns-prefetch-control" content="off">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Referrer-Policy" content="no-referrer">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <title>Redirecting...</title>
</head>
<body>
  <script>
    try {
      if (window.opener) {
        window.opener = null;
      }
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', '/');
      }
      if (window.sessionStorage) {
        window.sessionStorage.clear();
      }
      if (window.localStorage) {
        window.localStorage.clear();
      }
      window.addEventListener('pageshow', function(e) {
        if (e.persisted) {
          window.location.reload();
        }
      });
    } catch (e) {}

    try {
      var a = document.createElement('a');
      a.href = ${jsonTarget};
      a.rel = 'noreferrer noopener';
      a.referrerPolicy = 'no-referrer';
      document.body.appendChild(a);
      a.click();
    } catch (e) {}

    window.location.replace(${jsonTarget});
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0;url=${escapedUrl}">
    <p>Redirecting... If you are not redirected, <a href="${escapedUrl}" rel="noreferrer noopener" referrerpolicy="no-referrer">click here</a>.</p>
  </noscript>
</body>
</html>`

  const response = new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "Clear-Site-Data": '"cache", "cookies", "storage"',
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; form-action 'none'; frame-ancestors 'none';",
      "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "X-Content-Type-Options": "nosniff",
    },
  })

  response.cookies.set(LANDING_ACCESS_COOKIE, "", {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    sameSite: "lax",
  })

  return response
}
