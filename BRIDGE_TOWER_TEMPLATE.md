# Governance — what to paste into the `tolsgovernz` repo (https://vercel.com/hackguts-projects/tolsgovernz)

This is the OTHER Vercel project (Governance). The Casino is `tols-casino-next`.

## 1. Env on Vercel Governance (Settings → Environment Variables → Production)

Get REAL domains from Vercel → Settings → Domains (do not invent them):
- Governance: `https://gov.tols.fun` (or custom if you have one)
- Casino: `https://www.tols.fun`

```
GOVERNANCE_TOWER_URL=https://gov.tols.fun
APP_URL=https://www.tols.fun
GOVERNANCE_BRIDGE_SECRET=<same as the Casino — openssl rand -hex 32>
PLATFORM_JWT_PRIVATE_KEY=<private PEM base64 — BLOCK 1 of .env.bridge-keys on casino>
PLATFORM_JWT_ISSUER=tols-governance
PLATFORM_JWT_AUDIENCE=tols-casino
```

## 2. Copy `src/lib/governance-bridge.ts` from the Casino

From `tols-casino-next` → `tolsgovernz`, same file (uses `GOVERNANCE_TOWER_URL` / `APP_URL`).

## 3. Governance route (Next.js)

Create `src/app/api/bridge/events/route.ts` ← Casino → Governance:
```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyBridgeSignature } from "@/lib/governance-bridge";
function getSig(req: NextRequest) { return req.headers.get("x-bridge-signature") || null; }
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyBridgeSignature(raw, getSig(req))) return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
  console.log("[governance event]", JSON.parse(raw));
  return NextResponse.json({ success: true, accepted: true });
}
```

Governance → Casino push:
```ts
import { signBridgePayload } from "@/lib/governance-bridge";
const raw = JSON.stringify({ type: "ping", payload: {} });
const sig = signBridgePayload(raw);
await fetch(`${process.env.APP_URL}/api/bridge/webhook`, {
  method: "POST", headers: { "Content-Type": "application/json", "X-Bridge-Signature": `sha256=${sig}` }, body: raw
});
```

## 4. JWT Governance → Casino (removes the mockups)

Governance signs the JWTs with `PLATFORM_JWT_PRIVATE_KEY` and calls:
```ts
import { createSign, createPrivateKey } from "node:crypto";
function signJWT(payload: object) {
  const header = { alg: "RS256", typ: "JWT" };
  const h = Buffer.from(JSON.stringify(header)).toString("base64url");
  const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const data = `${h}.${p}`;
  const key = createPrivateKey(Buffer.from(process.env.PLATFORM_JWT_PRIVATE_KEY!, "base64").toString("utf8"));
  const s = createSign("RSA-SHA256"); s.update(data); s.end();
  return `${data}.${s.sign(key).toString("base64url")}`;
}
const now = Math.floor(Date.now()/1000);
const jwt = signJWT({ iss: "tols-governance", aud: "tols-casino", sub: "tolsgovernz", iat: now, exp: now+600, scope: ["deposits:read","withdrawals:read"] });
const res = await fetch(`${process.env.APP_URL}/api/platform/deposits?limit=5`, { headers: { Authorization: `Bearer ${jwt}` } });
```

## 5. Domains

There is no need to add `tolsgovernz.vercel.app` — it is already the Vercel domain. If you use a custom domain, add it in Vercel → Settings → Domains on `tolsgovernz` and use that as `GOVERNANCE_TOWER_URL` everywhere.
