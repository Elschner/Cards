import { NextResponse } from "next/server";
import { addCopies } from "@/lib/inventory";
import { CONDITIONS, type Condition } from "@/lib/core/pricing";

export async function POST(req: Request) {
  const b = await req.json();
  if (!b.scryfallId || !CONDITIONS.includes(b.condition)) {
    return NextResponse.json({ error: "scryfallId and valid condition required" }, { status: 400 });
  }
  try {
    const res = await addCopies({
      scryfallId: String(b.scryfallId),
      condition: b.condition as Condition,
      foil: Boolean(b.foil),
      language: String(b.language || "en"),
      quantity: Math.min(100, Math.max(1, Number(b.quantity) || 1)),
      costBasis: b.costBasis === "" || b.costBasis == null ? null : Number(b.costBasis),
      photoPath: b.photoPath ?? null,
    });
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
