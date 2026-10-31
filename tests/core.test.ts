import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAskPrice, DEFAULT_RULES } from "../lib/core/pricing.ts";
import { findFreeSlot, locationLabel, pickOrder } from "../lib/core/chaos.ts";
import { mkmAuthHeader, stockXml, cardmarketCsv, chunk, rfc3986 } from "../lib/core/cardmarket.ts";
import { createHmac } from "node:crypto";

test("pricing: NM English uses trend", () => {
  const r = computeAskPrice({ priceEur: 4.2, priceEurFoil: 9, foil: false, condition: "NM", language: "en" });
  assert.equal(r.price, 4.2);
  assert.equal(r.isBulk, false);
});

test("pricing: foil uses foil trend, condition + language discounts stack", () => {
  const r = computeAskPrice({ priceEur: 4, priceEurFoil: 10, foil: true, condition: "EX", language: "de" });
  assert.equal(r.price, 7.65); // 10 * 0.85 * 0.9
});

test("pricing: foil falls back to non-foil trend", () => {
  const r = computeAskPrice({ priceEur: 2, priceEurFoil: null, foil: true, condition: "NM", language: "en" });
  assert.equal(r.price, 2);
});

test("pricing: floor and bulk flag", () => {
  const r = computeAskPrice({ priceEur: 0.04, priceEurFoil: null, foil: false, condition: "NM", language: "en" });
  assert.equal(r.price, DEFAULT_RULES.floor);
  assert.equal(r.isBulk, true);
});

test("pricing: missing data returns null", () => {
  const r = computeAskPrice({ priceEur: null, priceEurFoil: null, foil: false, condition: "NM", language: "en" });
  assert.equal(r.price, null);
});

test("chaos: first free slot, reuses gaps, opens new box when full", () => {
  assert.deepEqual(findFreeSlot([], 500), { boxId: null, boxCode: "B001", slot: 1 });
  const boxes = [
    { boxId: 2, code: "B002", capacity: 3, occupiedSlots: [] },
    { boxId: 1, code: "B001", capacity: 3, occupiedSlots: [1, 3] },
  ];
  assert.deepEqual(findFreeSlot(boxes, 3), { boxId: 1, boxCode: "B001", slot: 2 });
  const full = [{ boxId: 1, code: "B001", capacity: 2, occupiedSlots: [1, 2] }];
  assert.deepEqual(findFreeSlot(full, 2), { boxId: null, boxCode: "B002", slot: 1 });
  assert.equal(locationLabel("B001", 42), "B001-0042");
});

test("chaos: pick order walks box then slot", () => {
  const out = pickOrder([
    { boxCode: "B002", slot: 1 }, { boxCode: "B001", slot: 9 }, { boxCode: "B001", slot: 2 },
  ]);
  assert.deepEqual(out.map((o) => `${o.boxCode}:${o.slot}`), ["B001:2", "B001:9", "B002:1"]);
});

test("cardmarket: OAuth header signature matches independent computation", () => {
  const creds = { appToken: "app", appSecret: "s1", accessToken: "acc", accessSecret: "s2" };
  const url = "https://apiv2.cardmarket.com/ws/v2.0/output.json/stock";
  const h = mkmAuthHeader("POST", url, creds, "abc123", "1700000000");
  const params =
    "oauth_consumer_key=app&oauth_nonce=abc123&oauth_signature_method=HMAC-SHA1&oauth_timestamp=1700000000&oauth_token=acc&oauth_version=1.0";
  const base = `POST&${rfc3986(url)}&${rfc3986(params)}`;
  const sig = createHmac("sha1", "s1&s2").update(base).digest("base64");
  assert.ok(h.startsWith(`OAuth realm="${url}"`));
  assert.ok(h.includes(`oauth_signature="${sig}"`));
});

test("cardmarket: query params are signed but excluded from realm", () => {
  const creds = { appToken: "a", appSecret: "b", accessToken: "c", accessSecret: "d" };
  const h = mkmAuthHeader("GET", "https://x.test/ws/products/find?search=Bolt&idGame=1", creds, "n", "1");
  assert.ok(h.includes('realm="https://x.test/ws/products/find"'));
});

test("cardmarket: stock XML and chunking", () => {
  const xml = stockXml([{ idProduct: 123, language: "de", condition: "NM", foil: true, price: 1.5, count: 2, comments: "A&B" }]);
  assert.match(xml, /<idProduct>123<\/idProduct><idLanguage>3<\/idLanguage>/);
  assert.match(xml, /<comments>A&amp;B<\/comments>/);
  assert.match(xml, /<price>1.50<\/price>/);
  assert.equal(chunk([1, 2, 3, 4, 5], 2).length, 3);
});

test("cardmarket: CSV escapes and formats", () => {
  const csv = cardmarketCsv([{
    idProduct: 9, name: 'Jace, the "Mind" Sculptor', setCode: "wwk", setName: "Worldwake", collectorNumber: "31",
    language: "en", condition: "EX", foil: false, quantity: 1, price: 50, location: "B001-0001", skus: "C-000001",
  }]);
  const line = csv.split("\n")[1];
  assert.ok(line.startsWith('9,"Jace, the ""Mind"" Sculptor",WWK,Worldwake,31,English,EX,No,1,50.00,C-000001,B001-0001,C-000001'));
});
