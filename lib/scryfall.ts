// Scryfall client: card lookup, printings, prices. Respects Scryfall's rules:
// descriptive User-Agent + Accept header, ~10 req/s max.
import { prisma } from "./db";

const BASE = "https://api.scryfall.com";
let lastCall = 0;

async function sf<T>(path: string, body?: unknown): Promise<T | null> {
  const wait = lastCall + 110 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const res = await fetch(BASE + path, {
    method: body ? "POST" : "GET",
    headers: {
      "User-Agent": process.env.SCRYFALL_USER_AGENT || "CardOps/0.1",
      Accept: "application/json;q=0.9,*/*;q=0.8",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Scryfall ${res.status} on ${path}`);
  return (await res.json()) as T;
}

export interface ScryfallCard {
  id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  lang: string;
  rarity: string;
  cardmarket_id?: number;
  finishes?: string[];
  image_uris?: { small: string; normal: string };
  card_faces?: { image_uris?: { small: string; normal: string } }[];
  prices: { eur: string | null; eur_foil: string | null };
}

export function imageOf(c: ScryfallCard): string | null {
  return c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal ?? null;
}

const num = (s: string | null | undefined) => (s ? Number(s) : null);

export async function bySetNumber(set: string, number: string, lang?: string) {
  const p = `/cards/${encodeURIComponent(set.toLowerCase())}/${encodeURIComponent(number)}`;
  if (lang && lang !== "en") {
    const localized = await sf<ScryfallCard>(`${p}/${lang}`);
    if (localized) return localized;
  }
  return sf<ScryfallCard>(p);
}

export async function fuzzyName(name: string) {
  return sf<ScryfallCard>(`/cards/named?fuzzy=${encodeURIComponent(name)}`);
}

/** All paper printings of a card name, newest first. Used for the "pick printing" dropdown. */
export async function printings(name: string): Promise<ScryfallCard[]> {
  const q = encodeURIComponent(`!"${name}" game:paper`);
  const res = await sf<{ data: ScryfallCard[] }>(`/cards/search?q=${q}&unique=prints&order=released`);
  return res?.data ?? [];
}

export async function autocomplete(q: string): Promise<string[]> {
  const res = await sf<{ data: string[] }>(`/cards/autocomplete?q=${encodeURIComponent(q)}`);
  return res?.data ?? [];
}

export async function byId(id: string) {
  return sf<ScryfallCard>(`/cards/${id}`);
}

/** Fetch many cards by Scryfall id — 75 per request (Scryfall's collection limit). */
export async function byIds(ids: string[]): Promise<ScryfallCard[]> {
  const out: ScryfallCard[] = [];
  for (let i = 0; i < ids.length; i += 75) {
    const res = await sf<{ data: ScryfallCard[] }>("/cards/collection", {
      identifiers: ids.slice(i, i + 75).map((id) => ({ id })),
    });
    out.push(...(res?.data ?? []));
  }
  return out;
}

/**
 * Cache a printing locally. Prices: for non-English printings Scryfall usually has no
 * price, so we fall back to the English printing's price (Cardmarket trend is per product,
 * and all languages share one Cardmarket product).
 */
export async function upsertCard(c: ScryfallCard) {
  let eur = num(c.prices.eur);
  let eurFoil = num(c.prices.eur_foil);
  if (eur == null && eurFoil == null && c.lang !== "en") {
    const en = await bySetNumber(c.set, c.collector_number);
    if (en) {
      eur = num(en.prices.eur);
      eurFoil = num(en.prices.eur_foil);
      c.cardmarket_id ??= en.cardmarket_id;
    }
  }
  const data = {
    name: c.name,
    setCode: c.set,
    setName: c.set_name,
    collectorNumber: c.collector_number,
    lang: c.lang,
    rarity: c.rarity,
    cardmarketId: c.cardmarket_id ?? null,
    imageUrl: imageOf(c),
    priceEur: eur,
    priceEurFoil: eurFoil,
    pricesUpdatedAt: new Date(),
  };
  return prisma.card.upsert({ where: { scryfallId: c.id }, create: { scryfallId: c.id, ...data }, update: data });
}
