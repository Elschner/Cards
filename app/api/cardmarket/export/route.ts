import { NextResponse } from "next/server";
import { exportCsv } from "@/lib/channels/cardmarket";

// Only cards that are in stock (not listed, not sold) can be exported for listing.
export async function POST(req: Request) {
  const b = await req.json();
  const ids: number[] = (b.ids ?? []).map(Number);
  const { csv, rows, copies } = await exportCsv(ids, Boolean(b.markListed));
  if (copies === 0) {
    return NextResponse.json(
      { error: "None of the selected cards can be listed. Only cards that are in stock with a price can be listed." },
      { status: 400 },
    );
  }
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cardmarket-${stamp}.csv"`,
      "X-Rows": String(rows),
      "X-Copies": String(copies),
      "X-Skipped": String(ids.length - copies),
    },
  });
}
