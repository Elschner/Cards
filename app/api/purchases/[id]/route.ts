import { NextResponse } from "next/server";
import { deletePurchase, updatePurchase } from "@/lib/purchases";

/** Edit name / price / method — then the cost is spread again over the lot's cards. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = await req.json();
  const total = b.totalCost == null || b.totalCost === "" ? undefined : Number(String(b.totalCost).replace(",", "."));
  if (total !== undefined && (!Number.isFinite(total) || total < 0)) {
    return NextResponse.json({ error: "Invalid purchase price" }, { status: 400 });
  }
  try {
    const r = await updatePurchase(Number(id), {
      name: b.name, totalCost: total,
      method: b.method === "EQUAL" || b.method === "VALUE" ? b.method : undefined,
      notes: b.notes,
    });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await deletePurchase(Number(id)));
  } catch {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }
}
