# CardOps — internal MTG singles ops tool (MVP)

Upload card photos → recognise the exact printing via Scryfall → store each copy in a
chaos-storage slot → price from Cardmarket trend → list on Cardmarket.

Built to prove PMF cheaply: one Next.js app + one Postgres database, both on free tiers.

## Put it online (free, ~15 minutes)

Hosting: **Render** (free web service) + **Neon** (free Postgres). Vercel's free Hobby
plan is not an option — it's restricted to non-commercial use.

**1. Database — Neon**
1. Sign up at neon.tech (no credit card) → create a project, region **Europe (Frankfurt)**.
2. Click **Connect** → copy the connection string. It looks like
   `postgresql://…@ep-….eu-central-1.aws.neon.tech/neondb?sslmode=require`.

**2. App — Render**
1. Sign up at render.com with your GitHub account.
2. **New → Blueprint** → select the `Elschner/Cards` repo. Render reads `render.yaml`.
3. Fill in the values it asks for:
   - `DATABASE_URL` — the Neon string from step 1
   - `APP_PASSWORD` — a password of your choice (plain letters/numbers/symbols, no æøå)
   - `SCRYFALL_USER_AGENT` — e.g. `CardOps/0.1 (you@example.com)`
   - `ANTHROPIC_API_KEY` — optional, from console.anthropic.com (enables photo recognition)
4. **Apply**. The first build takes a few minutes and creates the database tables.
5. Open the `https://cardops-xxxx.onrender.com` URL → log in with `admin` + your password.
   Works on your phone too (bookmark it to the home screen).

Every push to `main` redeploys automatically.

**Free-tier trade-offs**
- The app sleeps after 15 min without use; the first visit after that takes ~1 minute.
  Render's paid Starter instance removes this if it gets annoying.
- Neon free: 1 GB database — hundreds of thousands of inventory rows.
- Card photos are not stored when hosted (no persistent disk on free tier). Recognition
  still works; durable photo storage comes with the grading feature.

## Run locally (optional)

```bash
cp .env.example .env        # DATABASE_URL (Neon — e.g. a separate "dev" branch), SCRYFALL_USER_AGENT
npm install
npx prisma db push          # creates tables
npm run dev                 # http://localhost:3000 (no login if APP_PASSWORD is empty)
npm test                    # pricing, chaos-slot and Cardmarket signing/CSV tests
```

Requires Node 22.6+.

## Daily workflow

1. **Intake** — drop photos (or use phone camera). Claude vision reads name, set code,
   collector number and language from the card; Scryfall resolves the exact printing.
   Correct the printing/condition/language/foil if needed → *Add to inventory*.
   The screen shows the slot, e.g. **B001-0042** — put the card there. No sorting.
2. **Inventory** — filter `IN_STOCK`, select, *Reprice from trend*, then list:
   - **CSV + mark listed** → upload via Cardmarket's bulk listing (see below), or
   - **Push to Cardmarket (API)** if you have API credentials.
3. **Pick list** — when an order arrives, find the card's location, pull it, then
   *Mark sold* in Inventory. The slot is freed and reused by the next intake.

## How the pieces work

| Concern | Where | Notes |
|---|---|---|
| Recognition | `lib/recognize.ts` | Claude vision → JSON (name/set/number/lang) → Scryfall `/cards/{set}/{number}`, fuzzy-name fallback, all printings offered for correction. Manual search if no API key. |
| Card data & prices | `lib/scryfall.ts` | Scryfall EUR prices are sourced from Cardmarket. Non-EN printings fall back to the EN printing's price. Rate-limited to ~9 req/s with proper User-Agent. |
| Chaos storage | `lib/core/chaos.ts`, `lib/inventory.ts` | One DB row per physical copy. First free slot across boxes (default 500/box, `BOX_CAPACITY`). Sold/removed copies free their slot. |
| Pricing | `lib/core/pricing.ts` | Trend × condition multiplier × non-EN discount, €0.15 floor, bulk flag < €0.25. Edit `DEFAULT_RULES`. |
| Cardmarket | `lib/core/cardmarket.ts`, `lib/channels/cardmarket.ts` | CSV export (grouped identical copies) and MKM API 2.0 `POST /stock` with OAuth 1.0 signing, 100 articles per call, dry-run by default. |

## Cardmarket access — read this

Cardmarket's help centre currently states they are **not accepting applications for API
access**. So:

- **Now:** use the CSV export. Cardmarket's own *Bulk Listing* form takes up to 100 items
  per expansion; the open-source *Cardmarket Bulk Import* browser extension
  (github.com/PedroPerpetua/cardmarket-bulk-import) fills that form from a CSV, and
  paid tools like TCG PowerTools import CSVs too. You may need to adjust column names
  to whichever tool you pick — edit `cardmarketCsv()` in `lib/core/cardmarket.ts`.
- **If/when you get Dedicated App credentials** (e.g. after upgrading to a professional
  seller account and asking support), put them in `.env`. Pushes run in **dry-run**
  (logged, not sent) until you set `CARDMARKET_DRY_RUN="false"`. Verify
  `CARDMARKET_API_BASE` against Cardmarket's current docs first — the endpoint has moved
  before. The OAuth signing is unit-tested but has not been run against the live API.
- Don't hand credentials to third-party sync services — Cardmarket's terms forbid it.

## Roadmap (not in MVP)

Scope for now is **Cardmarket only**.

- **Cardmarket order sync** (needs API access): pull sold articles → auto mark sold.
  Until then, mark sold manually from the pick list / inventory.
- **Other channels later** (Tradera REST v4, eBay Inventory API): add a file in
  `lib/channels/` mirroring the Cardmarket channel. Requires order sync + cross-channel
  delisting first, so the same copy can't sell twice.
- **Condition grading**: add object storage for photos (e.g. Cloudflare R2 / Neon object
  storage), a front/back capture step and a vision-based grading suggestion.
- **Auth upgrade**: the app uses one shared password today; add per-user logins if more
  people join.

## PMF metrics worth tracking from day one

Sell-through % at 30/60 days, median days-to-sale, gross margin per copy
(ask − cost − fees − shipping), and minutes of labour per card (intake + pick + ship).
All but labour are derivable from the DB.
