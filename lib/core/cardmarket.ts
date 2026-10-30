// Pure Cardmarket helpers: OAuth 1.0 signing (MKM API 2.0), article XML, CSV export.
import { createHmac, randomBytes } from "node:crypto";

// Scryfall lang code -> Cardmarket idLanguage
export const MKM_LANGUAGE: Record<string, number> = {
  en: 1, fr: 2, de: 3, es: 4, it: 5, zhs: 6, ja: 7, pt: 8, ru: 9, ko: 10, zht: 11,
};

export function rfc3986(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

export interface MkmCredentials {
  appToken: string;
  appSecret: string;
  accessToken: string;
  accessSecret: string;
}

/** Builds the Authorization header Cardmarket's API expects (OAuth 1.0, HMAC-SHA1, realm = URL). */
export function mkmAuthHeader(
  method: string,
  url: string,
  creds: MkmCredentials,
  nonce: string = randomBytes(16).toString("hex"),
  timestamp: string = Math.floor(Date.now() / 1000).toString(),
): string {
  const u = new URL(url);
  const baseUrl = `${u.origin}${u.pathname}`;
  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.appToken,
    oauth_token: creds.accessToken,
    oauth_nonce: nonce,
    oauth_timestamp: timestamp,
    oauth_signature_method: "HMAC-SHA1",
    oauth_version: "1.0",
  };
  const params: [string, string][] = [...Object.entries(oauth), ...u.searchParams.entries()];
  const paramString = params
    .map(([k, v]) => [rfc3986(k), rfc3986(v)] as [string, string])
    .sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const baseString = [method.toUpperCase(), rfc3986(baseUrl), rfc3986(paramString)].join("&");
  const key = `${rfc3986(creds.appSecret)}&${rfc3986(creds.accessSecret)}`;
  const signature = createHmac("sha1", key).update(baseString).digest("base64");
  const header = { realm: baseUrl, ...oauth, oauth_signature: signature };
  return "OAuth " + Object.entries(header).map(([k, v]) => `${k}="${v}"`).join(", ");
}

export interface ArticleInput {
  idProduct: number;
  language: string; // scryfall lang code
  condition: string; // MT..PO
  foil: boolean;
  price: number;
  count: number;
  comments?: string;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Body for POST /stock. Cardmarket accepts up to 100 articles per request. */
export function stockXml(articles: ArticleInput[]): string {
  const body = articles
    .map(
      (a) =>
        `<article><idProduct>${a.idProduct}</idProduct><idLanguage>${MKM_LANGUAGE[a.language] ?? 1}</idLanguage>` +
        `<comments>${xmlEscape(a.comments ?? "")}</comments><count>${a.count}</count><price>${a.price.toFixed(2)}</price>` +
        `<condition>${a.condition}</condition><isFoil>${a.foil}</isFoil><isSigned>false</isSigned><isPlayset>false</isPlayset></article>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" ?><request>${body}</request>`;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export interface CsvRow {
  idProduct: number | null;
  name: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  language: string;
  condition: string;
  foil: boolean;
  quantity: number;
  price: number;
  location: string;
  inventoryIds: string;
}

function csvCell(v: string | number | boolean | null): string {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const LANGUAGE_NAME: Record<string, string> = {
  en: "English", fr: "French", de: "German", es: "Spanish", it: "Italian",
  zhs: "S-Chinese", ja: "Japanese", pt: "Portuguese", ru: "Russian", ko: "Korean", zht: "T-Chinese",
};

/** CSV for Cardmarket bulk-listing workflows (bulk listing form / import extensions / PowerTools). */
export function cardmarketCsv(rows: CsvRow[]): string {
  const header = [
    "idProduct", "Name", "Set code", "Expansion", "Collector number", "Language", "Condition",
    "Foil", "Quantity", "Price", "Comment", "Location", "Inventory IDs",
  ];
  const lines = rows.map((r) =>
    [
      r.idProduct, r.name, r.setCode.toUpperCase(), r.setName, r.collectorNumber,
      LANGUAGE_NAME[r.language] ?? r.language, r.condition, r.foil ? "Yes" : "No",
      r.quantity, r.price.toFixed(2), "", r.location, r.inventoryIds,
    ].map(csvCell).join(","),
  );
  return [header.join(","), ...lines].join("\n") + "\n";
}

/** Group identical copies (same printing/lang/condition/foil/price) into one listing row. */
export function groupForListing<T extends { idProduct: number | null; key: string; price: number }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const k = `${it.key}|${it.price.toFixed(2)}`;
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  return [...groups.values()];
}
