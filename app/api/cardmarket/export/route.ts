import { exportCsv } from "@/lib/channels/cardmarket";

export async function POST(req: Request) {
  const b = await req.json();
  const ids: number[] = (b.ids ?? []).map(Number);
  const { csv, rows, copies } = await exportCsv(ids, Boolean(b.markListed));
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cardmarket-${stamp}.csv"`,
      "X-Rows": String(rows),
      "X-Copies": String(copies),
    },
  });
}
