// Cardmarket channel. Two methods behind one interface:
//  - CSV: always available. Produces a file for Cardmarket's bulk listing flow.
//  - API: MKM API 2.0 POST /stock. Only works if you hold Dedicated App credentials
//    (Cardmarket is not accepting new API applications at the moment).
import { prisma } from "../db";
import { locationLabel } from "../core/chaos";
import { bulkCsv, bulkListingUrl, groupBySet } from "../core/bulklisting";
import { cardmarketSets } from "../mtgjson";
import { prepareForPowertools, powertoolsCsv } from "../core/powertools";
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
      skus: g.map((x) => x.it.sku ?? `#${x.it.id}`).join(" "),
    };
  });
  // Sort by expansion: Cardmarket's bulk listing works one expansion at a time.
  csvRows.sort((a, b) => a.setName.localeCompare(b.setName) || a.name.localeCompare(b.name));
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

// ---------- Bulk listing (manual upload with the Cardmarket Bulk Import extension) ----------

/** In-stock, priced copies grouped by expansion, with a direct Cardmarket link per set. */
export async function bulkGroups(itemIds?: number[]) {
  const items = await prisma.inventoryItem.findMany({
    where: { status: "IN_STOCK", askPrice: { not: null }, ...(itemIds ? { id: { in: itemIds } } : {}) },
    include: { card: true },
  });
  const groups = groupBySet(items.map((it) => ({
    id: it.id, sku: it.sku, name: it.card.name, setCode: it.card.setCode, setName: it.card.setName,
    rarity: it.card.rarity, language: it.language, condition: it.condition, foil: it.foil, price: it.askPrice!,
  })));
  const mcm = await cardmarketSets();
  return groups.map((g) => {
    const m = mcm.get(g.setCode) ?? null;
    // The Bulk listing page takes 100 rows at a time: split big sets into parts.
    const parts = chunk(g.rows, 100).map((rows, i) => ({
      part: i + 1, rows: rows.length, copies: rows.reduce((n, r) => n + r.quantity, 0),
      ids: rows.flatMap((r) => r.ids), csv: bulkCsv(rows),
    }));
    return {
      setCode: g.setCode, setName: g.setName, cardmarketName: m?.mcmName ?? null, url: bulkListingUrl(m?.mcmId ?? null),
      copies: g.copies, value: g.value, rows: g.rows, parts,
    };
  });
}

/** Call after the cards are actually put up for sale on Cardmarket. Only in-stock copies change. */
export async function markListed(itemIds: number[]) {
  const items = await prisma.inventoryItem.findMany({ where: { id: { in: itemIds }, status: "IN_STOCK" }, select: { id: true, askPrice: true } });
  await prisma.$transaction([
    ...items.map((it) => prisma.listing.create({ data: { itemId: it.id, channel: "CARDMARKET", method: "BULK", price: it.askPrice ?? 0, status: "ACTIVE" } })),
    prisma.inventoryItem.updateMany({ where: { id: { in: items.map((i) => i.id) } }, data: { status: "LISTED" } }),
  ]);
  return { listed: items.length };
}

/** One file with every in-stock card for TCG PowerTools (matches on cardmarketId, all sets at once). */
export async function powertoolsExport(itemIds?: number[]) {
  const items = await prisma.inventoryItem.findMany({
    where: { status: "IN_STOCK", askPrice: { not: null }, ...(itemIds ? { id: { in: itemIds } } : {}) },
    include: { card: true, box: true },
  });
  const mcm = await cardmarketSets();
  const { rows, missingId } = prepareForPowertools(items.map((it) => ({
    id: it.id, sku: it.sku, location: it.box && it.slot ? locationLabel(it.box.code, it.slot) : null,
    cardmarketId: it.card.cardmarketId, name: it.card.name,
    set: mcm.get(it.card.setCode)?.mcmName ?? it.card.setName,
    condition: it.condition, language: it.language, foil: it.foil, price: it.askPrice!, cost: it.costBasis,
  })));
  return {
    csv: powertoolsCsv(rows), rows: rows.length, copies: rows.length, ids: rows.map((r) => r.id),
    value: Math.round(rows.reduce((s, r) => s + r.price, 0) * 100) / 100,
    missing: missingId.map((m) => ({ sku: m.sku, name: m.name, set: m.set })),
  };
}
