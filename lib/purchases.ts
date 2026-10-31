// Purchases (lots) and per-copy SKUs.
import { prisma } from "./db";
import { allocateCost, lotStats, skuFor, type AllocationMethod } from "./core/allocation";

/** Gives every copy without a SKU its permanent ID. Cheap no-op when all have one. */
export async function ensureSkus() {
  const missing = await prisma.inventoryItem.findMany({ where: { sku: null }, select: { id: true } });
  for (const m of missing) {
    await prisma.inventoryItem.update({ where: { id: m.id }, data: { sku: skuFor(m.id) } });
  }
  return missing.length;
}

export async function createPurchase(input: { name: string; totalCost: number; method: AllocationMethod; purchasedAt?: Date; notes?: string | null }) {
  return prisma.purchase.create({
    data: {
      name: input.name.trim() || "Purchase",
      totalCost: Math.round(input.totalCost * 100) / 100,
      method: input.method,
      purchasedAt: input.purchasedAt ?? new Date(),
      notes: input.notes ?? null,
    },
  });
}

/**
 * Spreads the purchase's total cost over all its copies (sold ones included — the lot's
 * cost doesn't change because some cards left). Run after import and after edits.
 */
export async function reallocate(purchaseId: number) {
  const p = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { items: { where: { status: { not: "REMOVED" } }, include: { card: true }, orderBy: { id: "asc" } } },
  });
  if (!p) throw new Error("Purchase not found");
  // Market value per copy: the ask price (trend adjusted for condition/language).
  const values = p.items.map((it) => it.askPrice ?? (it.foil ? it.card.priceEurFoil ?? it.card.priceEur : it.card.priceEur));
  const costs = allocateCost(p.totalCost, values, p.method as AllocationMethod);
  await prisma.$transaction(p.items.map((it, i) => prisma.inventoryItem.update({ where: { id: it.id }, data: { costBasis: costs[i] } })));
  return { items: p.items.length };
}

export async function updatePurchase(id: number, data: { name?: string; totalCost?: number; method?: AllocationMethod; notes?: string | null }) {
  await prisma.purchase.update({
    where: { id },
    data: {
      ...(data.name != null ? { name: data.name.trim() } : {}),
      ...(data.totalCost != null ? { totalCost: Math.round(data.totalCost * 100) / 100 } : {}),
      ...(data.method ? { method: data.method } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
  });
  return reallocate(id);
}

export async function purchasesWithStats() {
  const ps = await prisma.purchase.findMany({
    orderBy: { purchasedAt: "desc" },
    include: { items: { select: { status: true, costBasis: true, askPrice: true, soldPrice: true } } },
  });
  return ps.map((p) => ({ id: p.id, name: p.name, purchasedAt: p.purchasedAt, method: p.method, notes: p.notes, ...lotStats(p.totalCost, p.items) }));
}

/** Deletes a purchase. Its cards stay in inventory, without a purchase and without a cost. */
export async function deletePurchase(id: number) {
  const [unlinked] = await prisma.$transaction([
    prisma.inventoryItem.updateMany({ where: { purchaseId: id }, data: { purchaseId: null, costBasis: null } }),
    prisma.purchase.delete({ where: { id } }),
  ]);
  return { unlinked: unlinked.count };
}
