/**
 * Shared .env loader for kit Node scripts.
 *
 * Loads env files in priority order (defaults: `.env.local` → `.env`),
 * strips surrounding single/double quotes from values, and never overrides
 * an explicit `process.env` value already set by the shell.
 *
 * Usage:
 *   import { loadEnvFiles, getEnvVar } from "./lib/env-loader.mjs"
 *   loadEnvFiles(root)               // defaults: .env.local, .env
 *   loadEnvFiles(root, [".env.local", ".env.production", ".env"])
 *   const flag = getEnvVar("SITE_ORIGIN_ALLOW_APEX")
 */

import fs from "node:fs"
import path from "node:path"

const DEFAULT_ORDER = [".env.local", ".env"]

/** Strip one pair of surrounding quotes (single or double) from a value. */
function stripQuotes(value) {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1)
  }
  return value
}

/**
 * Parse dotenv-style lines: `KEY=value`, ignoring comments and blanks.
 * Inline comments after a value are NOT supported (values are kept verbatim
 * apart from quote stripping) to avoid truncating legitimate values.
 */
export function parseEnvText(text) {
  const parsed = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx <= 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const raw = trimmed.slice(eqIdx + 1).trim()
    parsed[key] = stripQuotes(raw)
  }
  return parsed
}

/**
 * Load the given env files (in order) into process.env.
 * First file wins per key; existing process.env values are never overridden.
 * Missing files are skipped silently.
 * @param {string} root project root directory that contains the env files
 * @param {string[]} [files] file names relative to root (default `.env.local`, `.env`)
 */
export function loadEnvFiles(root, files = DEFAULT_ORDER) {
  for (const file of files) {
    const fullPath = path.join(root, file)
    try {
      if (!fs.existsSync(fullPath)) continue
      const parsed = parseEnvText(fs.readFileSync(fullPath, "utf8"))
      for (const [key, value] of Object.entries(parsed)) {
        if (process.env[key] === undefined) process.env[key] = value
      }
    } catch {
      // unreadable file — try the next candidate
    }
  }
}

/**
 * Load the default env files for `root` (once per call site) and return the
 * value of `name` from the merged process.env (shell > .env.local > .env).
 * @param {string} name env var name
 * @param {string} [root] project root containing the env files (default: cwd)
 */
export function getEnvVar(name, root = process.cwd()) {
  loadEnvFiles(root)
  return process.env[name]
}
