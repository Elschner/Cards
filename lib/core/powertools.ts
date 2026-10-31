// CSV for TCG PowerTools' "Import a file" (Listing & Appraisal). Pure, unit-tested.
// Header taken from PowerTools' own example file:
// cardmarketId,quantity,name,set,condition,language,isSigned,price,comment,finishType,buyPrice
// PowerTools matches on cardmarketId, so all sets can go in one file.
//
// One row per physical copy, with its storage location and SKU in the comment
// ("B001-0042 C-000123"). PowerTools has no location column, but the comment travels to
// PowerTools and Cardmarket, so every sold article tells you which slot to pick from.

export interface PtCopy {
  id: number;
  sku: string | null;
  location: string | null; // B001-0042
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

export const ptComment = (c: Pick<PtCopy, "location" | "sku" | "id">) =>
  [c.location, c.sku ?? `#${c.id}`].filter(Boolean).join(" ");

/** Copies with a Cardmarket ID, sorted by set and name; the rest are returned separately. */
export function prepareForPowertools(copies: PtCopy[]): { rows: PtCopy[]; missingId: PtCopy[] } {
  const rows = copies.filter((c) => c.cardmarketId)
    .sort((a, b) => a.set.localeCompare(b.set) || a.name.localeCompare(b.name) || (a.location ?? "").localeCompare(b.location ?? ""));
  return { rows, missingId: copies.filter((c) => !c.cardmarketId) };
}

export function powertoolsCsv(rows: PtCopy[]): string {
  const head = "cardmarketId,quantity,name,set,condition,language,isSigned,price,comment,finishType,buyPrice";
  const lines = rows.map((c) =>
    [
      c.cardmarketId!, 1, c.name, c.set, c.condition, LANGUAGE_NAME[c.language] ?? c.language,
      "false", c.price.toFixed(2), ptComment(c), c.foil ? "Foil" : "Regular", c.cost != null ? c.cost.toFixed(2) : "",
    ].map(cell).join(","),
  );
  return [head, ...lines].join("\n") + "\n";
}
