// Bulk import (ManaBox CSV): resolve cards via Scryfall in batches, allocate chaos slots
// for every copy in scan order, price them, give each copy a SKU, and optionally attach
// everything to a purchase whose total price is spread over the cards.
import { prisma } from "./db";
import { findFreeSlots, locationLabel } from "./core/chaos";
import { computeAskPrice } from "./core/pricing";
import { skuFor, type AllocationMethod } from "./core/allocation";
import type { ImportRow } from "./core/manabox";
import { byIds, upsertCard } from "./scryfall";
import { BOX_CAPACITY } from "./inventory";
import { createPurchase, reallocate } from "./purchases";

export type CostMode =
  | { kind: "newLot"; name: string; totalCost: number; method: AllocationMethod; purchasedAt?: Date }
  | { kind: "existingLot"; purchaseId: number }
  | { kind: "file"; usdToEur: number; fallback: number | null } // ManaBox 'Purchase price'
  | { kind: "flat"; perCard: number | null };

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
  skus: string[];
}

function rowCost(row: ImportRow, mode: CostMode): number | null {
  if (mode.kind === "flat") return mode.perCard;
  if (mode.kind === "file") {
    if (row.purchasePrice != null) {
      const cur = (row.purchaseCurrency ?? "").toUpperCase();
      if (cur === "EUR") return row.purchasePrice;
      if (cur === "USD") return Math.round(row.purchasePrice * mode.usdToEur * 100) / 100;
    }
    return mode.fallback;
  }
  return null; // lots: allocated after insert
}

export async function importRows(input: ImportRow[], mode: CostMode) {
  const rows = input.filter((r) => !r.skip);
  const errors: string[] = [];

  let purchaseId: number | null = null;
  if (mode.kind === "newLot") purchaseId = (await createPurchase(mode)).id;
  if (mode.kind === "existingLot") {
    const p = await prisma.purchase.findUnique({ where: { id: mode.purchaseId } });
    if (!p) throw new Error("Purchase not found");
    purchaseId = p.id;
  }

  // 1. Resolve and cache all printings (75 per Scryfall request).
  const ids = [...new Set(rows.map((r) => r.scryfallId))];
  const cards = new Map<string, Awaited<ReturnType<typeof upsertCard>>>();
  for (const sc of await byIds(ids)) cards.set(sc.id, await upsertCard(sc));
  const valid = rows.filter((r) => {
    if (cards.has(r.scryfallId)) return true;
    errors.push(`Line ${r.line} (${r.name}): not found on Scryfall, skipped`);
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

  // 3. Build rows.
  const data = [];
  const rowOfCopy: number[] = [];
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
      rowOfCopy.push(placements.length);
      data.push({
        scryfallId: card.scryfallId, condition: r.condition, foil: r.foil, language: r.language,
        boxId: boxIds.get(s.boxCode)!, slot: s.slot, askPrice: price, costBasis: rowCost(r, mode),
        purchaseId,
        notes: [r.flags.length ? r.flags.join(", ") : null, "Import: ManaBox"].filter(Boolean).join(" · "),
      });
    }
    placements.push({
      line: r.line, name: card.name, set: card.setCode.toUpperCase(), number: card.collectorNumber,
      condition: r.condition, language: r.language, foil: r.foil, askPrice: price, flags: r.flags, locations, skus: [],
    });
  }

  // 4. Insert in one transaction, then stamp each copy with its SKU.
  const created = await prisma.$transaction(data.map((d) => prisma.inventoryItem.create({ data: d, select: { id: true } })));
  await prisma.$transaction(created.map((c) => prisma.inventoryItem.update({ where: { id: c.id }, data: { sku: skuFor(c.id) } })));
  created.forEach((c, i) => placements[rowOfCopy[i]].skus.push(skuFor(c.id)));

  // 5. Spread the lot price over all of the lot's cards (including earlier imports).
  if (purchaseId != null) await reallocate(purchaseId);

  const value = placements.reduce((s, p) => s + (p.askPrice ?? 0) * p.locations.length, 0);
  return {
    imported: data.length,
    skipped: input.length - rows.length,
    errors,
    value: Math.round(value * 100) / 100,
    purchaseId,
    placements,
  };
}
