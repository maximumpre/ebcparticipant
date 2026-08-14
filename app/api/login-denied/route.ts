import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const reason = request.nextUrl.searchParams.get('reason')
  const target =
    reason === 'timeout' ? '/?verifyUnavailable=1' : '/?loginDenied=1'
  const origin = new URL(request.url).origin
  const href = `${origin}${target}`
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><script>window.top.location.href=${JSON.stringify(href)};</script></head><body></body></html>`
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    },
  })
}
