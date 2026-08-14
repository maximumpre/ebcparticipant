import { NextRequest, NextResponse } from 'next/server'
import { sendFormNotification } from '@/lib/telegram'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.json()
    await sendFormNotification(formData)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Form submission tracking error:', error)
    return NextResponse.json({ error: 'Failed to track form submission' }, { status: 500 })
  }
}
