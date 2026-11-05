export const INDEXNOW_KEY_PATH_RE = /^\/[0-9a-zA-Z-]{8,128}\.txt$/i

export function isIndexNowVerificationPath(pathname: string): boolean {
  return INDEXNOW_KEY_PATH_RE.test(pathname)
}
