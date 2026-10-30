// Card recognition: Claude vision reads name / set code / collector number / language
// from the photo, then Scryfall resolves the exact printing.
import { bySetNumber, fuzzyName, printings, type ScryfallCard } from "./scryfall";

export interface Reading {
  name: string | null;
  set_code: string | null;
  collector_number: string | null;
  language: string | null; // scryfall lang code
  foil: boolean | null;
  confidence: "high" | "medium" | "low";
}

export interface Recognition {
  reading: Reading | null;
  match: ScryfallCard | null;
  alternatives: ScryfallCard[]; // other printings to pick from
  error?: string;
}

const PROMPT = `You are reading a photo of a single Magic: The Gathering card.
Return ONLY a JSON object, no prose:
{"name": string|null, "set_code": string|null, "collector_number": string|null,
 "language": one of en,fr,de,es,it,pt,ja,ko,ru,zhs,zht or null,
 "foil": boolean|null, "confidence": "high"|"medium"|"low"}
- name: the English card name if you know it, else the printed name.
- set_code and collector_number: from the bottom-left info line (e.g. "0123/281 R" and "MKM • EN"). Strip leading zeros from the collector number but keep letters/symbols (e.g. "123a", "★").
- language: from the bottom-left language code.
- Use null for anything not legible. Do not guess set codes from art.`;

export async function readCardImage(base64: string, mediaType: string): Promise<Reading> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set — use manual search");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: PROMPT },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`Vision API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { content: { type: string; text?: string }[] };
  const text = json.content.find((c) => c.type === "text")?.text ?? "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Could not parse card reading");
  return JSON.parse(m[0]) as Reading;
}

export async function resolve(reading: Reading): Promise<Recognition> {
  let match: ScryfallCard | null = null;
  if (reading.set_code && reading.collector_number) {
    match = await bySetNumber(reading.set_code, reading.collector_number, reading.language ?? undefined);
    // Sanity check: set/number read wrong but name right -> don't trust it
    // (only checked for English cards; localized cards may print a translated name)
    if (match && reading.name && (reading.language ?? "en") === "en" && !match.name.toLowerCase().includes(reading.name.toLowerCase().split(" //")[0])) {
      match = null;
    }
  }
  if (!match && reading.name) match = await fuzzyName(reading.name);
  const alternatives = match ? await printings(match.name) : [];
  return { reading, match, alternatives };
}

export async function recognize(base64: string, mediaType: string): Promise<Recognition> {
  try {
    return await resolve(await readCardImage(base64, mediaType));
  } catch (e) {
    return { reading: null, match: null, alternatives: [], error: (e as Error).message };
  }
}
