import { NextResponse } from "next/server";
import { markListed } from "@/lib/channels/cardmarket";

export async function POST(req: Request) {
  const b = await req.json();
  const ids: number[] = (b.ids ?? []).map(Number).filter((n: number) => n > 0);
  if (!ids.length) return NextResponse.json({ error: "No cards" }, { status: 400 });
  return NextResponse.json(await markListed(ids));
}
