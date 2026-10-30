import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCsv, parseManabox } from "../lib/core/manabox.ts";
import { findFreeSlots } from "../lib/core/chaos.ts";

const HEADER =
  "Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Signed,Condition,Language,Proxy,Purchase price currency,Added";
const ID = "fc70e127-ffc8-45ed-9ca3-7f9f926ac4d5";

test("csv: quoted commas and escaped quotes", () => {
  const rows = parseCsv('a,b\n"Jace, the ""Mind"" Sculptor",2\r\n');
  assert.deepEqual(rows, [["a", "b"], ['Jace, the "Mind" Sculptor', "2"]]);
});

test("manabox: real export parses", () => {
  const text = readFileSync(new URL("./fixtures-manabox.csv", import.meta.url), "utf8");
  const { rows, errors } = parseManabox(text);
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 4);
  const gift = rows.find((r) => r.name === "Generous Gift")!;
  assert.equal(gift.scryfallId, ID);
  assert.equal(gift.condition, "NM");
  assert.equal(gift.language, "en");
  assert.equal(gift.foil, false);
  assert.equal(gift.purchasePrice, 0.82);
  assert.equal(gift.purchaseCurrency, "USD");
  // 0.0 purchase price is treated as unknown
  assert.equal(rows.find((r) => r.name === "Read the Bones")!.purchasePrice, null);
});

test("manabox: conditions, foil, proxy, flags, sorting by Added", () => {
  const text = [
    HEADER,
    `"Card, B",SET,Set,2,foil,rare,2,1,${ID},0,false,true,false,light_played,de,false,EUR,2024-10-31T21:30:00Z`,
    `Card A,SET,Set,1,etched,rare,1,1,${ID},0,true,false,true,excellent,en,false,EUR,2024-10-31T21:20:00Z`,
    `Fake,SET,Set,3,normal,rare,1,1,${ID},0,false,false,false,near_mint,en,true,EUR,2024-10-31T21:40:00Z`,
  ].join("\n");
  const { rows, errors } = parseManabox(text);
  assert.deepEqual(errors, []);
  assert.deepEqual(rows.map((r) => r.name), ["Card A", "Card, B", "Fake"]);
  assert.equal(rows[0].foil, true); // etched counts as foil
  assert.equal(rows[0].condition, "EX");
  assert.deepEqual(rows[0].flags, ["Signed", "Misprint"]);
  assert.equal(rows[1].condition, "LP");
  assert.equal(rows[1].quantity, 2);
  assert.equal(rows[1].language, "de");
  assert.deepEqual(rows[1].flags, ["Altered"]);
  assert.equal(rows[2].skip, "Proxy – sælges ikke");
});

test("manabox: bad rows become errors, wrong file is rejected", () => {
  const bad = [HEADER, `X,S,S,1,normal,rare,1,1,not-an-id,0,false,false,false,near_mint,en,false,USD,`].join("\n");
  assert.equal(parseManabox(bad).errors.length, 1);
  assert.match(parseManabox("foo,bar\n1,2").errors[0], /Ikke en ManaBox-eksport/);
});

test("chaos: bulk allocation fills gaps, then opens new boxes", () => {
  const boxes = [{ boxId: 1, code: "B001", capacity: 3, occupiedSlots: [2] }];
  const out = findFreeSlots(boxes, 2, 5);
  assert.deepEqual(out.map((a) => `${a.boxCode}:${a.slot}:${a.boxId}`), [
    "B001:1:1", "B001:3:1", "B002:1:null", "B002:2:null", "B003:1:null",
  ]);
  assert.equal(findFreeSlots([], 500, 0).length, 0);
});
