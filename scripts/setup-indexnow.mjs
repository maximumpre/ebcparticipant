/**
 * Writes public/<INDEXNOW_KEY>.txt so Bing/Yandex can verify the key during deploy builds.
 * Prefers INDEXNOW_KEY env; otherwise reads fallback from lib/site-url.ts.
 */
import fs from "node:fs"
import path from "node:path"

function readKeyFromSiteUrl() {
  const candidates = [
    path.join(process.cwd(), "lib", "site-url.ts"),
    path.join(process.cwd(), "src", "lib", "site-url.ts"),
  ]
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue
    const source = fs.readFileSync(file, "utf8")
    const match =
      source.match(/export const INDEXNOW_KEY\s*=\s*[\s\S]*?\?\?\s*(["'])([a-f0-9]{32})\1/i) ??
      source.match(/export const INDEXNOW_KEY\s*=\s*(["'])([a-f0-9]{32})\1/i)
    if (match?.[2]) return match[2]
  }
  return ""
}

const key = process.env.INDEXNOW_KEY?.trim() || readKeyFromSiteUrl()
if (!key) {
  process.exit(0)
}

const publicDir = path.join(process.cwd(), "public")
fs.mkdirSync(publicDir, { recursive: true })

// Remove known orphan keys from prior rotations
for (const orphan of ["bce6ac0838e243888c008d3b087d7f57.txt"]) {
  const orphanPath = path.join(publicDir, orphan)
  if (fs.existsSync(orphanPath) && orphan !== `${key}.txt`) {
    fs.unlinkSync(orphanPath)
  }
}

const out = path.join(publicDir, `${key}.txt`)
fs.writeFileSync(out, `${key}\n`, "utf8")
console.log(`[indexnow] wrote public/${key}.txt`)
