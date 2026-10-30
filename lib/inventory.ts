// Inventory service: adding copies into chaos storage, repricing, freeing slots.
import { prisma } from "./db";
import { findFreeSlot, locationLabel } from "./core/chaos";
import { computeAskPrice, type Condition } from "./core/pricing";
import { byId, byIds, upsertCard } from "./scryfall";

export const BOX_CAPACITY = Number(process.env.BOX_CAPACITY || 500);

/** Statuses that physically occupy a slot. */
const OCCUPYING = ["IN_STOCK", "LISTED"];

async function assignSlot() {
  const boxes = await prisma.box.findMany({
    include: { items: { where: { status: { in: OCCUPYING } }, select: { slot: true } } },
  });
  const a = findFreeSlot(
    boxes.map((b) => ({ boxId: b.id, code: b.code, capacity: b.capacity, occupiedSlots: b.items.map((i) => i.slot!).filter(Boolean) })),
    BOX_CAPACITY,
  );
  const boxId = a.boxId ?? (await prisma.box.create({ data: { code: a.boxCode, capacity: BOX_CAPACITY } })).id;
  return { boxId, boxCode: a.boxCode, slot: a.slot };
}

export interface AddInput {
  scryfallId: string;
  condition: Condition;
  foil: boolean;
  language: string;
  quantity: number;
  costBasis?: number | null;
  photoPath?: string | null;
}

/** Adds N physical copies; each gets its own slot. Returns the created items with locations. */
export async function addCopies(input: AddInput) {
  const sc = await byId(input.scryfallId);
  if (!sc) throw new Error("Unknown Scryfall id");
  const card = await upsertCard(sc);
  const { price } = computeAskPrice({
    priceEur: card.priceEur, priceEurFoil: card.priceEurFoil,
    foil: input.foil, condition: input.condition, language: input.language,
  });
  const created = [];
  for (let i = 0; i < Math.max(1, input.quantity); i++) {
    // Slot assignment + insert in a loop; the unique (boxId, slot) index guards against races.
    const loc = await assignSlot();
    const item = await prisma.inventoryItem.create({
      data: {
        scryfallId: card.scryfallId, condition: input.condition, foil: input.foil, language: input.language,
        boxId: loc.boxId, slot: loc.slot, askPrice: price, costBasis: input.costBasis ?? null,
        photoPath: input.photoPath ?? null,
      },
    });
    created.push({ id: item.id, location: locationLabel(loc.boxCode, loc.slot) });
  }
  return { card, askPrice: price, created };
}

/** Refresh prices from Scryfall and recompute ask prices for unsold stock. */
export async function repriceAll(itemIds?: number[]) {
  const items = await prisma.inventoryItem.findMany({
    where: { status: { in: OCCUPYING }, ...(itemIds ? { id: { in: itemIds } } : {}) },
    include: { card: true },
  });
  const unique = [...new Set(items.map((it) => it.scryfallId))];
  for (const sc of await byIds(unique)) await upsertCard(sc);
  let changed = 0;
  for (const it of items) {
    const card = await prisma.card.findUnique({ where: { scryfallId: it.scryfallId } });
    if (!card) continue;
    const { price } = computeAskPrice({
      priceEur: card.priceEur, priceEurFoil: card.priceEurFoil, foil: it.foil,
      condition: it.condition as Condition, language: it.language,
    });
    if (price != null && price !== it.askPrice) {
      await prisma.inventoryItem.update({ where: { id: it.id }, data: { askPrice: price } });
      changed++;
    }
  }
  return { checked: items.length, changed };
}

/** Mark sold/removed: frees the slot for chaos reuse. */
export async function setStatus(ids: number[], status: "SOLD" | "REMOVED" | "IN_STOCK") {
  return prisma.inventoryItem.updateMany({
    where: { id: { in: ids } },
    data: status === "IN_STOCK" ? { status } : { status, boxId: null, slot: null },
  });
}
