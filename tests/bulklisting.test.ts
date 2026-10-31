import { test } from "node:test";
import assert from "node:assert/strict";
import { bulkCsv, groupBySet, parseMtgjsonSets, bulkListingUrl, type CopyIn } from "../lib/core/bulklisting.ts";

const c = (o: Partial<CopyIn>): CopyIn => ({
  id: 1, sku: "C-000001", name: "Card", setCode: "mh2", setName: "Modern Horizons 2", rarity: "rare",
  language: "en", condition: "NM", foil: false, price: 1, ...o,
});

test("bulk: one group per set, identical copies merged, rarity order", () => {
  const groups = groupBySet([
    c({ id: 1, sku: "C-000001", name: "Sol Ring", setCode: "cmm", setName: "Commander Masters", rarity: "uncommon", price: 1.2 }),
    c({ id: 2, sku: "C-000002", name: "Nykthos Paragon", rarity: "rare", price: 0.36 }),
    c({ id: 3, sku: "C-000003", name: "Ragavan, Nimble Pilferer", rarity: "mythic", price: 38.5 }),
    c({ id: 4, sku: "C-000004", name: "Nykthos Paragon", rarity: "rare", price: 0.36 }),
    c({ id: 5, sku: "C-000005", name: "Nykthos Paragon", rarity: "rare", price: 0.36, foil: true }),
  ]);
  assert.deepEqual(groups.map((g) => g.setCode), ["cmm", "mh2"]);
  const mh2 = groups[1];
  assert.equal(mh2.copies, 4);
  assert.equal(mh2.value, 39.58);
  assert.deepEqual(mh2.rows.map((r) => `${r.name}|${r.foil}|${r.quantity}`), [
    "Ragavan, Nimble Pilferer|false|1", "Nykthos Paragon|false|2", "Nykthos Paragon|true|1",
  ]);
  assert.equal(mh2.rows[1].comment, "C-000002 C-000004");
  assert.deepEqual(mh2.rows[1].ids, [2, 4]);
});

test("bulk: CSV has no set column and extension-friendly values", () => {
  const csv = bulkCsv([{ name: "Jace, the Mind Sculptor", language: "de", condition: "EX", foil: true, quantity: 2, price: 50, comment: "C-000001 C-000002" }]);
  const [head, line] = csv.trim().split("\n");
  assert.equal(head, "Name,Language,Condition,Foil,Quantity,Price,Comment");
  assert.equal(line, '"Jace, the Mind Sculptor",German,EX,Yes,2,50.00,C-000001 C-000002');
  assert.ok(!/set/i.test(head));
});

test("bulk: MTGJSON sets map to Cardmarket expansion ids", () => {
  const sets = parseMtgjsonSets('code,name,mcmId,mcmName\nMH2,Modern Horizons 2,4069,Modern Horizons 2\nLCC,"Commander, LCI",5214,Commander: The Lost Caverns of Ixalan\nOLD,No id,,\n');
  assert.deepEqual(sets.get("mh2"), { mcmId: 4069, mcmName: "Modern Horizons 2" });
  assert.equal(sets.get("lcc")?.mcmName, "Commander: The Lost Caverns of Ixalan");
  assert.equal(sets.has("old"), false);
  assert.equal(bulkListingUrl(4069), "https://www.cardmarket.com/en/Magic/Stock/ListingMethods/BulkListing?idExpansion=4069");
  assert.ok(!bulkListingUrl(null).includes("?"));
});
