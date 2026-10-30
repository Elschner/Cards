// Bulk import (ManaBox CSV): resolve cards via Scryfall in batches, allocate chaos slots
// for every copy in scan order, price them, and create inventory rows in one go.
import { prisma } from "./db";
import { findFreeSlots, locationLabel } from "./core/chaos";
import { computeAskPrice } from "./core/pricing";
import type { ImportRow } from "./core/manabox";
import { byIds, upsertCard } from "./scryfall";
import { BOX_CAPACITY } from "./inventory";

export interface ImportOptions {
  /** Use ManaBox 'Purchase price' as cost basis (converted to EUR). */
  useFilePrice: boolean;
  usdToEur: number;
  /** Cost per card when not taken from the file (EUR), or null. */
  defaultCost: number | null;
}

export interface Placement {
  line: number;
  name: string;
  set: string;
  number: string;
  condition: string;
  language: string;
  foil: boolean;
  askPrice: number | null;
  flags: string[];
  locations: string[];
}

function costFor(row: ImportRow, o: ImportOptions): number | null {
  if (o.useFilePrice && row.purchasePrice != null) {
    const cur = (row.purchaseCurrency ?? "").toUpperCase();
    if (cur === "EUR") return row.purchasePrice;
    if (cur === "USD") return Math.round(row.purchasePrice * o.usdToEur * 100) / 100;
  }
  return o.defaultCost;
}

export async function importRows(input: ImportRow[], o: ImportOptions) {
  const rows = input.filter((r) => !r.skip);
  const errors: string[] = [];

  // 1. Resolve and cache all printings (75 per Scryfall request).
  const ids = [...new Set(rows.map((r) => r.scryfallId))];
  const found = await byIds(ids);
  const cards = new Map<string, Awaited<ReturnType<typeof upsertCard>>>();
  for (const sc of found) cards.set(sc.id, await upsertCard(sc));
  const valid = rows.filter((r) => {
    if (cards.has(r.scryfallId)) return true;
    errors.push(`Linje ${r.line} (${r.name}): ikke fundet på Scryfall – sprunget over`);
    return false;
  });

  // 2. Allocate slots for every physical copy, in scan order.
  const total = valid.reduce((n, r) => n + r.quantity, 0);
  const boxes = await prisma.box.findMany({
    include: { items: { where: { status: { in: ["IN_STOCK", "LISTED"] } }, select: { slot: true } } },
  });
  const slots = findFreeSlots(
    boxes.map((b) => ({ boxId: b.id, code: b.code, capacity: b.capacity, occupiedSlots: b.items.map((i) => i.slot!).filter(Boolean) })),
    BOX_CAPACITY,
    total,
  );
  const boxIds = new Map(boxes.map((b) => [b.code, b.id]));
  for (const s of slots) {
    if (!boxIds.has(s.boxCode)) {
      const b = await prisma.box.create({ data: { code: s.boxCode, capacity: BOX_CAPACITY } });
      boxIds.set(b.code, b.id);
    }
  }

  // 3. Build rows + placement list.
  const data = [];
  const placements: Placement[] = [];
  let k = 0;
  for (const r of valid) {
    const card = cards.get(r.scryfallId)!;
    const { price } = computeAskPrice({
      priceEur: card.priceEur, priceEurFoil: card.priceEurFoil,
      foil: r.foil, condition: r.condition, language: r.language,
    });
    const locations: string[] = [];
    for (let q = 0; q < r.quantity; q++) {
      const s = slots[k++];
      locations.push(locationLabel(s.boxCode, s.slot));
      data.push({
        scryfallId: card.scryfallId, condition: r.condition, foil: r.foil, language: r.language,
        boxId: boxIds.get(s.boxCode)!, slot: s.slot, askPrice: price, costBasis: costFor(r, o),
        notes: [r.flags.length ? r.flags.join(", ") : null, "Import: ManaBox"].filter(Boolean).join(" · "),
      });
    }
    placements.push({
      line: r.line, name: card.name, set: card.setCode.toUpperCase(), number: card.collectorNumber,
      condition: r.condition, language: r.language, foil: r.foil, askPrice: price, flags: r.flags, locations,
    });
  }

  // 4. Insert in one transaction so a failure leaves nothing half-imported.
  await prisma.$transaction(data.map((d) => prisma.inventoryItem.create({ data: d })));

  const value = placements.reduce((s, p) => s + (p.askPrice ?? 0) * p.locations.length, 0);
  return {
    imported: data.length,
    skipped: input.length - rows.length,
    errors,
    value: Math.round(value * 100) / 100,
    placements,
  };
}
