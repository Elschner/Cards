import { NextResponse } from "next/server";
import { printings } from "@/lib/scryfall";

export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name") ?? "";
  if (!name) return NextResponse.json([]);
  return NextResponse.json(await printings(name));
}
