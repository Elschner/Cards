import { NextResponse } from "next/server";
import { repriceAll } from "@/lib/inventory";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const ids = Array.isArray(b.ids) && b.ids.length ? b.ids.map(Number) : undefined;
  return NextResponse.json(await repriceAll(ids));
}
