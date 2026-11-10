/**
 * Node/sharp alternative — same outputs as generate-brand-assets.py (favicon only).
 *
 * Usage:
 *   npm install --save-dev sharp to-ico
 *   node scripts/generate-brand-assets.mjs
 *   node scripts/generate-brand-assets.mjs public/favicon-source.png
 *   node scripts/generate-brand-assets.mjs --from-logo public/logo.svg
 *
 * Source priority: CLI path → favicon-source.* → favicon.ico → logo-source.* (footers excluded)
 */

import { spawnSync } from 'node:child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = process.cwd()
const publicDir = path.join(projectRoot, 'public')

// Resilient Sharp & to-ico Loader
let sharp, toIco
try {
  const req = createRequire(path.join(process.cwd(), 'package.json'))
  sharp = req('sharp')
  toIco = req('to-ico')
} catch {
  try {
    const s = await import('sharp')
    sharp = s.default || s
    const t = await import('to-ico')
    toIco = t.default || t
  } catch {
    try {
      const req = createRequire(import.meta.url)
      sharp = req('sharp')
      toIco = req('to-ico')
    } catch {
      console.error('[generate-brand-assets] Error: sharp and to-ico are required.')
      process.exit(1)
    }
  }
}

const FAVICON_SOURCE_NAMES = ['favicon-source.ico', 'favicon-source.png', 'favicon-source.jpg', 'favicon-source.svg']
const FAVICON_FALLBACK_NAMES = [
  'favicon.ico',
  'favicon.png',
  'favicon-32x32.png',
  'favicon wealthcare.ico',
  'images/favicon.ico',
  'images/favicon.png',
]
const LOGO_SOURCE_NAMES = [
  'logo-source.svg', 'logo-source.png', 'logo-source.jpg',
  'images/logo.svg', 'images/logo.png',
  'logo.svg', 'logo.png'
]
const FOOTER_EXCLUDE_RE = /footer|bottom|legal|disclaimer|copyright|partner|sponsor|badge/i

function parseArgs(argv) {
  let cliPath = null
  let forceLogo = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--from-logo') {
      forceLogo = true
      cliPath = argv[i + 1]
      if (!cliPath) {
        console.error('--from-logo requires a path argument')
        process.exit(1)
      }
      i++
      continue
    }
    if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`)
      process.exit(1)
    }
    cliPath = arg
  }
  return { cliPath, forceLogo }
}

async function rasterizeSvg(svgPath) {
  const outPng = path.join(publicDir, 'logo-source-raster.png')
  try {
    await sharp(svgPath)
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(outPng)
    return outPng
  } catch (err) {
    if (process.platform === 'darwin') {
      const result = spawnSync('qlmanage', ['-t', '-s', '512', '-o', publicDir, svgPath], {
        encoding: 'utf-8',
      })
      const generated = path.join(publicDir, `${path.basename(svgPath)}.png`)
      if (fs.existsSync(generated)) {
        fs.renameSync(generated, outPng)
        return outPng
      }
    }
    console.error(`SVG rasterize failed: ${svgPath}\n`, err)
    process.exit(1)
  }
}

async function prepareSource(sourcePath) {
  if (sourcePath.toLowerCase().endsWith('.svg')) {
    return await rasterizeSvg(sourcePath)
  }
  return sourcePath
}

function classifyKind(sourcePath, forceLogo) {
  if (forceLogo) return 'logo fallback'
  const name = path.basename(sourcePath).toLowerCase()
  if (name.includes('favicon') || FAVICON_SOURCE_NAMES.includes(name)) return 'favicon'
  if (name.includes('logo') || LOGO_SOURCE_NAMES.includes(name)) return 'logo fallback'
  return 'favicon'
}

function globFaviconCandidates() {
  const found = []
  if (!fs.existsSync(publicDir)) return found
  for (const name of fs.readdirSync(publicDir)) {
    if (FOOTER_EXCLUDE_RE.test(name)) continue
    const lower = name.toLowerCase()
    if (!lower.includes('favicon')) continue
    if (!lower.endsWith('.ico') && !lower.endsWith('.png')) continue
    if (FAVICON_SOURCE_NAMES.includes(name)) continue
    found.push(path.join(publicDir, name))
  }
  return found.sort()
}

async function resolveSource(cliPath, forceLogo) {
  if (cliPath) {
    const p = path.isAbsolute(cliPath) ? cliPath : path.join(process.cwd(), cliPath)
    if (!fs.existsSync(p)) {
      console.error(`Source not found: ${p}`)
      process.exit(1)
    }
    const prepared = await prepareSource(p)
    return { source: prepared, kind: classifyKind(p, forceLogo) }
  }

  for (const name of FAVICON_SOURCE_NAMES) {
    const p = path.join(publicDir, name)
    if (fs.existsSync(p)) {
      return { source: await prepareSource(p), kind: 'favicon' }
    }
  }

  for (const name of FAVICON_FALLBACK_NAMES) {
    const p = path.join(publicDir, name)
    if (fs.existsSync(p)) {
      return { source: await prepareSource(p), kind: 'favicon' }
    }
  }

  for (const p of globFaviconCandidates()) {
    return { source: await prepareSource(p), kind: 'favicon' }
  }

  for (const name of LOGO_SOURCE_NAMES) {
    const p = path.join(publicDir, name)
    if (fs.existsSync(p)) {
      return { source: await prepareSource(p), kind: 'logo fallback' }
    }
  }

  console.error(
    'Missing source. Add public/favicon-source.ico, public/favicon.ico, or pass a path.\n' +
      'See BRAND_ICONS.md'
  )
  process.exit(1)
}

async function resizePng(source, size, outName) {
  const out = path.join(publicDir, outName)
  await sharp(source).resize(size, size, { fit: 'fill' }).png({ compressionLevel: 9 }).toFile(out)
  console.log(`Wrote ${outName} (${size}x${size})`)
}

async function resizeBuffer(source, size) {
  return sharp(source).resize(size, size, { fit: 'fill' }).png().toBuffer()
}

async function main() {
  const { cliPath, forceLogo } = parseArgs(process.argv.slice(2))
  const { source, kind } = await resolveSource(cliPath, forceLogo)
  console.log(`Source: ${source} (${kind})`)

  await resizePng(source, 32, 'favicon.png')
  await resizePng(source, 32, 'favicon-32x32.png')
  await resizePng(source, 32, 'icon-32x32.png')
  await resizePng(source, 48, 'icon-48x48.png')
  await resizePng(source, 180, 'apple-touch-icon.png')

  const icoPngs = await Promise.all([
    resizeBuffer(source, 16),
    resizeBuffer(source, 32),
    resizeBuffer(source, 48),
  ])
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), await toIco(icoPngs))
  console.log('Wrote favicon.ico (16, 32, 48)')
  console.log(
    '\nSocial preview: point openGraph.images at your header logo (see BRAND_ICONS.md).'
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
