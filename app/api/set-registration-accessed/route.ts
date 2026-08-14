import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true })
  
  // Set session cookie (expires when browser closes, but with 30 min max for security)
  response.cookies.set('registration_accessed', 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 30, // 30 minutes (short-lived, won't persist across sessions)
    path: '/'
  })
  
  return response
}

