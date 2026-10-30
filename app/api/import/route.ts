import { NextResponse } from "next/server";
import { importRows } from "@/lib/import";
import { parseManabox } from "@/lib/core/manabox";

// Accepts the raw CSV text so parsing/validation happens server-side too.
export async function POST(req: Request) {
  const b = await req.json();
  const { rows, errors } = parseManabox(String(b.csv ?? ""));
  if (!rows.length) return NextResponse.json({ error: errors[0] ?? "Ingen kort i filen" }, { status: 400 });
  try {
    const res = await importRows(rows, {
      useFilePrice: Boolean(b.useFilePrice),
      usdToEur: Number(b.usdToEur) > 0 ? Number(b.usdToEur) : 0.92,
      defaultCost: b.defaultCost === "" || b.defaultCost == null ? null : Number(String(b.defaultCost).replace(",", ".")),
    });
    return NextResponse.json({ ...res, errors: [...errors, ...res.errors] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
