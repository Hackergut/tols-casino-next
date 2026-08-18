import test from "node:test";
import assert from "node:assert/strict";
import { base32Encode, base32Decode, totp, verifyTotp, generateSecret, provisioningUri } from "../src/lib/totp.ts";

test("base32Encode works with RFC 4648 test vectors", () => {
  // Test vectors from RFC 4648
  assert.equal(base32Encode(Buffer.from("")), "");
  assert.equal(base32Encode(Buffer.from("f")), "MY");
  assert.equal(base32Encode(Buffer.from("fo")), "MZXQ");
  assert.equal(base32Encode(Buffer.from("foo")), "MZXW6");
  assert.equal(base32Encode(Buffer.from("foob")), "MZXW6YQ");
  assert.equal(base32Encode(Buffer.from("fooba")), "MZXW6YTB");
  assert.equal(base32Encode(Buffer.from("foobar")), "MZXW6YTBOI");
});

test("base32Decode works with RFC 4648 test vectors", () => {
  // Test vectors from RFC 4648
  assert.equal(base32Decode("").toString(), "");
  assert.equal(base32Decode("MY").toString(), "f");
  assert.equal(base32Decode("MZXQ").toString(), "fo");
  assert.equal(base32Decode("MZXW6").toString(), "foo");
  assert.equal(base32Decode("MZXW6YQ").toString(), "foob");
  assert.equal(base32Decode("MZXW6YTB").toString(), "fooba");
  assert.equal(base32Decode("MZXW6YTBOI").toString(), "foobar");
});

test("base32Decode strips padding and ignores whitespace/case", () => {
  assert.equal(base32Decode("MZXW6YTBOI======").toString(), "foobar");
  assert.equal(base32Decode("MZXW6YTBOI====").toString(), "foobar");
  assert.equal(base32Decode("mzxw6ytboi").toString(), "foobar");
  assert.equal(base32Decode("MZXW 6YTB OI==").toString(), "foobar");
  assert.equal(base32Decode(" MZ X W6 \nYT B OI\t").toString(), "foobar");
});

test("generateSecret produces correct format and length", () => {
  const secret = generateSecret();
  assert.match(secret, /^[A-Z2-7]+$/);
  // 20 bytes random = 160 bits = 32 base32 characters
  assert.equal(secret.length, 32);
});

test("totp generates correctly based on time", () => {
  // Use a fixed secret for testing
  const secret = base32Encode(Buffer.from("12345678901234567890"));

  // RFC 6238 test vectors for HMAC-SHA1
  // Secret: "12345678901234567890" -> GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ

  assert.equal(totp(secret, 59 * 1000), "287082");
  assert.equal(totp(secret, 1111111109 * 1000), "081804");
  assert.equal(totp(secret, 1111111111 * 1000), "050471");
  assert.equal(totp(secret, 1234567890 * 1000), "005924");
  assert.equal(totp(secret, 2000000000 * 1000), "279037");
  assert.equal(totp(secret, 20000000000 * 1000), "353130");
});

test("verifyTotp validates correctly", () => {
  const secret = base32Encode(Buffer.from("12345678901234567890"));

  // time: 59s
  const token = "287082";

  // Exact match
  assert.equal(verifyTotp(secret, token, 1, 59 * 1000), true);

  // Acceptable within window (+1 step, 30s)
  // For verifyTotp, timeMs shouldn't result in negative counter
  assert.equal(verifyTotp(secret, token, 1, (59 - 30) * 1000), true);
  assert.equal(verifyTotp(secret, token, 1, (59 + 30) * 1000), true);

  // Reject outside of window (+2 steps, 60s)
  // use a base time of 100000 to avoid negative time / counters
  const baseTimeMs = 100000 * 1000;
  const tokenAtBaseTime = totp(secret, baseTimeMs);

  assert.equal(verifyTotp(secret, tokenAtBaseTime, 1, baseTimeMs - 60 * 1000), false);
  assert.equal(verifyTotp(secret, tokenAtBaseTime, 1, baseTimeMs + 60 * 1000), false);

  // Different window size
  assert.equal(verifyTotp(secret, tokenAtBaseTime, 2, baseTimeMs + 60 * 1000), true);

  // Invalid token format
  assert.equal(verifyTotp(secret, "12345", 1, 59 * 1000), false);
  assert.equal(verifyTotp(secret, "1234567", 1, 59 * 1000), false);
  assert.equal(verifyTotp(secret, "abcdef", 1, 59 * 1000), false);

  // Missing secret
  assert.equal(verifyTotp("", token, 1, 59 * 1000), false);
});

test("provisioningUri outputs expected format", () => {
  const uri = provisioningUri("MyApp", "user@example.com", "MZXW6YTBOI");
  assert.equal(uri, "otpauth://totp/MyApp%3Auser%40example.com?secret=MZXW6YTBOI&issuer=MyApp&algorithm=SHA1&digits=6&period=30");

  // Test encoding of special characters
  const uri2 = provisioningUri("My App", "user+1@example.com", "MZXW6YTBOI");
  assert.equal(uri2, "otpauth://totp/My%20App%3Auser%2B1%40example.com?secret=MZXW6YTBOI&issuer=My%20App&algorithm=SHA1&digits=6&period=30");
});
