# CardOps — internal MTG singles ops tool (MVP)

Upload card photos → recognise the exact printing via Scryfall → store each copy in a
chaos-storage slot → price from Cardmarket trend → list on Cardmarket.

Built to prove PMF cheaply: one Next.js app and one local database file. Runs on your
laptop; can be put online later (see bottom).

## Run on your computer

One-time setup (needs [Node.js 22 LTS](https://nodejs.org) and Git):

```bash
git clone https://github.com/Elschner/Cards
cd Cards
cp .env.example .env        # Windows: copy .env.example .env
npm install
npx prisma db push          # creates the database file prisma/dev.db
```

Open `.env` in a text editor and set `SCRYFALL_USER_AGENT` (e.g. `CardOps/0.1 (you@example.com)`).
Optional: `ANTHROPIC_API_KEY` from console.anthropic.com for photo recognition — without
it you type the card name and pick the printing.

Every time:

```bash
cd Cards
npm run dev                 # then open http://localhost:3000 — Ctrl+C to stop
```

- **Phone camera on the same Wi-Fi:** `npm run dev -- -H 0.0.0.0`, then open
  `http://<your-laptop-IP>:3000` on the phone.
- **Back up** `prisma/dev.db` (inventory) and `uploads/` (photos) now and then.
- **Get updates:** `git pull && npm install && npx prisma db push`.
- `npm test` runs the pricing, chaos-slot and Cardmarket signing/CSV tests.

## Purchases and SKUs

- **Purchases:** when you import a collection, enter what you paid (EUR). The
  price is spread over the cards *by market value* (a €20 card carries 100× the cost of a
  €0.20 card) or *equally*. Rounding is to the cent and always sums to the exact price.
  Adding more cards to a purchase later spreads the price again over all of them.
  The overview shows per purchase how much has come back in sales ("Paid back").
- **SKU:** every physical copy gets a permanent ID like `C-000123`. It is printed on the
  placement list and written into the Comment field of the Cardmarket CSV, so each
  Cardmarket order tells you exactly which copy sold — the same ID works on any future channel.
- **Sold price:** marking a card sold stores its sale price (the ask price unless you correct
  it with "Correct sale price"), which feeds margin and payback.
- **Add to purchase:** select cards in Inventory and pick a purchase in *Add to purchase…*;
  the purchase price is split again over all its cards (or *Remove from purchase*).
- **Location in PowerTools:** the PowerTools CSV has one row per copy with the location and
  SKU in the comment (`B001-0042 C-000123`), so every Cardmarket order shows the slot.
- **Delete:** select cards in Inventory and press Delete to remove test cards or mistakes
  permanently (frees the slot, re-splits the purchase cost). A purchase can be deleted on its
  page; its cards stay in inventory without a cost.
- **No double listing:** only cards that are *In stock* can be listed. Listed or sold cards
  are blocked in the UI and skipped by the export.

## Daily workflow

0. **Import (ManaBox)** — fastest for big stacks: scan in the free ManaBox app, set
   condition/language there, export CSV, choose it under *Import*. Every copy gets a slot
   and a price; the placement list follows scan order — print it and file the stack.
1. **Intake** — drop photos (or use phone camera). Claude vision reads name, set code,
   collector number and language from the card; Scryfall resolves the exact printing.
   Correct the printing/condition/language/foil if needed → *Add to inventory*.
   The screen shows the slot, e.g. **B001-0042** — put the card there. No sorting.
2. **Inventory** — select in-stock cards and press **List on Cardmarket**. Fastest: **Download
   PowerTools CSV** (all sets in one file, matched by Cardmarket ID, buy price = allocated cost),
   import it in TCG PowerTools (Listing & Appraisal → Import a file), publish, then **Mark as listed**.
   Free alternative: the listing page
   gives one CSV per set (Cardmarket's Bulk listing works per set), a direct link to that set's
   Bulk listing page, and a **Mark as listed** button. Fill the page with the free
   *Cardmarket Bulk Import* extension (leave Set unmapped), check, put up for sale. Older route:
   - **CSV + mark listed** → upload via Cardmarket's bulk listing (see below), or
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

## Later: put it online (free)

When you want it in the browser from anywhere: **Render** (free web service) + **Neon**
(free Postgres). Vercel's free plan is not an option — it is non-commercial use only.

1. In `prisma/schema.prisma` change `provider = "sqlite"` to `provider = "postgresql"`, commit, push.
   (Local dev then uses Neon too; existing local data is not migrated automatically.)
2. **Neon:** sign up at neon.tech → new project (Frankfurt) → **Connect** → copy the
   connection string (`…?sslmode=require`).
3. **Render:** sign up with GitHub → **New → Blueprint** → `Elschner/Cards` (reads
   `render.yaml`). Enter `DATABASE_URL` (Neon), `APP_PASSWORD` (no æøå),
   `SCRYFALL_USER_AGENT`, optional `ANTHROPIC_API_KEY` → **Apply**.
4. Open `https://cardops-xxxx.onrender.com`, log in as `admin` + your password.

Trade-offs: the free app sleeps after 15 min idle (~1 min to wake); photos aren't kept
(no persistent disk) until photo storage is added.
