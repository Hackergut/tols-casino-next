# Tower — cosa incollare nell'ALTRO repo (governance tower)

Questo repo è l'ALTRO progetto Vercel su sottodominio (es. `tower.tols.fun`).
Copia i file qui sotto nel repo della Tower per completare il ponte Casino ↔ Tower.

## 1. Env su Vercel Tower (Settings → Environment Variables → Production)

```
GOVERNANCE_TOWER_URL=https://tower.tols.fun
APP_URL=https://tols.fun
GOVERNANCE_BRIDGE_SECRET=<stesso secret del Casino — openssl rand -hex 32>
# opzionale se la Tower chiama il Casino via bridgeFetch:
TOLS_API_KEY / TOLS_APP_KEY (se richieste)
```

Redeploy dopo aver salvato.

## 2. Copia `src/lib/governance-bridge.ts` dal Casino

Prendi `src/lib/governance-bridge.ts` da `tols-casino-next` e incollalo in `src/lib/governance-bridge.ts` nella Tower.
È già compatibile con entrambi i lati (usa `GOVERNANCE_TOWER_URL` / `APP_URL` / `GOVERNANCE_BRIDGE_SECRET`).

## 3. Route Tower (Next.js — incolla in `src/app/api/bridge/`)

Crea 3 route speculari. Se la Tower non è Next.js, replica solo la logica HMAC.

### `src/app/api/bridge/health/route.ts` (Tower)
```ts
import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ ok: true, service: "tower-bridge", tower: process.env.GOVERNANCE_TOWER_URL || process.env.TOWER_URL, casino: process.env.APP_URL, ts: new Date().toISOString() });
}
```

### `src/app/api/bridge/events/route.ts` (Tower ← Casino)
```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyBridgeSignature } from "@/lib/governance-bridge";
function getSig(req: NextRequest) { return req.headers.get("x-bridge-signature") || req.headers.get("x-webhook-signature") || null; }
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = getSig(req);
  // In prod richiedi HMAC; in dev puoi accettare ping senza firma se preferisci
  if (!verifyBridgeSignature(raw, sig)) return NextResponse.json({ success: false, error: "Invalid bridge signature" }, { status: 401 });
  const body = JSON.parse(raw);
  console.log("[tower bridge/event]", body.type, body.payload);
  // TODO: persisti evento, aggiorna dashboard Tower, ecc.
  return NextResponse.json({ success: true, accepted: true });
}
```

### `src/app/api/bridge/webhook/route.ts` — per push Tower → Casino (Tower è client)
Non serve route, è il Casino che espone `/api/bridge/webhook`. Dalla Tower invia:
```ts
import { signBridgePayload } from "@/lib/governance-bridge";
export async function pushToCasino(type: string, payload: Record<string, unknown>) {
  const raw = JSON.stringify({ type, payload });
  const sig = signBridgePayload(raw);
  const res = await fetch(`${process.env.APP_URL || "https://tols.fun"}/api/bridge/webhook`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Bridge-Signature": `sha256=${sig}` }, body: raw
  });
  return res.json();
}
// Esempio:
await pushToCasino("ping", {});
await pushToCasino("governance.player_block", { userId: "xxx", blocked: true });
```

## 4. CSP / CORS sulla Tower (Next.js)

In `next.config.ts` della Tower aggiungi l'origin del Casino:
```ts
const CASINO_ORIGIN = (process.env.APP_URL || process.env.CASINO_URL || "https://tols.fun").replace(/\/$/, "");
// CSP: connect-src 'self' https://tols.fun https://*.vercel.app
// CORS su /api/bridge/*: Access-Control-Allow-Origin: https://tols.fun
```

## 5. Vercel Domains — Tower sottodominio

Vercel Tower → Settings → Domains → Add `tower.tols.fun` (o `governance.tols.fun`)
Hostinger DNS → CNAME `tower` → `cname.vercel-dns.com` (valore esatto mostrato da Vercel).
Attendi TLS verde, poi verifica:
```bash
curl https://tower.tols.fun/api/bridge/health | jq .
curl -X POST https://tower.tols.fun/api/bridge/events -H "Content-Type: application/json" -H "X-Bridge-Signature: sha256=..." -d '{"type":"ping","payload":{}}' | jq .
```
