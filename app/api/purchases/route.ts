import { NextResponse } from "next/server";
import { createPurchase, purchasesWithStats } from "@/lib/purchases";

export async function GET() {
  return NextResponse.json(await purchasesWithStats());
}

/** Create an empty lot (cards can be added later via intake or import). */
export async function POST(req: Request) {
  const b = await req.json();
  const total = Number(String(b.totalCost ?? "").replace(",", "."));
  if (!Number.isFinite(total) || total < 0) return NextResponse.json({ error: "Skriv købsprisen i EUR" }, { status: 400 });
  const p = await createPurchase({
    name: String(b.name ?? ""), totalCost: total, method: b.method === "EQUAL" ? "EQUAL" : "VALUE",
    purchasedAt: b.purchasedAt ? new Date(String(b.purchasedAt)) : undefined, notes: b.notes ? String(b.notes) : null,
  });
  return NextResponse.json(p);
}
