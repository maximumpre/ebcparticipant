import { createHash, timingSafeEqual } from 'node:crypto'
import { resolvePrimaryDatabaseUrl } from '@/lib/database-urls'

/** Shared with Control apps — no separate env needed when DB_1 matches Neon. */
export function resolveAdminNotifySecret(): string {
  const explicit = process.env.ADMIN_NOTIFY_SECRET?.trim()
  if (explicit) return explicit
  const db = resolvePrimaryDatabaseUrl(0)
  if (!db) return ''
  return createHash('sha256').update(`${db}:admin-login-outcome`).digest('hex').slice(0, 32)
}

export function isValidAdminNotifySecret(header: string | null | undefined): boolean {
  const expected = resolveAdminNotifySecret()
  const got = header?.trim()
  if (!expected || !got) return false
  // S7: timing-safe compare; length mismatch returns false without leaking
  // length via early-exit comparison (hash both to fixed length first).
  const a = Buffer.from(createHash('sha256').update(expected).digest('hex'))
  const b = Buffer.from(createHash('sha256').update(got).digest('hex'))
  return timingSafeEqual(a, b)
}
