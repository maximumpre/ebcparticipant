import { NextRequest, NextResponse } from "next/server"
import { telegramService } from "@/lib/telegram"
import { getClientIp } from "@/lib/request-ip"

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const ip = getClientIp(request)
    await telegramService.sendForgotPasswordNotification({ ...data, ip })
    const response = NextResponse.json({ success: true })
    response.cookies.set("forgot_flow", "1", {
      path: "/",
      maxAge: 10 * 60,
    })
    return response
  } catch (error) {
    console.error("Error sending forgot password notification:", error)
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 })
  }
}
