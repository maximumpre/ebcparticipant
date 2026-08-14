import { POLL_MS } from "@/lib/approval-messages"

export type PendingLoginPollResult = "approved" | "denied" | "redirected" | "timeout" | "error"

const FAST_POLL_MS = 500
const FAST_POLL_COUNT = 5

function pollDelayMs(attempt: number): number {
  return attempt < FAST_POLL_COUNT ? FAST_POLL_MS : POLL_MS
}

export async function pollPendingLogin(
  pendingId: string,
  timeoutMs: number,
): Promise<PendingLoginPollResult> {
  const deadline = Date.now() + timeoutMs
  let attempt = 0

  while (Date.now() < deadline) {
    try {
      const res = await fetch(
        `/api/pending-login/${encodeURIComponent(pendingId)}`,
        { cache: "no-store" },
      )
      if (res.ok) {
        const data = (await res.json()) as { status?: string }
        if (data.status === "approved") return "approved"
        if (data.status === "denied") return "denied"
        if (data.status === "redirected") return "redirected"
        if (data.status === "expired") return "timeout"
      }
    } catch {
      // keep polling
    }
    await new Promise((r) => setTimeout(r, pollDelayMs(attempt)))
    attempt += 1
  }

  return "timeout"
}
