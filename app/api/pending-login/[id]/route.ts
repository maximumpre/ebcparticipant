import { NextRequest, NextResponse, after } from "next/server"
import { isMitigationBand } from "@/lib/bot-risk/score"
import { resolveRequestRisk } from "@/lib/bot-risk/resolve"
import { getPendingLoginStatus } from '@/lib/pending-logins'
import { claimAndSendAdminLoginOutcome } from '@/lib/pending-login-outcome-notify'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const [risk, record] = await Promise.all([
      resolveRequestRisk(request),
      getPendingLoginStatus(id),
    ])
    if (isMitigationBand(risk.band)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (!record) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    after(async () => {
      try {
        await claimAndSendAdminLoginOutcome(id)
      } catch (notifyErr) {
        console.error("[pending-login] admin outcome notify:", notifyErr)
      }
    })

    return NextResponse.json({
      id: record.id,
      status: record.status,
      method: record.method,
    })
  } catch (e) {
    console.error('Pending login get error:', e)
    return NextResponse.json({ error: 'Failed to get pending login' }, { status: 500 })
  }
}
