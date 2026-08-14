#!/usr/bin/env node

/**
 * Fails the build if LAYOUT_DESCRIPTION is outside 25–170 chars.
 * Checks lib/meta-description.ts or src/lib/meta-description.ts.
 */

import { access, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const CANDIDATES = [
  path.join(ROOT, "lib", "meta-description.ts"),
  path.join(ROOT, "src", "lib", "meta-description.ts"),
];
const MIN_LEN = 25;
const MAX_LEN = 170;

async function main() {
  let metaFile = null;
  for (const candidate of CANDIDATES) {
    try {
      await access(candidate);
      metaFile = candidate;
      break;
    } catch {
      // try next
    }
  }

  if (!metaFile) {
    console.error(
      "Meta description check failed: lib/meta-description.ts not found.",
    );
    process.exit(1);
  }

  const source = await readFile(metaFile, "utf8");
  const match = source.match(
    /export const LAYOUT_DESCRIPTION\s*=\s*(["'`])([\s\S]*?)\1/,
  );
  if (!match) {
    console.error("Meta description check failed: LAYOUT_DESCRIPTION not found.");
    process.exit(1);
  }

  const description = match[2].replace(/\\n/g, " ").trim();
  const length = description.length;

  if (length < MIN_LEN || length > MAX_LEN) {
    console.error(
      `Meta description check failed: LAYOUT_DESCRIPTION is ${length} chars (must be ${MIN_LEN}–${MAX_LEN}).`,
    );
    console.error(`  "${description}"`);
    process.exit(1);
  }

  console.log(`Meta description check passed (${length} chars).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
