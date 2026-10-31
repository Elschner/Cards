import { NextResponse } from "next/server";
import { assignToPurchase } from "@/lib/purchases";

/** { ids, purchaseId } — purchaseId null removes the cards from their purchase. */
export async function POST(req: Request) {
  const b = await req.json();
  const ids: number[] = (b.ids ?? []).map(Number).filter((n: number) => n > 0);
  if (!ids.length) return NextResponse.json({ error: "No cards selected" }, { status: 400 });
  const pid = b.purchaseId == null || b.purchaseId === "" ? null : Number(b.purchaseId);
  try {
    return NextResponse.json(await assignToPurchase(ids, pid));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
