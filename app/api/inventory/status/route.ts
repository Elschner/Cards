import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setStatus } from "@/lib/inventory";

export async function POST(req: Request) {
  const b = await req.json();
  const ids: number[] = (b.ids ?? []).map(Number);
  if (!ids.length) return NextResponse.json({ error: "No ids" }, { status: 400 });

  if (b.action === "setPrice") {
    const price = Number(b.price);
    if (!(price > 0)) return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    // Sold copies: correct the sale price. Others: change the ask price.
    await prisma.inventoryItem.updateMany({ where: { id: { in: ids }, status: "SOLD" }, data: { soldPrice: price } });
    await prisma.inventoryItem.updateMany({ where: { id: { in: ids }, status: { not: "SOLD" } }, data: { askPrice: price } });
    return NextResponse.json({ ok: true });
  }
  if (!["SOLD", "REMOVED", "IN_STOCK"].includes(b.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (b.status !== "IN_STOCK") {
    await prisma.listing.updateMany({
      where: { itemId: { in: ids }, status: { in: ["ACTIVE", "PENDING"] } },
      data: { status: b.status === "SOLD" ? "SOLD" : "ENDED" },
    });
  }
  const r = await setStatus(ids, b.status);
  return NextResponse.json({ updated: r.count });
}
