import { test } from "node:test";
import assert from "node:assert/strict";
import { groupForPowertools, powertoolsCsv, type PtCopy } from "../lib/core/powertools.ts";

const c = (o: Partial<PtCopy>): PtCopy => ({
  id: 1, sku: "C-000001", cardmarketId: 566889, name: "Nykthos Paragon", set: "Modern Horizons 2",
  condition: "NM", language: "en", foil: false, price: 0.36, cost: 0.2, ...o,
});

test("powertools: header matches PowerTools' example file", () => {
  const csv = powertoolsCsv([]);
  assert.equal(csv.trim(), "cardmarketId,quantity,name,set,condition,language,isSigned,price,comment,finishType,buyPrice");
});

test("powertools: identical copies merge, SKUs in comment, average buy price", () => {
  const { rows, missingId } = groupForPowertools([
    c({ id: 1, sku: "C-000001", cost: 0.2 }),
    c({ id: 2, sku: "C-000002", cost: 0.3 }),
    c({ id: 3, sku: "C-000003", foil: true, price: 0.9, cost: null }),
    c({ id: 4, sku: "C-000004", cardmarketId: null }),
    c({ id: 5, sku: "C-000005", cardmarketId: 1, name: "Jace, the \"Mind\" Sculptor", set: "Worldwake", language: "de", condition: "EX", price: 50, cost: 20 }),
  ]);
  assert.equal(missingId.length, 1);
  const lines = powertoolsCsv(rows).trim().split("\n").slice(1);
  assert.deepEqual(lines, [
    "566889,2,Nykthos Paragon,Modern Horizons 2,NM,English,false,0.36,C-000001 C-000002,Regular,0.25",
    "566889,1,Nykthos Paragon,Modern Horizons 2,NM,English,false,0.90,C-000003,Foil,",
    '1,1,"Jace, the ""Mind"" Sculptor",Worldwake,EX,German,false,50.00,C-000005,Regular,20.00',
  ]);
});
