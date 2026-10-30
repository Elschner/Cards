import Link from "next/link";
import { prisma } from "@/lib/db";
import { apiConfigured } from "@/lib/channels/cardmarket";

export const dynamic = "force-dynamic";

const eur = (n: number) => `€${n.toFixed(2)}`;

export default async function Dashboard() {
  const [byStatus, value, cost, boxes, failed] = await Promise.all([
    prisma.inventoryItem.groupBy({ by: ["status"], _count: true }),
    prisma.inventoryItem.aggregate({ where: { status: { in: ["IN_STOCK", "LISTED"] } }, _sum: { askPrice: true } }),
    prisma.inventoryItem.aggregate({ where: { status: { in: ["IN_STOCK", "LISTED"] } }, _sum: { costBasis: true } }),
    prisma.box.count(),
    prisma.listing.count({ where: { status: "FAILED" } }),
  ]);
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;

  return (
    <>
      <h1>Overview</h1>
      {!apiConfigured() && (
        <div className="notice">
          Cardmarket API not configured — listing runs via CSV export. See README → “Cardmarket access”.
        </div>
      )}
      <div className="stats">
        <div className="panel stat"><div className="v">{count("IN_STOCK")}</div><div className="k">In stock, not listed</div></div>
        <div className="panel stat"><div className="v">{count("LISTED")}</div><div className="k">Listed</div></div>
        <div className="panel stat"><div className="v">{count("SOLD")}</div><div className="k">Sold</div></div>
        <div className="panel stat"><div className="v">{eur(value._sum.askPrice ?? 0)}</div><div className="k">Ask value on hand</div></div>
        <div className="panel stat"><div className="v">{eur(cost._sum.costBasis ?? 0)}</div><div className="k">Cost basis on hand</div></div>
        <div className="panel stat"><div className="v">{boxes}</div><div className="k">Storage boxes</div></div>
      </div>
      {failed > 0 && <p className="err">{failed} listing attempts failed — check Inventory.</p>}
      <h2>Next</h2>
      <div className="row">
        <Link className="btn" href="/intake">Add cards</Link>
        <Link className="btn" href="/inventory">List on Cardmarket</Link>
      </div>
    </>
  );
}
