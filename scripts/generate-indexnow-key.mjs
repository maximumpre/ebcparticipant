#!/usr/bin/env node
/**
 * Cryptographic IndexNow Key Generator
 *
 * Generates a fresh, pristine 32-character hexadecimal key and writes it
 * directly to public/{key}.txt for Bing/Yandex index verification.
 * Guarantees zero key reuse between deployments.
 *
 * Usage:
 *   node scripts/generate-indexnow-key.mjs [target-dir]
 */

import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync, readdirSync, unlinkSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const dirArg = args.find((a) => !a.startsWith("--"));
const targetDir = resolve(dirArg || process.cwd());
const publicDir = join(targetDir, "public");

if (!isDryRun && !existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true });
}

// Remove any existing indexnow key files in public (32-hex.txt)
const hexKeyRegex = /^[0-9a-fA-F]{32}\.txt$/;
if (existsSync(publicDir)) {
  const existingFiles = readdirSync(publicDir);
  for (const file of existingFiles) {
    if (hexKeyRegex.test(file)) {
      if (!isDryRun) {
        unlinkSync(join(publicDir, file));
        console.log(`[IndexNow] Removed old key file: public/${file}`);
      } else {
        console.log(`[IndexNow] (dry-run) Would remove old key file: public/${file}`);
      }
    }
  }
}

// Generate new 32-character hex key
const newKey = randomBytes(16).toString("hex");
const keyFilePath = join(publicDir, `${newKey}.txt`);

if (!isDryRun) {
  writeFileSync(keyFilePath, newKey, "utf8");
}

console.log(`✅ [IndexNow] Generated fresh key: ${newKey}`);
console.log(`📁 [IndexNow] ${isDryRun ? "(dry-run) Target:" : "Written to:"} public/${newKey}.txt`);
console.log(`🔑 [IndexNow] Bind this key to INDEXNOW_KEY in .env.local and lib/site-url.ts`);
