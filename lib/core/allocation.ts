// Spreading a purchase price over the cards in it. Pure, unit-tested.

export type AllocationMethod = "VALUE" | "EQUAL";

/** Cards with no market price still carry some cost (EUR weight). */
export const MIN_WEIGHT = 0.05;

/**
 * Splits `total` EUR over items in whole cents. The result always sums to exactly `total`.
 * VALUE: proportional to each item's market value (a €20 card carries 100× a €0.20 card).
 * EQUAL: same share per card.
 * Rounding uses the largest-remainder method, so no cent is lost or invented.
 */
export function allocateCost(total: number, values: (number | null)[], method: AllocationMethod): number[] {
  const n = values.length;
  if (n === 0) return [];
  const totalCents = Math.round(total * 100);
  const weights = values.map((v) =>
    method === "EQUAL" ? 1 : Math.max(v != null && Number.isFinite(v) ? v : 0, MIN_WEIGHT),
  );
  const sum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((w) => (totalCents * w) / sum);
  const cents = exact.map(Math.floor);
  let rest = totalCents - cents.reduce((a, b) => a + b, 0);
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; rest > 0; k = (k + 1) % n, rest--) cents[order[k].i]++;
  return cents.map((c) => c / 100);
}

/** Unique per-copy ID. Derived from the row id so it never collides and never changes. */
export function skuFor(id: number): string {
  return `C-${String(id).padStart(6, "0")}`;
}

export interface LotStats {
  cards: number;
  sold: number;
  totalCost: number;
  revenue: number; // gross, sum of sale prices
  costOfSold: number;
  stockValue: number; // ask value of unsold copies
  payback: number; // revenue / totalCost, 0..∞
}

export function lotStats(
  totalCost: number,
  items: { status: string; costBasis: number | null; askPrice: number | null; soldPrice: number | null }[],
): LotStats {
  let sold = 0, revenue = 0, costOfSold = 0, stockValue = 0, cards = 0;
  for (const it of items) {
    if (it.status === "REMOVED") continue;
    cards++;
    if (it.status === "SOLD") {
      sold++;
      revenue += it.soldPrice ?? it.askPrice ?? 0;
      costOfSold += it.costBasis ?? 0;
    } else stockValue += it.askPrice ?? 0;
  }
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return {
    cards, sold, totalCost: r2(totalCost), revenue: r2(revenue), costOfSold: r2(costOfSold),
    stockValue: r2(stockValue), payback: totalCost > 0 ? revenue / totalCost : 0,
  };
}
