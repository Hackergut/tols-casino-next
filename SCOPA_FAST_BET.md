# Scopa Siciliana — Fast Bet

Minigioco da casinò "Fast Bet" sulla Scopa Siciliana: il giocatore **non gioca a
Scopa**, scommette sull'esito di una partita automatica tra due mani virtuali
(**Giocatore** e **Banco**) con strategia fissa e pubblica. L'intera partita è
una funzione pura di un mazzo mescolato con il flusso provably-fair
(HMAC-SHA256), quindi ogni round è verificabile a posteriori.

---

## 1. Regole implementate (strategia fissa e pubblica)

Mazzo da 40 carte siciliane (Denari, Coppe, Spade, Bastoni × 1…10, con
Donna=8, Cavallo=9, Re=10). Valori Primiera storici (7→21, 6→18, Asso→16, …).

Per ogni giocata, in ordine di priorità:

1. **Scopa** — catturare tutte le carte del tavolo, se possibile;
2. **Settebello** — altrimenti catturare il 7 di Denari, se possibile;
3. altrimenti, tra tutte le catture legali, quella con **più Denari**, poi
   (a parità) **maggior valore totale** catturato;
4. altrimenti **scarta la carta più bassa** (valore, poi seme).

Punteggio (§1.3 della specifica): +1 a chi prende più carte, +1 a chi prende
più Denari, +1 al Settebello, +1 alla Primiera più alta, +1 per ogni Scopa.
Parità in una categoria = nessun punto. Totale uguale → **Pareggio (X)**.

### Correzione alla specifica originale

La bozza di codice aveva un bug di dominio: a fine partita le carte rimaste sul
tavolo non venivano assegnate, quindi potevano restare **non catturate** (e il
Settebello poteva non appartenere a nessuno, invalidando la categoria
"Settebello" e i conteggi carte/denari). È stata applicata la **regola standard
della Scopa**: chi ha fatto l'ultima cattura prende le carte rimanenti (fallback
al Banco se nessuno ha mai catturato). Con questa regola il Settebello appartiene
sempre a esattamente uno dei due. Nel ~93,5% dei round avviene questo "sweep"
finale, quindi l'impatto sul calcolo delle probabilità è rilevante.

---

## 2. Mercati e quote

Simulazione Monte Carlo con **N = 10.000.000** round (≈36.850 round/s), usando
**lo stesso motore** che esegue le scommesse reali (`src/lib/scopa.ts`).
Errore standard ≈ 0,0001–0,00016 per mercato.

| Mercato | Probabilità p | SE | p_lower (95%) | p_upper (95%) |
|---|---|---|---|---|
| 1 · Giocatore | 0,41702 | 0,00016 | 0,41672 | 0,41733 |
| 2 · Banco | 0,47778 | 0,00016 | 0,47747 | 0,47809 |
| X · Pareggio | 0,10520 | 0,00010 | 0,10501 | 0,10539 |
| Over 4.5 | 0,69811 | 0,00015 | 0,69782 | 0,69839 |
| Under 4.5 | 0,30189 | 0,00015 | 0,30161 | 0,30218 |
| Settebello Giocatore | 0,51110 | 0,00016 | 0,51079 | 0,51141 |
| Settebello Banco | 0,48890 | 0,00016 | 0,48859 | 0,48921 |
| Scopa Over 0.5 | 0,78485 | 0,00013 | 0,78459 | 0,78510 |

Il Banco (secondo di mano) ha un vantaggio strutturale reale (47,8% vs 41,7%),
coerente con la dinamica nota della Scopa a due.

### Quote finali (in produzione, `SCOPA_ODDS` in `src/lib/scopa.ts`)

`quota = floor(0.96 / p_upper)`, dove `p_upper` è il limite **superiore**
dell'intervallo di confidenza al 95%.

| Mercato | Quota (floor 2dp) | RTP effettivo (worst-case) |
|---|---|---|
| 1 · Giocatore | **2,30** | 95,99% |
| 2 · Banco | **2,00** | 95,62% |
| X · Pareggio | **9,10** | 95,90% |
| Over 4.5 | **1,37** | 95,68% |
| Under 4.5 | **3,17** | 95,79% |
| Settebello Giocatore | **1,87** | 95,63% |
| Settebello Banco | **1,96** | 95,89% |
| Scopa Over 0.5 | **1,22** | 95,78% |

> **Nota sul margine.** La sezione 3 della specifica suggeriva di usare il
> *limite inferiore* dell'IC "per garantire il margine del banco". È il verso
> opposto: `quota = 0.96/p` fa crescere la quota al **diminuire** di p, quindi
> con p_lower il player verrebbe pagato di più e l'RTP potrebbe superare il
> target. Con p_upper invece vale sempre `RTP = p_true × quota ≤ p_upper × quota
> ≤ 0.96`, quindi il margine del banco è garantito. La tabella con il lower-bound
> differisce di 1 centesimo solo su Banco (2,01), Pareggio (9,14) e Under (3,18).

---

## 3. Provably fair

Stesso schema commit-reveal della piattaforma (`src/lib/provably-fair.ts`):

1. Il server pubblica `SHA-256(serverSeed)` prima della scommessa.
2. `nonce` incrementale per round.
3. `float(cursor) = HMAC-SHA256(serverSeed, clientSeed:nonce:cursor) / 2^52`.
4. Il mazzo è mescolato con **Fisher-Yates** usando 39 float (cursor 0…38).
5. La partita è una pura funzione del mazzo → **riproducibile**.

Verifica: `PUT /api/fair` con `{ game: "scopa", serverSeed, clientSeed, nonce }`
rigioca il round e restituisce mazzo, mosse e punteggio; con `market` restituisce
anche l'esito e la quota. Il payload di ogni bet contiene già mazzo + traccia
completa delle giocate + punteggi.

---

## 4. File

| File | Ruolo |
|---|---|
| `src/lib/scopa.ts` | Motore deterministico (mazzo, strategia, punteggio, mercati, quote) + `timeline` di replay |
| `src/lib/scopa-playback.ts` | Reducer puro per ricostruire il tavolo dal `timeline` (condiviso dalle due UI) |
| `src/app/api/bets/route.ts` | Caso `"scopa"` nel motore scommesse (risoluzione + payout + timeline) |
| `src/app/api/fair/route.ts` | Replay di verifica `PUT /api/fair` |
| `src/casino/components/casino/games/GamePlayer.tsx` | UI nel casino incorporato (admin) |
| `src/components/casino/game-scopa.tsx` | UI nel casino pubblico (`/`) |
| `src/app/globals.css` | Blocco `.scopa-*` (tavolo, carte, scoreboard, overlay) nel design system |
| `src/app/page.tsx` | Registrazione del gioco nel casino pubblico |
| `src/components/lobby/lobby-types.ts` | Voce in `ORIGINAL_GAMES` |
| `src/casino/components/casino/sections/Lobby.tsx` | Icona nella riga Originals |
| `public/games/originals/scopa.svg` | Immagine catalogo |
| `scripts/seed-scopa.mjs` | Registra il gioco in `casinoGame` |
| `scripts/scopa-sim.mjs` | Simulatore Monte Carlo (riusa il motore) |

### UX / animazioni

Il server restituisce l'intera `timeline` (eventi di **distribuzione** + **giocata**).
Il client la rigioca come partita dal vivo, senza reimplementare la strategia
(reducer puro in `scopa-playback.ts`): carte distribuite con stagger, carte che
"volano" dal tavolo/mani ai mazzetti tramite `layoutId` di framer-motion, flash
"SCOPA!" / "RACCOLTA", tally progressivo delle 5 categorie di punteggio e banner
finale Vittoria/Sconfitta/Pareggio. Tasto **Salta** e `prefers-reduced-motion`
per accorciare la replay. Entrambe le superfici (casino pubblico e casino
incorporato nell'admin) condividono lo stesso reducer e le stesse regole, con i
token di design della rispettiva superficie (`--g-*` vs `--color-*`).

---

## 5. Operatività

```bash
# 1. registra il gioco nel catalogo (upsert idempotente)
node scripts/seed-scopa.mjs

# 2. ricalcola probabilità/quote (Node ≥ 22.6)
node --experimental-strip-types scripts/scopa-sim.mjs 10000000

# 3. verifica tipo/lingua
npx tsc --noEmit && npx eslint src/lib/scopa.ts src/components/casino/game-scopa.tsx
```

## 6. Lancio live — runbook

In ordine, su un ambiente con accesso di rete (Vercel/Supabase — nel sandbox
locale il download dei binari Prisma è bloccato):

```bash
# 1. Install (esegue anche "postinstall: prisma generate")
npm install

# 2. Database: applica lo schema (crea/aggiorna tutte le tabelle, incl. CasinoGame)
npm run db:push        # oppure "prisma migrate deploy" se usi le migrazioni

# 3. Bootstrap operatore admin (necessario per /control/admin)
node scripts/seed-admin.mjs --email=ops@tols.gg --password=Secret123

# 4. Registra il gioco nel catalogo (upsert idempotente)
node scripts/seed-scopa.mjs

# 5. Build + avvio
npm run build
npm run start
```

Configurazione `.env` minima (vedi `.env.example`): `DATABASE_URL`, `DIRECT_URL`,
`APP_URL`, `ADMIN_SESSION_SECRET`, `CRON_SECRET`. Lascia `ALLOW_OUTCOME_CONTROL=false`
in produzione (disattiva i force win/lose — vedi `src/lib/game-control.ts`).

### Verifica end-to-end

1. **Lobby pubblico (`/`)** → sezione *TOLS Originals* → card **Scopa Siciliana**
   (immagine `public/games/originals/scopa.jpg`).
2. Apri il gioco → scegli mercato (1X2 / Over-Under / Settebello / Scope) → punta:
   la partita automatica si anima (distribuzione, catture, flash "SCOPA!") e il
   risultato viene mostrato con tally delle 5 categorie.
3. **Admin** → *Casino Lobby* → Scopa (stesso motore, UI con i token admin) e
   *Games Catalog* per toggling/RTP (la riga ha `gameType: "original"`,
   `category: "originals"`, `alias: "scopa"`).
4. **Provably fair**: la bet restituisce `serverSeedHash`/`clientSeed`/`nonce`;
   dopo la rotazione dei seed (`POST /api/fair {rotate:true}`), `PUT /api/fair`
   con `{game:"scopa", serverSeed, clientSeed, nonce}` rigioca il round e
   restituisce mazzo + mosse + punteggio da confrontare con il payload salvato.
5. **Flussi generici già attivi per Scopa**: live bets feed, bet history,
   house earnings, jackpot (+0,5% stake), VIP/XP sync, rate limit e limiti di
   gioco responsabile.

### Integrazioni completate per il lancio

- **Build sbloccata**: creato il modulo admin mancante
  `src/components/admin/modules/deposit-addresses-page.tsx` (era referenziato da
  `control/admin` e assente → bloccava `next build`); corretto il tipo del
  tooltip Recharts in `ops/live-monitor-page.tsx` (errori di tipo bloccano il
  build su Vercel, dove `ignoreBuildErrors=false`).
- **`/api/games`**: la risposta ora include `slug` e `image` (alias di
  `alias`/`imageUrl`) così il casino incorporato nell'admin (Lobby, GamesGrid,
  Sidebar) mappa correttamente i giochi, Scopa inclusa.
- **Sidebar** casino: voce "Scopa" aggiunta a *TOLS Originals*.
- **Asset**: `scopa.jpg`/`scopa.png` rasterizzati da `scopa.svg` (la card lobby
  non fa fallback/404).

## 7. Certificazione (produzione)

Come da specifica §6.2: per la messa in produzione reale rifare la simulazione
con N ≥ 100.000.000, congelare le quote, e far certificare RTP/RNG/audit dei seed
da laboratorio accreditato (GLI/BMM/eCOGRA), con storico dei round e strumenti di
gioco responsabile già presenti in piattaforma.
