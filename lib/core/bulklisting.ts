// Files for Cardmarket's "Bulk listing" page, filled by the Cardmarket Bulk Import extension.
// Pure and unit-tested. What the extension needs (read from its source):
//  - It only fills cards that are shown on the open Bulk listing page, so one file per expansion.
//  - If a Set column is mapped and the page URL has no matching idExpansion, it disables every
//    row. So these files have NO set column; the page itself picks the expansion.
//  - The page takes at most 100 rows at a time.
import { parseCsv } from "./manabox.ts";

export interface BulkRow {
  name: string;
  language: string; // scryfall code
  condition: string; // MT..PO
  foil: boolean;
  quantity: number;
  price: number;
  comment: string; // SKUs
}

const LANGUAGE_NAME: Record<string, string> = {
  en: "English", fr: "French", de: "German", es: "Spanish", it: "Italian",
  zhs: "S-Chinese", ja: "Japanese", pt: "Portuguese", ru: "Russian", ko: "Korean", zht: "T-Chinese",
};

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Column names match the extension's field names, so it maps them automatically. */
export function bulkCsv(rows: BulkRow[]): string {
  const head = ["Name", "Language", "Condition", "Foil", "Quantity", "Price", "Comment"];
  const lines = rows.map((r) =>
    [r.name, LANGUAGE_NAME[r.language] ?? r.language, r.condition, r.foil ? "Yes" : "No", r.quantity, r.price.toFixed(2), r.comment]
      .map(cell).join(","),
  );
  return [head.join(","), ...lines].join("\n") + "\n";
}

export interface CopyIn {
  id: number;
  sku: string | null;
  name: string;
  setCode: string;
  setName: string;
  rarity: string;
  language: string;
  condition: string;
  foil: boolean;
  price: number;
}

export interface SetGroup {
  setCode: string;
  setName: string;
  rows: (BulkRow & { ids: number[]; rarity: string })[];
  copies: number;
  value: number;
}

const RARITY_ORDER: Record<string, number> = { mythic: 0, rare: 1, uncommon: 2, common: 3 };

/** One group per expansion; identical copies (same card/lang/cond/foil/price) become one row. */
export function groupBySet(copies: CopyIn[]): SetGroup[] {
  const sets = new Map<string, SetGroup>();
  for (const c of copies) {
    const g = sets.get(c.setCode) ?? { setCode: c.setCode, setName: c.setName, rows: [], copies: 0, value: 0 };
    sets.set(c.setCode, g);
    const sku = c.sku ?? `#${c.id}`;
    const same = g.rows.find((r) => r.name === c.name && r.language === c.language && r.condition === c.condition && r.foil === c.foil && r.price === c.price);
    if (same) { same.quantity++; same.ids.push(c.id); same.comment += ` ${sku}`; }
    else g.rows.push({ name: c.name, language: c.language, condition: c.condition, foil: c.foil, quantity: 1, price: c.price, comment: sku, ids: [c.id], rarity: c.rarity });
    g.copies++;
    g.value = Math.round((g.value + c.price) * 100) / 100;
  }
  for (const g of sets.values()) {
    g.rows.sort((a, b) => (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9) || a.name.localeCompare(b.name));
  }
  return [...sets.values()].sort((a, b) => a.setName.localeCompare(b.setName));
}

export interface McmSet { mcmId: number; mcmName: string | null }

/** Parses MTGJSON's sets.csv into set code → Cardmarket expansion id/name. */
export function parseMtgjsonSets(csv: string): Map<string, McmSet> {
  const table = parseCsv(csv);
  const head = table[0] ?? [];
  const iCode = head.indexOf("code"), iId = head.indexOf("mcmId"), iName = head.indexOf("mcmName");
  const out = new Map<string, McmSet>();
  if (iCode < 0 || iId < 0) return out;
  for (const r of table.slice(1)) {
    const id = Number(r[iId]);
    if (r[iCode] && id > 0) out.set(r[iCode].toLowerCase(), { mcmId: id, mcmName: iName >= 0 ? r[iName] || null : null });
  }
  return out;
}

export function bulkListingUrl(mcmId: number | null): string {
  const base = "https://www.cardmarket.com/en/Magic/Stock/ListingMethods/BulkListing";
  return mcmId ? `${base}?idExpansion=${mcmId}` : base;
}
