// CSV for TCG PowerTools' "Import a file" (Listing & Appraisal). Pure, unit-tested.
// Header taken from PowerTools' own example file:
// cardmarketId,quantity,name,set,condition,language,isSigned,price,comment,finishType,buyPrice
// PowerTools matches on cardmarketId, so all sets can go in one file.

export interface PtCopy {
  id: number;
  sku: string | null;
  cardmarketId: number | null;
  name: string;
  set: string; // Cardmarket expansion name when known
  condition: string; // MT..PO
  language: string; // scryfall code
  foil: boolean;
  price: number; // EUR
  cost: number | null; // EUR, allocated purchase cost
}

const LANGUAGE_NAME: Record<string, string> = {
  en: "English", fr: "French", de: "German", es: "Spanish", it: "Italian",
  zhs: "S-Chinese", ja: "Japanese", pt: "Portuguese", ru: "Russian", ko: "Korean", zht: "T-Chinese",
};

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export interface PtRow { copies: PtCopy[]; key: string }

/** Identical copies (product, condition, language, finish, price) become one row. */
export function groupForPowertools(copies: PtCopy[]): { rows: PtRow[]; missingId: PtCopy[] } {
  const rows = new Map<string, PtRow>();
  const missingId: PtCopy[] = [];
  for (const c of copies) {
    if (!c.cardmarketId) { missingId.push(c); continue; }
    const key = `${c.cardmarketId}|${c.condition}|${c.language}|${c.foil}|${c.price.toFixed(2)}`;
    const r = rows.get(key) ?? { copies: [], key };
    r.copies.push(c);
    rows.set(key, r);
  }
  const sorted = [...rows.values()].sort((a, b) =>
    a.copies[0].set.localeCompare(b.copies[0].set) || a.copies[0].name.localeCompare(b.copies[0].name));
  return { rows: sorted, missingId };
}

export function powertoolsCsv(rows: PtRow[]): string {
  const head = "cardmarketId,quantity,name,set,condition,language,isSigned,price,comment,finishType,buyPrice";
  const lines = rows.map(({ copies }) => {
    const c = copies[0];
    const costs = copies.map((x) => x.cost).filter((x): x is number => x != null);
    const buy = costs.length ? (costs.reduce((a, b) => a + b, 0) / costs.length).toFixed(2) : "";
    return [
      c.cardmarketId!, copies.length, c.name, c.set, c.condition, LANGUAGE_NAME[c.language] ?? c.language,
      "false", c.price.toFixed(2), copies.map((x) => x.sku ?? `#${x.id}`).join(" "), c.foil ? "Foil" : "Regular", buy,
    ].map(cell).join(",");
  });
  return [head, ...lines].join("\n") + "\n";
}
