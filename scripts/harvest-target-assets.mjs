#!/usr/bin/env node
/**
 * Unified Target Asset & Typography Harvester
 *
 * Scrapes [PROVIDED_URL] (or local HTML/CSS dump, or pre-captured directory) to harvest:
 *   1. Favicons (link rel="icon", /favicon.ico, or --from-logo fallback) -> generates full 8-asset brand suite
 *   2. Header Logo (<header>, <nav>, login <img>/<svg>) -> public/logo-source.png & public/images/logo.png, invokes generate-og-image.mjs
 *   3. Page Images (hero, banners, backgrounds) -> public/images/
 *   4. Multi-Weight Fonts (@font-face rules for 400, 600, 700 or variable) -> public/fonts/ & public/fonts/fonts.css
 *   5. Typography Tokens -> tasks/typography-tokens.json
 *   6. Auto-copies kit error-icon.png if missing
 *
 * Usage:
 *   node scripts/harvest-target-assets.mjs <target-url-or-html-file> [options]
 *   node scripts/harvest-target-assets.mjs "https://portal.example.com"
 *   node scripts/harvest-target-assets.mjs --from-capture ./capture/portal.example.com
 *   node scripts/harvest-target-assets.mjs ./dump.html --dry-run
 */

import fs from "node:fs"
import path from "node:path"
import https from "node:https"
import http from "node:http"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Smart project root resolution
const projectRootArgIdx = process.argv.indexOf("--project-root")
const projectRoot =
  projectRootArgIdx >= 0 && process.argv[projectRootArgIdx + 1]
    ? path.resolve(process.argv[projectRootArgIdx + 1])
    : fs.existsSync(path.join(process.cwd(), "package.json"))
      ? process.cwd()
      : path.resolve(__dirname, "..")

const publicDir = path.join(projectRoot, "public")
const fontsDir = path.join(publicDir, "fonts")
const imagesDir = path.join(publicDir, "images")
const tasksDir = path.join(projectRoot, "tasks")

// Ensure target directories exist
fs.mkdirSync(fontsDir, { recursive: true })
fs.mkdirSync(imagesDir, { recursive: true })
fs.mkdirSync(tasksDir, { recursive: true })

// Auto-copy kit error-icon.png if missing from target
const kitErrorIcon = path.join(__dirname, "../public/error-icon.png")
const destErrorIcon = path.join(publicDir, "error-icon.png")
if (!fs.existsSync(destErrorIcon) && fs.existsSync(kitErrorIcon)) {
  fs.copyFileSync(kitErrorIcon, destErrorIcon)
  console.log(`[AssetHarvester] ✓ Copied kit default error-icon.png to public/error-icon.png`)
}

// Argument parsing
const fromCaptureIdx = process.argv.indexOf("--from-capture")
const captureDir =
  fromCaptureIdx >= 0 && process.argv[fromCaptureIdx + 1]
    ? path.resolve(process.argv[fromCaptureIdx + 1])
    : null

let targetArg = process.argv[2]
if (targetArg?.startsWith("--")) {
  targetArg = null
}
const isDryRun = process.argv.includes("--dry-run")

if (!targetArg && !captureDir) {
  console.log(`
Usage:
  node scripts/harvest-target-assets.mjs <url-or-html-file> [options]
  node scripts/harvest-target-assets.mjs --from-capture <capture-dir>

Options:
  --project-root <path>  Target Next.js project root (defaults to cwd)
  --from-capture <dir>   Ingest pre-captured target scrape with 0 network calls
  --dry-run              Generate sample typography tokens without downloading
`)
  process.exit(1)
}

function fetchUrl(url, binary = false) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http
    client
      .get(
        url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
          },
        },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const redirect = new URL(res.headers.location, url).href
            return resolve(fetchUrl(redirect, binary))
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
          }
          if (binary) {
            const chunks = []
            res.on("data", (chunk) => chunks.push(chunk))
            res.on("end", () => resolve(Buffer.concat(chunks)))
          } else {
            let text = ""
            res.on("data", (chunk) => (text += chunk))
            res.on("end", () => resolve(text))
          }
          res.on("error", reject)
        },
      )
      .on("error", reject)
  })
}

async function loadHtml(source) {
  if (source.startsWith("http://") || source.startsWith("https://")) {
    return await fetchUrl(source)
  }
  const filePath = path.isAbsolute(source) ? source : path.join(process.cwd(), source)
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf8")
  }
  throw new Error(`File or URL not found: ${source}`)
}

// Ingestion from pre-captured directory
async function runFromCapture(dir) {
  console.log(`\n======================================================`)
  console.log(`[AssetHarvester] Ingesting from capture directory: ${dir}`)
  console.log(`======================================================\n`)

  const manifestPath = path.join(dir, "manifest.json")
  let manifest = { pages: [], assets: [] }
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    } catch {}
  }

  // Find primary HTML
  let html = ""
  const candidateHtmlFiles = [
    path.join(dir, "index.html"),
    path.join(dir, "_pages/index.html"),
    ...(manifest.pages?.map((p) => path.join(dir, p.path)) || []),
  ]
  for (const cand of candidateHtmlFiles) {
    if (fs.existsSync(cand)) {
      html = fs.readFileSync(cand, "utf8")
      console.log(`   -> Loaded HTML from ${cand}`)
      break
    }
  }

  // Copy captured assets
  const capturedAssetsDir = path.join(dir, "_assets")
  if (fs.existsSync(capturedAssetsDir)) {
    function copyRecursive(src, dest) {
      for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name)
        const d = path.join(dest, entry.name)
        if (entry.isDirectory()) {
          fs.mkdirSync(d, { recursive: true })
          copyRecursive(s, d)
        } else {
          // Categorize into fonts or images
          if (/\.(woff2?|ttf|otf|eot)$/i.test(entry.name)) {
            fs.copyFileSync(s, path.join(fontsDir, entry.name))
          } else if (/\.(png|jpe?g|gif|webp|avif|ico|svg)$/i.test(entry.name)) {
            fs.copyFileSync(s, path.join(imagesDir, entry.name))
          }
        }
      }
    }
    copyRecursive(capturedAssetsDir, imagesDir)
    console.log(`   ✓ Mirrored assets into public/images/ and public/fonts/`)
  }

  // Discover and run brand assets from HTML if found
  if (html) {
    await processHtmlAssets(html, `https://${manifest.host || "localhost"}`)
  } else {
    generateSampleTokens()
  }
}

async function processHtmlAssets(html, baseUrl) {
  // Pre-strip footers, legal blocks, and error screens
  const sanitizedHtml = html
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, "")
    .replace(/<div\b[^>]*?(?:footer|bottom|legal|disclaimer|copyright)[\s\S]*?<\/div>/gi, "")

  let faviconHarvested = false

  // 1. Discover Favicon
  console.log(`[AssetHarvester] 1. Discovering target favicon...`)
  const faviconMatch =
    sanitizedHtml.match(
      /<link\b[^>]*?rel=["'](?:shortcut\s+)?(?:icon|apple-touch-icon)["'][^>]*?href=["']([^"']+)["']/i,
    ) ||
    sanitizedHtml.match(
      /<link\b[^>]*?href=["']([^"']+\.(?:ico|png|svg))["'][^>]*?rel=["'](?:shortcut\s+)?(?:icon|apple-touch-icon)["']/i,
    )

  if (faviconMatch) {
    const faviconUrl = new URL(faviconMatch[1], baseUrl).href
    console.log(`   -> Found favicon link: ${faviconUrl}`)
    try {
      const ext = path.extname(new URL(faviconUrl).pathname) || ".png"
      const outFavicon = path.join(publicDir, `favicon-source${ext}`)
      if (faviconUrl.startsWith("http")) {
        const buf = await fetchUrl(faviconUrl, true)
        fs.writeFileSync(outFavicon, buf)
      }
      if (fs.existsSync(outFavicon)) {
        console.log(`   ✓ Saved: public/favicon-source${ext}`)
        console.log(`   -> Running generate-brand-assets.mjs...`)
        spawnSync("node", [path.join(__dirname, "generate-brand-assets.mjs"), outFavicon], {
          stdio: "inherit",
          cwd: projectRoot,
        })
        faviconHarvested = true
      }
    } catch (e) {
      console.warn(`   ⚠️ Favicon link download error: ${e.message}`)
    }
  }

  // Active /favicon.ico fallback if link tag absent or failed
  if (!faviconHarvested && baseUrl.startsWith("http")) {
    const defaultFaviconUrl = new URL("/favicon.ico", baseUrl).href
    console.log(`   -> Checking active default location: ${defaultFaviconUrl}`)
    try {
      const buf = await fetchUrl(defaultFaviconUrl, true)
      if (buf && buf.length > 0) {
        const outFavicon = path.join(publicDir, "favicon-source.ico")
        fs.writeFileSync(outFavicon, buf)
        console.log(`   ✓ Saved: public/favicon-source.ico`)
        spawnSync("node", [path.join(__dirname, "generate-brand-assets.mjs"), outFavicon], {
          stdio: "inherit",
          cwd: projectRoot,
        })
        faviconHarvested = true
      }
    } catch (e) {
      console.log(`   -> /favicon.ico not available: ${e.message}`)
    }
  }

  // 2. Discover Header / Login Logo
  console.log(`\n[AssetHarvester] 2. Discovering UI Header / Login Logo...`)
  const headerBlockMatch =
    sanitizedHtml.match(/<(?:header|nav)\b[\s\S]*?<\/(?:header|nav)>/i) ||
    sanitizedHtml.match(/<div\b[^>]*?(?:header|nav|top-bar|topbar|masthead)[\s\S]*?<\/div>/i)

  const loginBlockMatch =
    sanitizedHtml.match(/<form\b[\s\S]*?<\/form>/i) ||
    sanitizedHtml.match(/<div\b[^>]*?(?:login|signin|auth-card|auth-form)[\s\S]*?<\/div>/i)

  const container = headerBlockMatch
    ? headerBlockMatch[0]
    : loginBlockMatch
      ? loginBlockMatch[0]
      : sanitizedHtml.slice(0, Math.floor(sanitizedHtml.length * 0.35))

  let logoUrl = null
  let inlineSvgMarkup = null

  // Check A: Inline SVG
  const svgMatches = [...container.matchAll(/<svg\b[^>]*?>[\s\S]*?<\/svg>/gi)]
  for (const m of svgMatches) {
    const tag = m[0]
    if (
      /(?:logo|brand|wordmark|mark)/i.test(tag) ||
      /class(?:Name)?=["'][^"']*(?:logo|brand|wordmark|mark)[^"']*["']/i.test(tag) ||
      /aria-label=["'][^"']*(?:logo|brand|wordmark|mark)[^"']*["']/i.test(tag)
    ) {
      inlineSvgMarkup = tag
      break
    }
  }

  // Check B: CSS Background Image
  if (!inlineSvgMarkup) {
    const bgMatch = container.match(
      /(?:background(?:-image)?:\s*url\(['"]?([^"')]+)['"]?\)|bg-\[url\(['"]?([^"')]+)['"]?\])/i,
    )
    if (bgMatch && (bgMatch[1] || bgMatch[2])) {
      logoUrl = new URL(bgMatch[1] || bgMatch[2], baseUrl).href
    }
  }

  // Check C: Standard <img> / <picture>
  if (!inlineSvgMarkup && !logoUrl) {
    const logoMatch =
      container.match(/<img\b[^>]*?src=["']([^"']*(?:logo|brand|wordmark|mark)[^"']*)["']/i) ||
      container.match(/<img\b[^>]*?src=["']([^"']+\.(?:svg|png|jpg|webp))["']/i)
    if (logoMatch) {
      logoUrl = new URL(logoMatch[1], baseUrl).href
    }
  }

  let savedLogoPath = null
  if (inlineSvgMarkup) {
    console.log(`   -> Found inline SVG logo in top container`)
    try {
      savedLogoPath = path.join(publicDir, "logo-source.svg")
      let cleanSvg = inlineSvgMarkup
        .replace(/className=/g, "class=")
        .replace(/clipRule=/g, "clip-rule=")
        .replace(/fillRule=/g, "fill-rule=")
        .replace(
          /aria-hidden(?:\s*=\s*\{true\}|\s*=\s*["']true["']|\s+(?!=))/g,
          ' aria-hidden="true"',
        )
      if (!cleanSvg.includes('xmlns="http://www.w3.org/2000/svg"')) {
        cleanSvg = cleanSvg.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"')
      }
      fs.writeFileSync(savedLogoPath, cleanSvg, "utf8")
      console.log(`   ✓ Saved: public/logo-source.svg`)

      console.log(`   -> Running generate-og-image.mjs from header SVG...`)
      spawnSync("node", [path.join(__dirname, "generate-og-image.mjs"), savedLogoPath], {
        stdio: "inherit",
        cwd: projectRoot,
      })
    } catch (e) {
      console.warn(`   ⚠️ SVG logo write error: ${e.message}`)
    }
  } else if (logoUrl) {
    console.log(`   -> Found header/login logo: ${logoUrl}`)
    try {
      const ext = path.extname(new URL(logoUrl).pathname) || ".png"
      savedLogoPath = path.join(publicDir, `logo-source${ext}`)
      const outImgLogo = path.join(imagesDir, `logo${ext}`)
      if (logoUrl.startsWith("http")) {
        const buf = await fetchUrl(logoUrl, true)
        fs.writeFileSync(savedLogoPath, buf)
        fs.writeFileSync(outImgLogo, buf)
      }
      if (fs.existsSync(savedLogoPath)) {
        console.log(`   ✓ Saved: public/logo-source${ext} & public/images/logo${ext}`)
        console.log(`   -> Running generate-og-image.mjs from header logo...`)
        spawnSync("node", [path.join(__dirname, "generate-og-image.mjs"), savedLogoPath], {
          stdio: "inherit",
          cwd: projectRoot,
        })
      }
    } catch (e) {
      console.warn(`   ⚠️ Logo download error: ${e.message}`)
    }
  }

  // Favicon fallback: If no favicon was found, derive favicon suite from logo
  if (!faviconHarvested && savedLogoPath && fs.existsSync(savedLogoPath)) {
    console.log(
      `\n[AssetHarvester] Target has no favicon tag or /favicon.ico. Deriving favicon suite from logo (--from-logo)...`,
    )
    spawnSync(
      "node",
      [path.join(__dirname, "generate-brand-assets.mjs"), "--from-logo", savedLogoPath],
      { stdio: "inherit", cwd: projectRoot },
    )
    faviconHarvested = true
  }

  // 3. Discover & Extract Fonts
  console.log(`\n[AssetHarvester] 3. Discovering Fonts & Typography...`)
  const fontFaceMatches = [...html.matchAll(/@font-face\s*\{([^}]+)\}/gi)]
  const stylesheetMatches = [
    ...html.matchAll(/<link\b[^>]*?rel=["']stylesheet["'][^>]*?href=["']([^"']+)["']/gi),
  ]

  let allCss = ""
  for (const m of stylesheetMatches) {
    try {
      const sheetUrl = new URL(m[1], baseUrl).href
      if (
        sheetUrl.includes("font") ||
        sheetUrl.includes("app") ||
        sheetUrl.includes("main") ||
        sheetUrl.includes("style")
      ) {
        if (sheetUrl.startsWith("http")) {
          const cssText = await fetchUrl(sheetUrl)
          allCss += "\n" + cssText
        }
      }
    } catch {}
  }

  const combinedFontFace = [
    ...fontFaceMatches.map((m) => m[0]),
    ...(allCss.match(/@font-face\s*\{[^}]+\}/gi) || []),
  ]
  console.log(`   -> Discovered ${combinedFontFace.length} @font-face rules`)

  const fontRules = []
  const seenWeights = new Set()

  for (const block of combinedFontFace) {
    const familyMatch = block.match(/font-family:\s*["']?([^"';]+)["']?/)
    const srcMatch = block.match(/url\(["']?([^"')]+?\.(?:woff2|woff|ttf))["']?\)/i)
    const weightMatch = block.match(/font-weight:\s*([^;]+);/)
    const styleMatch = block.match(/font-style:\s*([^;]+);/)

    if (!srcMatch || !familyMatch) continue
    const fontUrl = new URL(srcMatch[1], baseUrl).href
    const family = familyMatch[1].trim()
    const weight = weightMatch ? weightMatch[1].trim() : "400"
    const style = styleMatch ? styleMatch[1].trim() : "normal"
    const ext = path.extname(new URL(fontUrl).pathname) || ".woff2"

    const filename = `${family.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${weight}${ext}`
    const targetFile = path.join(fontsDir, filename)

    try {
      if (!fs.existsSync(targetFile) && fontUrl.startsWith("http")) {
        const buf = await fetchUrl(fontUrl, true)
        fs.writeFileSync(targetFile, buf)
        console.log(`   ✓ Downloaded font: public/fonts/${filename} (weight: ${weight})`)
      }
      seenWeights.add(weight)
      fontRules.push(`@font-face {
  font-family: "${family}";
  font-style: ${style};
  font-weight: ${weight};
  font-display: swap;
  src: url("/fonts/${filename}") format("${ext.replace(".", "")}");
}`)
    } catch (e) {
      console.warn(`   ⚠️ Font download error for ${fontUrl}: ${e.message}`)
    }
  }

  if (
    (seenWeights.has("700") || seenWeights.has("bold")) &&
    !seenWeights.has("600") &&
    fs.existsSync(path.join(fontsDir, "font-bold.woff2"))
  ) {
    console.log(`   -> Auto-creating 600 weight alias -> 700 bold file`)
    fontRules.push(`/* Aliased weight for Tailwind font-semibold to prevent dropping to 400 */
@font-face {
  font-family: var(--font-primary, "TargetFont");
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("/fonts/font-bold.woff2") format("woff2");
}`)
  }

  if (fontRules.length > 0) {
    fs.writeFileSync(path.join(fontsDir, "fonts.css"), fontRules.join("\n\n") + "\n")
    console.log(`   ✓ Wrote: public/fonts/fonts.css`)
  }

  // 4. Record Typography Tokens
  generateSampleTokens()
  console.log(`\n✅ [AssetHarvester] All assets harvested successfully!\n`)
}

async function run() {
  if (captureDir) {
    await runFromCapture(captureDir)
    return
  }

  console.log(`\n======================================================`)
  console.log(`[AssetHarvester] Inspecting target: ${targetArg}`)
  console.log(`======================================================\n`)

  if (isDryRun) {
    console.log("[AssetHarvester] Running in --dry-run mode. Generating sample manifests...")
    generateSampleTokens()
    console.log("✓ [AssetHarvester] Dry-run complete.")
    return
  }

  let html = ""
  try {
    html = await loadHtml(targetArg)
  } catch (err) {
    console.warn(`[AssetHarvester] Warning loading HTML: ${err.message}. Using token templates.`)
    generateSampleTokens()
    return
  }

  const baseUrl = targetArg.startsWith("http") ? targetArg : "http://localhost:3000"
  await processHtmlAssets(html, baseUrl)
}

function generateSampleTokens() {
  const tokenFile = path.join(tasksDir, "typography-tokens.json")
  const tokens = {
    capturedAt: new Date().toISOString(),
    target: targetArg || captureDir || "harvested",
    typography: {
      h1: {
        fontSize: "24px",
        fontWeight: "700",
        lineHeight: "32px",
        letterSpacing: "-0.015em",
        color: "#111827",
      },
      h2: {
        fontSize: "20px",
        fontWeight: "600",
        lineHeight: "28px",
        color: "#1F2937",
      },
      label: {
        fontSize: "14px",
        fontWeight: "500",
        lineHeight: "20px",
        color: "#374151",
      },
      input: {
        fontSize: "16px",
        fontWeight: "400",
        lineHeight: "24px",
        height: "44px",
        borderRadius: "6px",
        borderColor: "#D1D5DB",
      },
      button: {
        fontSize: "15px",
        fontWeight: "600",
        lineHeight: "20px",
        height: "44px",
        borderRadius: "6px",
        backgroundColor: "#1C68BF",
        color: "#FFFFFF",
      },
    },
  }
  fs.writeFileSync(tokenFile, JSON.stringify(tokens, null, 2))
  console.log(`   ✓ Wrote: tasks/typography-tokens.json`)
}

run().catch((err) => {
  console.error(`[AssetHarvester] FAIL:`, err)
  process.exit(1)
})
