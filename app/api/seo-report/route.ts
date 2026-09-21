import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({ error: "SEO report not configured" }, { status: 501 })
}
