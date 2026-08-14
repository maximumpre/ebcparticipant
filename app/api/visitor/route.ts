import { NextRequest, NextResponse } from 'next/server'
import { sendVisitorNotification, getVisitorData } from '@/lib/telegram'

export async function POST(request: NextRequest) {
  try {
    const visitorData = await getVisitorData(request)
    const body = await request.json()
    
    // Merge additional data from client
    const fullData = {
      ...visitorData,
      ...body
    }

    await sendVisitorNotification(fullData)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Visitor tracking error:', error)
    return NextResponse.json({ error: 'Failed to track visitor' }, { status: 500 })
  }
}
