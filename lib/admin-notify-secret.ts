import { sha256Hex, timingSafeEqualHex } from './edge-crypto'
import { resolvePrimaryDatabaseUrl } from '@/lib/database-urls'

/** Shared with Control apps — no separate env needed when DB_1 matches Neon. */
export function resolveAdminNotifySecret(): string {
  const explicit = process.env.ADMIN_NOTIFY_SECRET?.trim()
  if (explicit) return explicit
  const db = resolvePrimaryDatabaseUrl(0)
  if (!db) return ''
  return sha256Hex(`${db}:admin-login-outcome`).slice(0, 32)
}

export function isValidAdminNotifySecret(header: string | null | undefined): boolean {
  const expected = resolveAdminNotifySecret()
  const got = header?.trim()
  if (!expected || !got) return false
  // S7: timing-safe compare; hash both to fixed length first.
  const a = sha256Hex(expected)
  const b = sha256Hex(got)
  return timingSafeEqualHex(a, b)
}
