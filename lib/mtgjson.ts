// Cardmarket expansion ids/names per set code, from MTGJSON (the same source the Cardmarket
// Bulk Import extension uses). Cached in memory; the app works without it (no direct link).
import { parseMtgjsonSets, type McmSet } from "./core/bulklisting";

const URL = "https://mtgjson.com/api/v5/csv/sets.csv";
const TTL = 24 * 60 * 60 * 1000;
let cache: { at: number; sets: Map<string, McmSet> } | null = null;

export async function cardmarketSets(): Promise<Map<string, McmSet>> {
  if (cache && Date.now() - cache.at < TTL) return cache.sets;
  try {
    const res = await fetch(URL, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(String(res.status));
    const sets = parseMtgjsonSets(await res.text());
    if (sets.size) cache = { at: Date.now(), sets };
    return sets;
  } catch {
    return cache?.sets ?? new Map();
  }
}
