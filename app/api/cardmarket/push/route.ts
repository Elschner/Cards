import { NextResponse } from "next/server";
import { pushViaApi } from "@/lib/channels/cardmarket";

export async function POST(req: Request) {
  const b = await req.json();
  const ids: number[] = (b.ids ?? []).map(Number);
  try {
    return NextResponse.json(await pushViaApi(ids));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
