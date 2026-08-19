# Governance — cosa incollare nel repo `tolsgovernz` (https://vercel.com/hackguts-projects/tolsgovernz)

Questo è l'ALTRO progetto Vercel (Governance). Casino è `tols-casino-next`.

## 1. Env su Vercel Governance (Settings → Environment Variables → Production)

Prendi domini REALI da Vercel → Settings → Domains (non inventare):
- Governance: `https://gov.tols.fun` (o custom se hai)
- Casino: `https://www.tols.fun` o `https://www.tols.fun`

```
GOVERNANCE_TOWER_URL=https://gov.tols.fun
APP_URL=https://www.tols.fun
GOVERNANCE_BRIDGE_SECRET=<stesso del Casino — openssl rand -hex 32>
PLATFORM_JWT_PRIVATE_KEY=<base64 PEM privato — BLOCCO 1 di .env.bridge-keys su casino>
PLATFORM_JWT_ISSUER=tols-governance
PLATFORM_JWT_AUDIENCE=tols-casino
```

## 2. Copia `src/lib/governance-bridge.ts` dal Casino

Da `tols-casino-next` → `tolsgovernz`, stesso file (usa `GOVERNANCE_TOWER_URL` / `APP_URL`).

## 3. Route Governance (Next.js)

Crea `src/app/api/bridge/events/route.ts` ← Casino → Governance:
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

Push Governance → Casino:
```ts
import { signBridgePayload } from "@/lib/governance-bridge";
const raw = JSON.stringify({ type: "ping", payload: {} });
const sig = signBridgePayload(raw);
await fetch(`${process.env.APP_URL}/api/bridge/webhook`, {
  method: "POST", headers: { "Content-Type": "application/json", "X-Bridge-Signature": `sha256=${sig}` }, body: raw
});
```

## 4. JWT Governance → Casino (elimina mockup)

La Governance firma i JWT con `PLATFORM_JWT_PRIVATE_KEY` e chiama:
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

Non serve aggiungere `tolsgovernz.vercel.app` — è già il dominio Vercel. Se usi custom domain, aggiungilo in Vercel → Settings → Domains su `tolsgovernz` e usa quello come `GOVERNANCE_TOWER_URL` ovunque.
