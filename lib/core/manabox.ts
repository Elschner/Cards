// ManaBox CSV export → import rows. Pure: no I/O, unit-tested in tests/manabox.test.ts.
// Header seen in a real export:
// Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,
// Misprint,Altered,Signed,Condition,Language,Proxy,Purchase price currency,Added
import type { Condition } from "./pricing.ts";

/** RFC 4180 CSV parser (quoted fields, escaped quotes, commas/newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

export const MANABOX_CONDITION: Record<string, Condition> = {
  mint: "MT", near_mint: "NM", excellent: "EX", good: "GD",
  light_played: "LP", lightly_played: "LP", played: "PL", poor: "PO",
};

export interface ImportRow {
  line: number; // line in the file (header = 1)
  name: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  scryfallId: string;
  foil: boolean;
  quantity: number;
  condition: Condition;
  language: string;
  purchasePrice: number | null;
  purchaseCurrency: string | null;
  added: string | null;
  flags: string[]; // signed / altered / misprint — imported, but flagged
  skip: string | null; // reason the row will not be imported (e.g. proxy)
}

export interface ParseResult {
  rows: ImportRow[];
  errors: string[];
}

const REQUIRED = ["Name", "Scryfall ID", "Quantity", "Condition", "Language", "Foil"];
const truthy = (v: string | undefined) => (v ?? "").trim().toLowerCase() === "true";

export function parseManabox(text: string): ParseResult {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], errors: ["The file is empty"] };
  const header = table[0].map((h) => h.trim());
  const missing = REQUIRED.filter((h) => !header.includes(h));
  if (missing.length) return { rows: [], errors: [`Not a ManaBox export: missing columns ${missing.join(", ")}`] };
  const col = (r: string[], name: string) => r[header.indexOf(name)]?.trim() ?? "";

  const rows: ImportRow[] = [];
  const errors: string[] = [];
  table.slice(1).forEach((r, idx) => {
    const line = idx + 2;
    const condRaw = col(r, "Condition").toLowerCase();
    const condition = MANABOX_CONDITION[condRaw];
    const qty = Number.parseInt(col(r, "Quantity"), 10);
    const scryfallId = col(r, "Scryfall ID");
    const name = col(r, "Name");
    if (!/^[0-9a-f-]{36}$/i.test(scryfallId)) { errors.push(`Line ${line} (${name}): missing a valid Scryfall ID`); return; }
    if (!condition) { errors.push(`Line ${line} (${name}): unknown condition "${condRaw}"`); return; }
    if (!(qty > 0)) { errors.push(`Line ${line} (${name}): invalid quantity`); return; }

    const flags: string[] = [];
    if (truthy(col(r, "Signed"))) flags.push("Signed");
    if (truthy(col(r, "Altered"))) flags.push("Altered");
    if (truthy(col(r, "Misprint"))) flags.push("Misprint");
    const priceRaw = Number.parseFloat(col(r, "Purchase price"));
    const foilRaw = col(r, "Foil").toLowerCase();

    rows.push({
      line, name, scryfallId,
      setCode: col(r, "Set code"), setName: col(r, "Set name"), collectorNumber: col(r, "Collector number"),
      foil: foilRaw === "foil" || foilRaw === "etched",
      quantity: qty,
      condition,
      language: col(r, "Language").toLowerCase() || "en",
      purchasePrice: Number.isFinite(priceRaw) && priceRaw > 0 ? priceRaw : null,
      purchaseCurrency: col(r, "Purchase price currency") || null,
      added: col(r, "Added") || null,
      flags,
      skip: truthy(col(r, "Proxy")) ? "Proxy, not for sale" : null,
    });
  });
  // Keep scan order: ManaBox 'Added' timestamps, oldest first (stable for equal/missing).
  rows.sort((a, b) => (a.added && b.added ? a.added.localeCompare(b.added) : 0));
  return { rows, errors };
}
