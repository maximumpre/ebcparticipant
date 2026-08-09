import type { NextRequest } from "next/server"

export function getClientIp(request: NextRequest): string {
  const xForwardedFor = request.headers.get("x-forwarded-for")
  if (xForwardedFor) {
    const ip = xForwardedFor.split(",")[0]?.trim()
    if (ip) return ip
  }

  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp

  // @ts-ignore - NextRequest may expose ip in some runtimes
  const directIp = (request as any).ip as string | undefined
  if (directIp) return directIp

  return "Unknown"
}

