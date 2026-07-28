# WhatsApp Onchain Research Bot

Send a token contract address (CA) on WhatsApp, get back a risk report pulling live
data from Dexscreener (price/liquidity/volume) and GoPlus Security (honeypot,
ownership, taxes, holder concentration).

## 1. Set up Meta WhatsApp Cloud API (free)

1. Go to https://developers.facebook.com/ → create an app → add the **WhatsApp** product.
2. In the WhatsApp > API Setup panel, grab:
   - A temporary access token (24h) — for testing. Generate a permanent one later via a System User.
   - Your **Phone Number ID**.
3. Add a test recipient number (your own WhatsApp) under "To" in the API Setup panel.

## 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:
- `WHATSAPP_TOKEN` — from step 1
- `PHONE_NUMBER_ID` — from step 1
- `WEBHOOK_VERIFY_TOKEN` — make up any random string, you'll reuse it in step 4

## 3. Install & run

```bash
npm install
npm start
```

This starts the server on `PORT` (default 3000). Meta needs to reach this
publicly — for local dev, expose it with a tunnel:

```bash
npx ngrok http 3000
```

Copy the `https://...ngrok-free.app` URL it gives you.

## 4. Register the webhook with Meta

In your Meta App > WhatsApp > Configuration:
- **Callback URL**: `https://<your-ngrok-or-server-url>/webhook`
- **Verify Token**: same string you put in `WEBHOOK_VERIFY_TOKEN`
- Subscribe to the `messages` field.

## 5. Test it

Message your WhatsApp test number with a contract address, e.g.:

```
0x2170ed0880ac9a755fd29b2688956bd959f933f
```

You should get an immediate "Researching..." ack, then the full report a few
seconds later.

## Project structure

```
server.js              # webhook + orchestration + rate limiting/caching
services/
  chains.js             # chain detection + Dexscreener->GoPlus chain ID mapping
  dexscreener.js         # price/liquidity/volume data
  goplus.js              # honeypot/ownership/tax/holder security data
  report.js              # risk scoring + WhatsApp message formatting
  whatsapp.js             # Cloud API send/mark-as-read helpers
```

## Known limitations / next steps

- **In-memory cache & rate limiter** — resets on restart, won't scale across
  multiple server instances. Swap `Map()` for Redis when you outgrow one process.
- **GoPlus without an API key** is rate-limited fairly aggressively. Register
  a free key at https://gopluslabs.io/ once volume grows.
- **Solana security data is thinner** than EVM (no honeypot/tax fields from
  GoPlus yet) — consider adding Rugcheck.xyz's API as a second Solana-specific source.
- **Risk scoring is a basic heuristic** — treat it as a starting weight system,
  not a validated model. Log real outcomes and tune the weights over time.
- **No persistent storage** — nothing is saved between restarts. Add a DB
  (Postgres/SQLite) once you want user watchlists or alert subscriptions.
- **No LP-lock verification beyond GoPlus's own flag** — for higher confidence,
  cross-check against Unicrypt/Team Finance lockers directly.
