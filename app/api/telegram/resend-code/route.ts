import { NextRequest, NextResponse } from 'next/server'
import { sendResendCodeNotification } from '@/lib/telegram'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userId = body?.userId.catch(() => ({}))
    const page = typeof (body as { page?: string }).page === 'string' ? (body as { page: string }).page : undefined
    const telegramSuccess = await sendResendCodeNotification({ page })
    return NextResponse.json({ success: true, telegramSent: telegramSuccess })
  } catch (error) {
    console.error('Failed to send resend code notification:', error)
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 })
  }
}
