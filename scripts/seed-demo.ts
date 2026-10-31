// Demo data for design previews and CI screenshots. Never run against your real database:
//   DATABASE_URL="file:./demo.db" npx prisma db push && DATABASE_URL="file:./demo.db" node --experimental-strip-types scripts/seed-demo.ts
import { PrismaClient } from "@prisma/client";
import { allocateCost } from "../lib/core/allocation.ts";

const prisma = new PrismaClient();

const CARDS: [string, string, string, string, number, string, number][] = [
  // name, set, setName, number, eur, rarity, cardmarketId
  ["Ragavan, Nimble Pilferer", "mh2", "Modern Horizons 2", "138", 38.5, "mythic", 566001],
  ["Sheoldred, the Apocalypse", "dmu", "Dominaria United", "107", 62.0, "mythic", 566002],
  ["The One Ring", "ltr", "The Lord of the Rings: Tales of Middle-earth", "246", 54.9, "mythic", 566003],
  ["Fable of the Mirror-Breaker", "neo", "Kamigawa: Neon Dynasty", "141", 14.2, "rare", 566004],
  ["Generous Gift", "lcc", "The Lost Caverns of Ixalan Commander", "128", 0.94, "uncommon", 743481],
  ["Read the Bones", "dsc", "Duskmourn: House of Horror Commander", "154", 0.34, "common", 788782],
  ["Witch of the Moors", "otc", "Outlaws of Thunder Junction Commander", "152", 1.73, "rare", 764742],
  ["Nykthos Paragon", "mh2", "Modern Horizons 2", "22", 0.36, "rare", 566889],
  ["Sol Ring", "cmm", "Commander Masters", "410", 1.2, "uncommon", 566005],
  ["Arcane Signet", "cmm", "Commander Masters", "373", 0.6, "common", 566006],
  ["Swords to Plowshares", "sta", "Strixhaven Mystical Archive", "10", 3.4, "uncommon", 566007],
  ["Cultivate", "m21", "Core Set 2021", "177", 0.25, "common", 566008],
  ["Llanowar Elves", "dom", "Dominaria", "168", 0.18, "common", 566009],
  ["Lightning Bolt", "2xm", "Double Masters", "129", 1.05, "uncommon", 566010],
];

async function main() {
  await prisma.listing.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.box.deleteMany();
  await prisma.card.deleteMany();

  for (const [name, set, setName, number, eur, rarity, cmId] of CARDS) {
    await prisma.card.create({
      data: {
        scryfallId: `demo-${set}-${number}`, name, setCode: set, setName, collectorNumber: number, lang: "en",
        rarity, cardmarketId: cmId, priceEur: eur, priceEurFoil: eur * 1.8, pricesUpdatedAt: new Date(),
      },
    });
  }
  const box = await prisma.box.create({ data: { code: "B001", capacity: 500 } });

  const lots = [
    { name: "Samling fra DBA, Peter", totalCost: 120, purchasedAt: new Date("2026-10-12"), cards: [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 13, 12] },
    { name: "Bulk-kasse fra spilaften", totalCost: 35, purchasedAt: new Date("2026-10-24"), cards: [1, 8, 9, 11, 12, 13, 4, 5] },
  ];
  let slot = 1;
  for (const [li, l] of lots.entries()) {
    const p = await prisma.purchase.create({ data: { name: l.name, totalCost: l.totalCost, purchasedAt: l.purchasedAt, method: "VALUE" } });
    const prices = l.cards.map((c) => CARDS[c][4]);
    const costs = allocateCost(l.totalCost, prices, "VALUE");
    for (const [i, c] of l.cards.entries()) {
      const [, set, , number, eur] = CARDS[c];
      // First lot: several sold and listed. Second lot: freshly imported.
      const status = li === 0 ? (i < 4 ? "SOLD" : i < 9 ? "LISTED" : "IN_STOCK") : "IN_STOCK";
      await prisma.inventoryItem.create({
        data: {
          scryfallId: `demo-${set}-${number}`, condition: i % 5 === 3 ? "EX" : "NM", foil: i === 6, language: i === 7 ? "de" : "en",
          status, purchaseId: p.id, askPrice: eur, costBasis: costs[i],
          soldPrice: status === "SOLD" ? Math.round(eur * 0.97 * 100) / 100 : null,
          soldAt: status === "SOLD" ? new Date("2026-10-28") : null,
          boxId: status === "SOLD" ? null : box.id, slot: status === "SOLD" ? null : slot++,
        },
      });
    }
  }
  console.log("Demo data ready");
}

main().finally(() => prisma.$disconnect());
