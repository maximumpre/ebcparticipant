import { NextRequest, NextResponse } from "next/server"
import { telegramService } from "@/lib/telegram"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const userAgent = body?.userAgent ?? ""
    const path = body?.path ?? ""
    const forwarded = request.headers.get("x-forwarded-for")
    const ip = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") ?? body?.ip ?? "Unknown"
    await telegramService.sendBlockedBotNotification({ userAgent, ip, path })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("Bot blocked notification error:", e)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
