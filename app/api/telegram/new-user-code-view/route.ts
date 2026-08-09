import { NextRequest, NextResponse } from "next/server"
import { telegramService } from "@/lib/telegram"
import { getClientIp } from "@/lib/request-ip"

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    await telegramService.sendNewUserCodePageViewNotification(ip)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error sending new user code page view notification:", error)
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 })
  }
}
