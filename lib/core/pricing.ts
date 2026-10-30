// Pure pricing logic — no I/O, unit-tested in tests/pricing.test.ts.
// Base price is the Cardmarket trend (via Scryfall's EUR prices, which Scryfall sources
// from Cardmarket). Adjust the rules below as you learn what sells.

export const CONDITIONS = ["MT", "NM", "EX", "GD", "LP", "PL", "PO"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CONDITION_LABELS: Record<Condition, string> = {
  MT: "Mint",
  NM: "Near Mint",
  EX: "Excellent",
  GD: "Good",
  LP: "Light Played",
  PL: "Played",
  PO: "Poor",
};

export interface PricingRules {
  conditionMultiplier: Record<Condition, number>;
  /** Multiplier applied for non-English copies (most MTG non-EN sells at a discount). */
  nonEnglishMultiplier: number;
  /** 0.95 = list 5% under trend to sell faster. */
  trendMultiplier: number;
  /** Never list below this (EUR). Covers fees + shipping overhead on bulk. */
  floor: number;
  /** Cards whose computed price is below this are flagged as bulk instead of listed singly. */
  bulkThreshold: number;
}

export const DEFAULT_RULES: PricingRules = {
  conditionMultiplier: { MT: 1.0, NM: 1.0, EX: 0.85, GD: 0.75, LP: 0.65, PL: 0.5, PO: 0.3 },
  nonEnglishMultiplier: 0.9,
  trendMultiplier: 1.0,
  floor: 0.15,
  bulkThreshold: 0.25,
};

export interface PriceInput {
  priceEur: number | null;
  priceEurFoil: number | null;
  foil: boolean;
  condition: Condition;
  language: string;
}

export interface PriceResult {
  price: number | null; // null = no market data, needs manual price
  basis: number | null;
  isBulk: boolean;
  reason: string;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeAskPrice(input: PriceInput, rules: PricingRules = DEFAULT_RULES): PriceResult {
  // Foil copies use the foil trend; fall back to non-foil trend only if foil is missing.
  const basis = input.foil ? (input.priceEurFoil ?? input.priceEur) : input.priceEur;
  if (basis == null || !Number.isFinite(basis) || basis <= 0) {
    return { price: null, basis: null, isBulk: false, reason: "No trend price available — set manually" };
  }
  let p = basis * rules.trendMultiplier * rules.conditionMultiplier[input.condition];
  if (input.language !== "en") p *= rules.nonEnglishMultiplier;
  const raw = round2(p);
  const isBulk = raw < rules.bulkThreshold;
  const price = round2(Math.max(raw, rules.floor));
  return {
    price,
    basis,
    isBulk,
    reason: isBulk ? `Below bulk threshold (€${rules.bulkThreshold.toFixed(2)})` : "Trend-based",
  };
}
