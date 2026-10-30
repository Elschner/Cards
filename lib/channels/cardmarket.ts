// Cardmarket channel. Two methods behind one interface:
//  - CSV: always available. Produces a file for Cardmarket's bulk listing flow.
//  - API: MKM API 2.0 POST /stock. Only works if you hold Dedicated App credentials
//    (Cardmarket is not accepting new API applications at the moment).
import { prisma } from "../db";
import { locationLabel } from "../core/chaos";
import { cardmarketCsv, chunk, groupForListing, mkmAuthHeader, stockXml, type CsvRow } from "../core/cardmarket";

export function apiConfigured() {
  return Boolean(
    process.env.CARDMARKET_APP_TOKEN && process.env.CARDMARKET_APP_SECRET &&
      process.env.CARDMARKET_ACCESS_TOKEN && process.env.CARDMARKET_ACCESS_SECRET,
  );
}

async function loadListable(itemIds: number[]) {
  const items = await prisma.inventoryItem.findMany({
    where: { id: { in: itemIds }, status: "IN_STOCK", askPrice: { not: null } },
    include: { card: true, box: true },
  });
  return items.map((it) => ({
    it,
    idProduct: it.card.cardmarketId,
    key: `${it.card.cardmarketId}|${it.language}|${it.condition}|${it.foil}`,
    price: it.askPrice!,
  }));
}

export async function exportCsv(itemIds: number[], markListed: boolean) {
  const rows = await loadListable(itemIds);
  const groups = groupForListing(rows);
  const csvRows: CsvRow[] = groups.map((g) => {
    const f = g[0].it;
    return {
      idProduct: f.card.cardmarketId, name: f.card.name, setCode: f.card.setCode, setName: f.card.setName,
      collectorNumber: f.card.collectorNumber, language: f.language, condition: f.condition, foil: f.foil,
      quantity: g.length, price: g[0].price,
      location: g.map((x) => (x.it.box && x.it.slot ? locationLabel(x.it.box.code, x.it.slot) : "")).join(" "),
      inventoryIds: g.map((x) => x.it.id).join(" "),
    };
  });
  if (markListed) {
    for (const r of rows) {
      await prisma.listing.create({ data: { itemId: r.it.id, channel: "CARDMARKET", method: "CSV", price: r.price, status: "ACTIVE" } });
      await prisma.inventoryItem.update({ where: { id: r.it.id }, data: { status: "LISTED" } });
    }
  }
  return { csv: cardmarketCsv(csvRows), rows: csvRows.length, copies: rows.length };
}

interface InsertResult { success?: boolean; idArticle?: { idArticle?: number }; error?: string }

export async function pushViaApi(itemIds: number[]) {
  if (!apiConfigured()) throw new Error("Cardmarket API credentials not configured");
  const creds = {
    appToken: process.env.CARDMARKET_APP_TOKEN!, appSecret: process.env.CARDMARKET_APP_SECRET!,
    accessToken: process.env.CARDMARKET_ACCESS_TOKEN!, accessSecret: process.env.CARDMARKET_ACCESS_SECRET!,
  };
  const dryRun = process.env.CARDMARKET_DRY_RUN !== "false";
  const url = `${process.env.CARDMARKET_API_BASE || "https://apiv2.cardmarket.com/ws/v2.0/output.json"}/stock`;

  const rows = (await loadListable(itemIds)).filter((r) => r.idProduct != null);
  const groups = groupForListing(rows);
  const results = { listed: 0, failed: 0, skippedNoProduct: itemIds.length - rows.length, dryRun, errors: [] as string[] };

  for (const batch of chunk(groups, 100)) {
    const xml = stockXml(batch.map((g) => ({
      idProduct: g[0].idProduct!, language: g[0].it.language, condition: g[0].it.condition,
      foil: g[0].it.foil, price: g[0].price, count: g.length,
    })));
    let inserted: InsertResult[] = [];
    if (dryRun) {
      console.log("[cardmarket dry-run] POST", url, "\n", xml);
      inserted = batch.map(() => ({ success: true }));
    } else {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: mkmAuthHeader("POST", url, creds), "Content-Type": "application/xml" },
        body: xml,
      });
      if (!res.ok) {
        const msg = `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`;
        results.errors.push(msg);
        inserted = batch.map(() => ({ success: false, error: msg }));
      } else {
        const json = (await res.json()) as { inserted?: InsertResult[] | InsertResult };
        inserted = Array.isArray(json.inserted) ? json.inserted : json.inserted ? [json.inserted] : [];
      }
    }
    for (let i = 0; i < batch.length; i++) {
      const r = inserted[i] ?? { success: false, error: "No result returned" };
      for (const x of batch[i]) {
        await prisma.listing.create({
          data: {
            itemId: x.it.id, channel: "CARDMARKET", method: dryRun ? "API_DRYRUN" : "API", price: x.price,
            status: r.success ? (dryRun ? "PENDING" : "ACTIVE") : "FAILED",
            externalId: r.idArticle?.idArticle ? String(r.idArticle.idArticle) : null,
            error: r.success ? null : r.error ?? "Unknown error",
          },
        });
        if (r.success && !dryRun) await prisma.inventoryItem.update({ where: { id: x.it.id }, data: { status: "LISTED" } });
      }
      if (r.success) results.listed += batch[i].length;
      else results.failed += batch[i].length;
    }
  }
  return results;
}
