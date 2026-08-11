import { createHmac, randomBytes, timingSafeEqual } from "crypto";

// TOTP per RFC 6238 (HMAC-SHA1, 30s step, 6 digits) + base32 (RFC 4648).
// No external dependency: uses only node:crypto, so 2FA can ship without
// adding an authenticator library to the bundle.

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str: string): Buffer {
  const clean = str.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (const c of clean) {
    const idx = BASE32.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secretBase32: string, counter: number, digits = 6): string {
  const key = base32Decode(secretBase32);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return (code % 10 ** digits).toString().padStart(digits, "0");
}

export function totp(secretBase32: string, timeMs = Date.now(), step = 30): string {
  return hotp(secretBase32, Math.floor(timeMs / 1000 / step));
}

export function verifyTotp(secretBase32: string, token: string, window = 1, timeMs = Date.now(), step = 30): boolean {
  if (!secretBase32 || !/^\d{6}$/.test(token)) return false;
  const counter = Math.floor(timeMs / 1000 / step);
  for (let w = -window; w <= window; w++) {
    const expected = hotp(secretBase32, counter + w);
    if (expected.length === token.length && timingSafeEqual(Buffer.from(expected), Buffer.from(token))) return true;
  }
  return false;
}

export function provisioningUri(issuer: string, account: string, secretBase32: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
