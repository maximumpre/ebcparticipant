/**
 * Edge-safe SHA-256 / HMAC-SHA256 / timing-safe compare.
 *
 * Middleware / proxy run on the Edge Runtime where `node:crypto` is banned
 * (Vercel: UnhandledSchemeError / unsupported modules). This module is sync
 * and works in Edge + Node without changing grant-token call sites.
 */

const encoder = new TextEncoder()

function toBytes(input: string | Uint8Array): Uint8Array {
  return typeof input === "string" ? encoder.encode(input) : input
}

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n))
}

/** SHA-256 → 32-byte digest (pure JS; Edge + Node). */
export function sha256Bytes(input: string | Uint8Array): Uint8Array {
  const data = toBytes(input)
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ])

  let h0 = 0x6a09e667
  let h1 = 0xbb67ae85
  let h2 = 0x3c6ef372
  let h3 = 0xa54ff53a
  let h4 = 0x510e527f
  let h5 = 0x9b05688c
  let h6 = 0x1f83d9ab
  let h7 = 0x5be0cd19

  const bitLen = data.length * 8
  const withPad = data.length + 1 + 8
  const total = Math.ceil(withPad / 64) * 64
  const msg = new Uint8Array(total)
  msg.set(data)
  msg[data.length] = 0x80
  const view = new DataView(msg.buffer)
  // length in bits as 64-bit big-endian at end
  const high = Math.floor(bitLen / 0x100000000)
  const low = bitLen >>> 0
  view.setUint32(total - 8, high, false)
  view.setUint32(total - 4, low, false)

  const w = new Uint32Array(64)
  for (let i = 0; i < total; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] = view.getUint32(i + j * 4, false)
    }
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(7, w[j - 15]) ^ rotr(18, w[j - 15]) ^ (w[j - 15] >>> 3)
      const s1 = rotr(17, w[j - 2]) ^ rotr(19, w[j - 2]) ^ (w[j - 2] >>> 10)
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0
    }

    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    let f = h5
    let g = h6
    let h = h7

    for (let j = 0; j < 64; j++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + S1 + ch + K[j] + w[j]) >>> 0
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) >>> 0

      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
    h5 = (h5 + f) >>> 0
    h6 = (h6 + g) >>> 0
    h7 = (h7 + h) >>> 0
  }

  const out = new Uint8Array(32)
  const outView = new DataView(out.buffer)
  outView.setUint32(0, h0, false)
  outView.setUint32(4, h1, false)
  outView.setUint32(8, h2, false)
  outView.setUint32(12, h3, false)
  outView.setUint32(16, h4, false)
  outView.setUint32(20, h5, false)
  outView.setUint32(24, h6, false)
  outView.setUint32(28, h7, false)
  return out
}

export function sha256Hex(input: string | Uint8Array): string {
  return bytesToHex(sha256Bytes(input))
}

/** HMAC-SHA256 → hex digest. */
export function hmacSha256Hex(key: string | Uint8Array, data: string | Uint8Array): string {
  const keyBytes = toBytes(key)
  let k = keyBytes
  if (k.length > 64) k = sha256Bytes(k)
  if (k.length < 64) {
    const padded = new Uint8Array(64)
    padded.set(k)
    k = padded
  }

  const oKey = new Uint8Array(64)
  const iKey = new Uint8Array(64)
  for (let i = 0; i < 64; i++) {
    oKey[i] = k[i] ^ 0x5c
    iKey[i] = k[i] ^ 0x36
  }

  const inner = new Uint8Array(64 + toBytes(data).length)
  inner.set(iKey)
  inner.set(toBytes(data), 64)
  const innerHash = sha256Bytes(inner)

  const outer = new Uint8Array(64 + 32)
  outer.set(oKey)
  outer.set(innerHash, 64)
  return bytesToHex(sha256Bytes(outer))
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = ""
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0")
  }
  return hex
}
