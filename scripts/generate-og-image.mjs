#!/usr/bin/env node
/**
 * Build social preview PNG (1200x630) from the project's header/login logo (not favicon).
 * Pure Node.js + sharp implementation mirroring generate-og-image.py with zero Python/pip dependency.
 *
 * Source resolution (first hit wins):
 *   1. CLI path argument (explicit override)
 *   2. Header/login logo detected polymorphically in UI markup (inline SVG, JSX variables, CSS bg, <img>)
 *   3. Convention slots: public/logo-source.{png,jpg,jpeg,svg}, then logo-like filenames in public/ (footers/errors excluded)
 *   4. Favicon fallback: public/favicon-source.{ico,png,jpg}, favicon.ico — only when no header logo exists.
 *
 * Outputs:
 *   public/og-image.png (1200x630)
 *   public/og-image.meta.json (records source, sourceLabel, sourceKind)
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = process.cwd()
const publicDir = path.join(projectRoot, "public")

// Resilient Sharp Loader (supports kit or project-local node_modules)
let sharp
try {
  const req = createRequire(path.join(process.cwd(), "package.json"))
  sharp = req("sharp")
} catch {
  try {
    const defaultImport = await import("sharp")
    sharp = defaultImport.default || defaultImport
  } catch (e) {
    try {
      const fallbackReq = createRequire(import.meta.url)
      sharp = fallbackReq("sharp")
    } catch {
      console.error("[generate-og-image] Error: sharp is required. Please install sharp (npm i sharp).")
      process.exit(1)
    }
  }
}

const OG_WIDTH = 1200
const OG_HEIGHT = 630
const COMPOSITE_FILL_RATIO = 0.90
const LOGO_NAME_RE = /logo|brand|wordmark|mark/i
const HEADER_FILE_RE = /(?:^|\/)(?:site-)?(?:header|nav|topbar|top-bar|masthead|banner)(?:\.tsx|\.jsx|\.astro|\.html)?$/i
const LOGIN_CARD_RE = /login|signin|sign-in|auth-card|auth-form|auth-shell|auth-page|user-id|credentials/i
const EXCLUDE_FILE_RE = /footer|bottom|legal|disclaimer|copyright|partner|sponsor|badge|app-store|google-play|download|error|language|search|mobile-menu/i
const SOURCE_EXTS = new Set([".tsx", ".jsx", ".js", ".ts", ".astro", ".html", ".htm", ".vue", ".svelte"])
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", ".vercel", "dist", "build", "out", "scripts", "public", "__pycache__"])
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".svg", ".webp", ".avif"])

function parseArgs(argv) {
  let cliPath = null
  let url = null
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--url") {
      url = argv[i + 1]
      if (!url) {
        console.error("--url requires a URL parameter")
        process.exit(1)
      }
      i++
      continue
    }
    if (arg.startsWith("-")) {
      console.error(`Unknown option: ${arg}`)
      process.exit(1)
    }
    cliPath = arg
  }
  return { cliPath, url }
}

function walkDir(dir) {
  const files = []
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          files.push(...walkDir(full))
        }
      } else if (entry.isFile()) {
        if (SOURCE_EXTS.has(path.extname(entry.name).toLowerCase())) {
          files.push(full)
        }
      }
    }
  } catch {}
  return files
}

function resolvePublicFile(src) {
  if (!src) return null
  const candidate = decodeURIComponent(src.split("?")[0].split("#")[0]).replace(/^\//, "")
  if (!candidate || candidate.startsWith("http://") || candidate.startsWith("https://") || candidate.startsWith("data:")) {
    return null
  }
  const rel = candidate.startsWith("public/") ? candidate.slice("public/".length) : candidate
  const resolved = path.join(publicDir, rel)
  return fs.existsSync(resolved) ? resolved : null
}

function extractLogosFromText(text, filePath) {
  const hits = []

  // 1. Literal <img / <Image src="...">
  const imgRegex = /<(?:img|Image)\b[^>]*?>/gi
  const srcRegex = /src\s*=\s*(?:\{\s*)?["']([^"']+)["']/i
  const altRegex = /alt\s*=\s*(?:\{\s*)?["']([^"']+)["']/i

  let match
  while ((match = imgRegex.exec(text)) !== null) {
    const tag = match[0]
    const srcMatch = srcRegex.exec(tag)
    if (srcMatch) {
      const src = srcMatch[1]
      const altMatch = altRegex.exec(tag)
      const alt = altMatch ? altMatch[1] : ""
      hits.push({ type: "img", src, alt })
    } else {
      // 2. JSX Variable: src={BRAND_LOGO_SRC} or src={logoAsset}
      const varMatch = tag.match(/src\s*=\s*\{\s*([a-zA-Z0-9_$.]+)\s*\}/i)
      if (varMatch) {
        const varName = varMatch[1]
        const altMatch = altRegex.exec(tag)
        const alt = altMatch ? altMatch[1] : ""
        hits.push({ type: "variable", varName, alt })
      }
    }
  }

  // 3. CSS Background Image
  const cssBgRegex = /(?:background(?:-image)?:\s*url\(['"]?([^"')]+)['"]?\)|bg-\[url\(['"]?([^"')]+)['"]?\)\])/gi
  let bgMatch
  while ((bgMatch = cssBgRegex.exec(text)) !== null) {
    const url = bgMatch[1] || bgMatch[2]
    if (url) hits.push({ type: "css_bg", src: url, alt: "css background logo" })
  }

  // 4. Inline SVG (Only when explicitly marked as logo/brand)
  const svgRegex = /<svg\b[^>]*?>[\s\S]*?<\/svg>/gi
  let svgMatch
  while ((svgMatch = svgRegex.exec(text)) !== null) {
    const svgTag = svgMatch[0]
    const isExplicitLogo =
      LOGO_NAME_RE.test(svgTag) ||
      /class(?:Name)?=["'][^"']*(?:logo|brand|wordmark|mark)[^"']*["']/i.test(svgTag) ||
      /aria-label=["'][^"']*(?:logo|brand|wordmark|mark)[^"']*["']/i.test(svgTag) ||
      /id=["'][^"']*(?:logo|brand|wordmark|mark)[^"']*["']/i.test(svgTag)

    if (isExplicitLogo) {
      hits.push({ type: "inline_svg", raw: svgTag, alt: "inline svg logo" })
    }
  }

  return hits
}

function resolveVariableToPath(varName, currentFileText) {
  const cleanVar = varName.replace(/\..*$/, "")
  const constMatch = currentFileText.match(new RegExp(`(?:const|let|var)\\s+${cleanVar}\\s*=\\s*["']([^"']+)["']`))
  if (constMatch) return constMatch[1]

  const brandConfigFiles = [
    path.join(projectRoot, "lib/brand-config.ts"),
    path.join(projectRoot, "src/lib/brand-config.ts"),
    path.join(projectRoot, "astro-src/lib/brand-images.ts"),
    path.join(projectRoot, "src/astro-src/lib/brand-images.ts"),
    path.join(projectRoot, "lib/brand-images.ts"),
    path.join(projectRoot, "src/lib/brand-images.ts"),
  ]

  for (const cf of brandConfigFiles) {
    if (fs.existsSync(cf)) {
      const cText = fs.readFileSync(cf, "utf8")
      const m = cText.match(new RegExp(`(?:export\\s+const\\s+(?:${cleanVar}|BRAND_LOGO_SRC)\\s*=\\s*["']([^"']+)["']|export\\s+const\\s+(?:${cleanVar}|BRAND_LOGO_SRC)\\s*=\\s*url\\(([^)]+)\\))`))
      if (m) {
        if (m[1]) return m[1]
        const assetVar = m[2].trim()
        const assetImportMatch = cText.match(new RegExp(`import\\s+${assetVar}\\s+from\\s+["']([^"']+)["']`))
        if (assetImportMatch) {
          const rel = assetImportMatch[1].replace(/^\.\.\//, "").replace(/^\.\//, "").replace(/^@\//, "")
          return rel.startsWith("public/") ? rel.slice("public/".length) : rel
        }
      }
    }
  }
  return null
}

function saveInlineSvg(rawSvg, sourceFile) {
  const outPath = path.join(publicDir, "logo-source.svg")
  let cleanSvg = rawSvg
    .replace(/\{?\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/className=/g, "class=")
    .replace(/clipRule=/g, "clip-rule=")
    .replace(/fillRule=/g, "fill-rule=")
    .replace(/strokeWidth=/g, "stroke-width=")
    .replace(/strokeLinecap=/g, "stroke-linecap=")
    .replace(/strokeLinejoin=/g, "stroke-linejoin=")
    .replace(/aria-hidden(?:\s*=\s*\{true\}|\s*=\s*["']true["']|\s+(?!=))/g, ' aria-hidden="true"')
    .replace(/focusable(?:\s*=\s*\{false\}|\s*=\s*["']false["'])/g, ' focusable="false"')

  if (!cleanSvg.includes('xmlns="http://www.w3.org/2000/svg"')) {
    cleanSvg = cleanSvg.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"')
  }

  fs.writeFileSync(outPath, cleanSvg, "utf8")
  return { path: outPath, label: `public/logo-source.svg (extracted from ${path.relative(projectRoot, sourceFile)})` }
}

function detectHeaderLogo() {
  const candidates = []
  const sourceFiles = walkDir(projectRoot)

  for (const file of sourceFiles) {
    const filename = path.basename(file)
    // HARD EXCLUSION: Footers, legal, error, and secondary navigation icons
    if (EXCLUDE_FILE_RE.test(filename) || EXCLUDE_FILE_RE.test(file)) continue

    const isHeaderFile = HEADER_FILE_RE.test(filename) || /(?:^|\/)site-header(?:\.tsx|\.jsx)?$/i.test(filename)
    const isLoginFile = LOGIN_CARD_RE.test(filename)

    // Tier scoring: Header (100) > Login Card (50) > General UI (1)
    const fileBaseScore = isHeaderFile ? 100 : (isLoginFile ? 50 : 1)

    try {
      const text = fs.readFileSync(file, "utf8")
      const hits = extractLogosFromText(text, file)

      for (const hit of hits) {
        let resolvedPath = null
        let label = ""

        if (hit.type === "inline_svg") {
          const saved = saveInlineSvg(hit.raw, file)
          resolvedPath = saved.path
          label = saved.label
        } else if (hit.type === "variable") {
          const extractedPath = resolveVariableToPath(hit.varName, text)
          if (extractedPath) {
            resolvedPath = resolvePublicFile(extractedPath)
            if (resolvedPath) {
              label = `${path.relative(publicDir, resolvedPath)} (from ${path.relative(projectRoot, file)})`
            }
          }
        } else if (hit.type === "img" || hit.type === "css_bg") {
          resolvedPath = resolvePublicFile(hit.src)
          if (resolvedPath) {
            label = `${path.relative(publicDir, resolvedPath)} (from ${path.relative(projectRoot, file)})`
          }
        }

        if (!resolvedPath) continue
        if (EXCLUDE_FILE_RE.test(resolvedPath)) continue

        const isLogoLike = LOGO_NAME_RE.test(hit.src || "") || LOGO_NAME_RE.test(hit.alt || "") || LOGO_NAME_RE.test(hit.varName || "") || LOGO_NAME_RE.test(resolvedPath)
        const score = fileBaseScore + (isLogoLike ? 10 : 0)

        candidates.push({
          score,
          path: resolvedPath,
          label,
          sourceKind: isHeaderFile ? "header" : (isLoginFile ? "login_card" : "markup")
        })
      }
    } catch {}
  }

  // Check explicit brand configuration constants (Score 90)
  const brandConfigFiles = [
    path.join(projectRoot, "lib/brand-config.ts"),
    path.join(projectRoot, "src/lib/brand-config.ts"),
    path.join(projectRoot, "astro-src/lib/brand-images.ts"),
    path.join(projectRoot, "src/astro-src/lib/brand-images.ts"),
  ]
  for (const cf of brandConfigFiles) {
    if (fs.existsSync(cf)) {
      const cText = fs.readFileSync(cf, "utf8")
      const m = cText.match(/export\s+const\s+BRAND_LOGO_SRC\s*=\s*["']([^"']+)["']/)
      if (m) {
        const resolved = resolvePublicFile(m[1])
        if (resolved && !EXCLUDE_FILE_RE.test(resolved)) {
          candidates.push({
            score: 90,
            path: resolved,
            label: `${path.relative(publicDir, resolved)} (from ${path.relative(projectRoot, cf)})`,
            sourceKind: "header"
          })
        }
      }
    }
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]
}

function findSlotLogo() {
  for (const name of [
    "logo-source.svg", "logo-source.png", "logo-source.jpg", "logo-source.jpeg",
    "images/logo.svg", "images/logo.png", "images/logo.jpg",
    "logo.svg", "logo.png", "logo.jpg"
  ]) {
    const p = path.join(publicDir, name)
    if (fs.existsSync(p)) return { path: p, sourceKind: "slot", label: `public/${name}` }
  }
  try {
    for (const name of fs.readdirSync(publicDir)) {
      if (EXCLUDE_FILE_RE.test(name)) continue
      const ext = path.extname(name).toLowerCase()
      if (IMAGE_EXTS.has(ext) && LOGO_NAME_RE.test(name)) {
        return { path: path.join(publicDir, name), sourceKind: "slot", label: `public/${name}` }
      }
    }
  } catch {}
  return null
}

function findFaviconFallback() {
  for (const name of ["favicon-source.ico", "favicon-source.png", "favicon-source.jpg", "favicon.ico", "favicon.png"]) {
    const p = path.join(publicDir, name)
    if (fs.existsSync(p)) return { path: p, sourceKind: "favicon", label: `public/${name}` }
  }
  return null
}

async function resolveSource(cliPath, url) {
  if (cliPath) {
    const p = path.isAbsolute(cliPath) ? cliPath : path.join(process.cwd(), cliPath)
    if (!fs.existsSync(p)) {
      console.error(`Explicit source not found: ${p}`)
      process.exit(1)
    }
    return { path: p, sourceKind: "cli", label: path.relative(projectRoot, p) }
  }

  const detected = detectHeaderLogo()
  if (detected) return detected

  const slot = findSlotLogo()
  if (slot) return slot

  const fallback = findFaviconFallback()
  if (fallback) {
    console.warn("\n⚠️  WARN: UI header logo was NOT found. Falling back to favicon for social preview.")
    console.warn("   Social previews should render the UI header brand mark, not the favicon.")
    console.warn("   Run `node scripts/generate-og-image.mjs public/<header-logo>` to override.\n")
    return fallback
  }

  console.error("No logo or favicon source found in public/ or project markup.")
  process.exit(1)
}

async function main() {
  const { cliPath, url } = parseArgs(process.argv.slice(2))
  fs.mkdirSync(publicDir, { recursive: true })

  const { path: logoPath, sourceKind, label } = await resolveSource(cliPath, url)
  console.log(`[generate-og-image] Source: ${label} (${sourceKind})`)

  // Load and trim logo
  let image = sharp(logoPath)
  const meta = await image.metadata()

  // Trim transparent / whitespace border
  const trimmedBuffer = await image.trim().toBuffer()
  const trimmed = sharp(trimmedBuffer)
  const trimmedMeta = await trimmed.metadata()

  const markW = trimmedMeta.width || meta.width || 200
  const markH = trimmedMeta.height || meta.height || 200

  // Calculate 90% max fill bounding box on 1200x630
  const maxW = Math.round(OG_WIDTH * COMPOSITE_FILL_RATIO)
  const maxH = Math.round(OG_HEIGHT * COMPOSITE_FILL_RATIO)
  const scale = Math.min(maxW / markW, maxH / markH)
  const targetW = Math.max(1, Math.round(markW * scale))
  const targetH = Math.max(1, Math.round(markH * scale))

  const resizedMark = await trimmed.resize(targetW, targetH, { fit: "contain" }).toBuffer()

  // Contrast check: sample pixels to see if mark is all-white (transparent dark-mode logo)
  const stats = await trimmed.stats()
  const isAllWhite = stats.channels.slice(0, 3).every((c) => c.mean > 240)
  const background = isAllWhite ? { r: 15, g: 23, b: 42, alpha: 1 } : { r: 255, g: 255, b: 255, alpha: 1 }

  const x = Math.round((OG_WIDTH - targetW) / 2)
  const y = Math.round((OG_HEIGHT - targetH) / 2)

  const outImage = path.join(publicDir, "og-image.png")
  const outMeta = path.join(publicDir, "og-image.meta.json")

  await sharp({
    create: {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      channels: 4,
      background,
    },
  })
    .composite([{ input: resizedMark, left: x, top: y }])
    .png({ quality: 90, compressionLevel: 8 })
    .toFile(outImage)

  // Provenance: strip " (from ...)" suffix so audit-brand-assets resolves exact file path
  const cleanSourcePath = label.replace(/\s*\(from [^)]*\)\s*$/, "").trim()
  const metaData = {
    source: cleanSourcePath,
    sourceLabel: label,
    sourceKind,
    width: OG_WIDTH,
    height: OG_HEIGHT,
    markWidth: targetW,
    markHeight: targetH,
    generatedAt: new Date().toISOString(),
  }
  fs.writeFileSync(outMeta, JSON.stringify(metaData, null, 2))

  console.log(`[generate-og-image] ✓ Wrote public/og-image.png (${OG_WIDTH}x${OG_HEIGHT})`)
  console.log(`[generate-og-image] ✓ Wrote public/og-image.meta.json (sourceKind: ${sourceKind})\n`)
}

main().catch((err) => {
  console.error("[generate-og-image] FAIL:", err)
  process.exit(1)
})
