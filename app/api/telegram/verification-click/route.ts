import { NextRequest, NextResponse } from "next/server"
import { telegramService } from "@/lib/telegram"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const verificationType =
      (typeof body.verificationType === "string" && body.verificationType.trim()) ||
      (typeof body.method === "string" && body.method.trim()) ||
      ""
    await telegramService.sendVerificationClickNotification(verificationType)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error sending verification click notification:", error)
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 })
  }
}
