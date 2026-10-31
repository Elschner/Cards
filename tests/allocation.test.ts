import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateCost, lotStats, skuFor, MIN_WEIGHT } from "../lib/core/allocation.ts";

const sum = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) * 100) / 100;

test("allocation: by value is proportional and sums exactly", () => {
  const out = allocateCost(100, [20, 5, 0.2, 0.2], "VALUE");
  assert.equal(sum(out), 100);
  assert.ok(out[0] > out[1] && out[1] > out[2]);
  assert.equal(out[2], out[3]);
  // 20 / 25.4 * 100 ≈ 78.74
  assert.ok(Math.abs(out[0] - 78.74) <= 0.01);
});

test("allocation: equal split hands out leftover cents", () => {
  const out = allocateCost(10, [1, 1, 1], "EQUAL");
  assert.deepEqual(out, [3.34, 3.33, 3.33]);
  assert.equal(sum(out), 10);
});

test("allocation: cards without price still carry cost", () => {
  const out = allocateCost(1, [null, 0, MIN_WEIGHT], "VALUE");
  assert.equal(sum(out), 1);
  assert.ok(out.every((c) => c > 0.3));
});

test("allocation: many cheap cards never lose a cent", () => {
  const values = Array.from({ length: 997 }, (_, i) => (i % 7) * 0.13 + 0.01);
  const out = allocateCost(123.45, values, "VALUE");
  assert.equal(out.length, 997);
  assert.equal(sum(out), 123.45);
  assert.ok(out.every((c) => c >= 0));
});

test("allocation: zero cost and empty lists", () => {
  assert.deepEqual(allocateCost(0, [1, 2], "VALUE"), [0, 0]);
  assert.deepEqual(allocateCost(50, [], "VALUE"), []);
});

test("sku: stable, padded, unique per id", () => {
  assert.equal(skuFor(42), "C-000042");
  assert.notEqual(skuFor(1), skuFor(10));
});

test("lot stats: payback and margins", () => {
  const s = lotStats(10, [
    { status: "SOLD", costBasis: 4, askPrice: 6, soldPrice: 7 },
    { status: "LISTED", costBasis: 3, askPrice: 5, soldPrice: null },
    { status: "IN_STOCK", costBasis: 3, askPrice: 1, soldPrice: null },
    { status: "REMOVED", costBasis: 0, askPrice: 9, soldPrice: null },
  ]);
  assert.deepEqual(
    { cards: s.cards, sold: s.sold, revenue: s.revenue, costOfSold: s.costOfSold, stockValue: s.stockValue },
    { cards: 3, sold: 1, revenue: 7, costOfSold: 4, stockValue: 6 },
  );
  assert.equal(s.payback, 0.7);
});
