import { NextResponse } from "next/server";
import { importRows, type CostMode } from "@/lib/import";
import { parseManabox } from "@/lib/core/manabox";

const num = (v: unknown) => {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function costMode(b: Record<string, unknown>): CostMode | string {
  switch (b.costMode) {
    case "newLot": {
      const total = num(b.lotTotal);
      if (total == null || total < 0) return "Enter what you paid for the purchase in EUR";
      return {
        kind: "newLot",
        name: String(b.lotName ?? ""),
        totalCost: total,
        method: b.lotMethod === "EQUAL" ? "EQUAL" : "VALUE",
        purchasedAt: b.lotDate ? new Date(String(b.lotDate)) : undefined,
      };
    }
    case "existingLot":
      return Number(b.purchaseId) > 0 ? { kind: "existingLot", purchaseId: Number(b.purchaseId) } : "Choose a purchase";
    case "file":
      return { kind: "file", usdToEur: num(b.usdToEur) ?? 0.92, fallback: num(b.flatCost) };
    default:
      return { kind: "flat", perCard: num(b.flatCost) };
  }
}

export async function POST(req: Request) {
  const b = await req.json();
  const { rows, errors } = parseManabox(String(b.csv ?? ""));
  if (!rows.length) return NextResponse.json({ error: errors[0] ?? "No cards in the file" }, { status: 400 });
  const mode = costMode(b);
  if (typeof mode === "string") return NextResponse.json({ error: mode }, { status: 400 });
  try {
    const res = await importRows(rows, mode);
    return NextResponse.json({ ...res, errors: [...errors, ...res.errors] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
