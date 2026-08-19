# Pool Rush — Fast Break

Pool Rush is a server-settled TOLS Original with four volatility profiles and a fixed 96% theoretical RTP. It uses the platform's shared atomic wallet and provably-fair HMAC stream; it does not introduce a second balance or RNG endpoint.

## Round API

- `POST /api/bets` with `{ "game": "poolrush", "amount": 1, "payload": { "level": "intermediate" } }`
- `GET /api/games/poolrush/config` publishes limits, RTP and every paytable.
- `POST /api/games/poolrush/verify` recomputes the outcome after a server seed has been revealed.
- `GET/POST/PUT /api/fair` manages commitments, rotation and generic verification.

The active server seed is never revealed with a live round. Its SHA-256 commitment is returned before rotation; rotating retires and reveals the old seed so its rounds can be audited.

## Certified-math candidate tables

The product brief's non-intermediate probabilities were explicitly indicative and did not equal 96%. These are the calibrated server tables:

| Level | Hit frequency | Maximum | Animation | RTP |
| --- | ---: | ---: | ---: | ---: |
| Beginner | 50% | 10× | 1.30s | 96.00% |
| Intermediate | 35% | 30× | 1.45s | 96.00% |
| Expert | 25% | 100× | 1.65s | 96.00% |
| Pro | 15% | 500× | 1.80s | 96.00% |

Exact probabilities are exported by `src/lib/pool-rush.ts`. Automated tests assert that every row sums to one and every expected value is exactly 0.96.

## Reveal contract

The server settles immediately. The client stores the returned outcome privately, starts the level-specific break animation, and only commits result text to React state in the post-animation timer. Reduced-motion/Quick Play uses a 320ms state transition; standard rounds finish within 1.8 seconds.

Dragging vertically on the table adjusts the cue angle cosmetically. It is deliberately absent from the request body and cannot affect the server outcome.

## Limits and practice

Paid Pool Rush stakes are 0.10–100 USDT. The shared empty-wallet practice mode may send zero and can never create a payout or ledger entry. Paid rounds use the same transaction, rate limit, feed, leaderboard and tournament projection as every other Original.

Third-party GLI/iTech/BMM certification remains an external operational step; passing internal simulation and deterministic tests is not represented as laboratory certification.
