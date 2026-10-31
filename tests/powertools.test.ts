import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareForPowertools, powertoolsCsv, ptComment, type PtCopy } from "../lib/core/powertools.ts";

const c = (o: Partial<PtCopy>): PtCopy => ({
  id: 1, sku: "C-000001", location: "B001-0001", cardmarketId: 566889, name: "Nykthos Paragon", set: "Modern Horizons 2",
  condition: "NM", language: "en", foil: false, price: 0.36, cost: 0.2, ...o,
});

test("powertools: header matches PowerTools' example file", () => {
  assert.equal(powertoolsCsv([]).trim(), "cardmarketId,quantity,name,set,condition,language,isSigned,price,comment,finishType,buyPrice");
});

test("powertools: one row per copy, location and SKU in the comment", () => {
  const { rows, missingId } = prepareForPowertools([
    c({ id: 2, sku: "C-000002", location: "B001-0007", cost: 0.3 }),
    c({ id: 1, sku: "C-000001", location: "B001-0001", cost: 0.2 }),
    c({ id: 3, sku: "C-000003", location: "B002-0004", foil: true, price: 0.9, cost: null }),
    c({ id: 4, sku: "C-000004", cardmarketId: null }),
    c({ id: 5, sku: "C-000005", location: "B001-0002", cardmarketId: 1, name: "Jace, the \"Mind\" Sculptor", set: "Worldwake", language: "de", condition: "EX", price: 50, cost: 20 }),
  ]);
  assert.equal(missingId.length, 1);
  const lines = powertoolsCsv(rows).trim().split("\n").slice(1);
  assert.deepEqual(lines, [
    "566889,1,Nykthos Paragon,Modern Horizons 2,NM,English,false,0.36,B001-0001 C-000001,Regular,0.20",
    "566889,1,Nykthos Paragon,Modern Horizons 2,NM,English,false,0.36,B001-0007 C-000002,Regular,0.30",
    "566889,1,Nykthos Paragon,Modern Horizons 2,NM,English,false,0.90,B002-0004 C-000003,Foil,",
    '1,1,"Jace, the ""Mind"" Sculptor",Worldwake,EX,German,false,50.00,B001-0002 C-000005,Regular,20.00',
  ]);
});

test("powertools: comment without a location or SKU", () => {
  assert.equal(ptComment({ location: null, sku: "C-000009", id: 9 }), "C-000009");
  assert.equal(ptComment({ location: "B001-0003", sku: null, id: 9 }), "B001-0003 #9");
});
