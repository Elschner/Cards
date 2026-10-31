import { NextResponse } from "next/server";
import { deleteItems } from "@/lib/inventory";

export async function POST(req: Request) {
  const b = await req.json();
  const ids: number[] = (b.ids ?? []).map(Number).filter((n: number) => n > 0);
  if (!ids.length) return NextResponse.json({ error: "No cards selected" }, { status: 400 });
  return NextResponse.json(await deleteItems(ids));
}
