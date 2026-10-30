import { NextResponse } from "next/server";
import { autocomplete } from "@/lib/scryfall";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.length < 2) return NextResponse.json([]);
  return NextResponse.json(await autocomplete(q));
}
