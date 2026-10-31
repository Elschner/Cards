import Link from "next/link";
import { prisma } from "@/lib/db";
import { ensureSkus, purchasesWithStats } from "@/lib/purchases";
import { cards, date, eur, int } from "@/lib/format";
import Payback from "@/components/Payback";

export const dynamic = "force-dynamic";

export default async function Overview() {
  await ensureSkus();
  const [byStatus, onHand, sold, boxes, lots] = await Promise.all([
    prisma.inventoryItem.groupBy({ by: ["status"], _count: true }),
    prisma.inventoryItem.aggregate({ where: { status: { in: ["IN_STOCK", "LISTED"] } }, _sum: { askPrice: true, costBasis: true } }),
    prisma.inventoryItem.aggregate({ where: { status: "SOLD" }, _sum: { soldPrice: true, costBasis: true } }),
    prisma.box.count(),
    purchasesWithStats(),
  ]);
  const n = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const counts = { IN_STOCK: n("IN_STOCK"), LISTED: n("LISTED"), SOLD: n("SOLD") };
  const total = counts.IN_STOCK + counts.LISTED + counts.SOLD;
  const revenue = sold._sum.soldPrice ?? 0;
  const margin = revenue - (sold._sum.costBasis ?? 0);

  if (total === 0) {
    return (
      <>
        <div className="head"><div><h1>Overview</h1></div></div>
        <div className="panel empty">
          <p>Your inventory is empty. Start with a collection: scan it in ManaBox, then import the file together with what you paid.</p>
          <Link className="btn" href="/import">Import from ManaBox</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>Overview</h1>
          <p>{cards(counts.IN_STOCK + counts.LISTED)} on the shelves in {boxes} {boxes === 1 ? "box" : "boxes"}.</p>
        </div>
        <div className="row">
          <Link className="btn ghost" href="/import">Import</Link>
          <Link className="btn" href="/inventory?status=IN_STOCK">List cards for sale</Link>
        </div>
      </div>

      <div className="ledger">
        <div><div className="v">{eur(onHand._sum.costBasis ?? 0)}</div><div className="k">Cost of stock</div></div>
        <div><div className="v">{eur(onHand._sum.askPrice ?? 0)}</div><div className="k">Sales value of stock</div></div>
        <div><div className="v">{eur(revenue)}</div><div className="k">Sold for, gross</div></div>
        <div><div className="v">{eur(margin)}</div><div className="k">Margin on sold cards</div></div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Where the cards are</h3>
        <div className="flow" role="img" aria-label={`${counts.IN_STOCK} in stock, ${counts.LISTED} listed, ${counts.SOLD} sold`}>
          {(["IN_STOCK", "LISTED", "SOLD"] as const).map((s) => counts[s] > 0 && <span key={s} className={`f-${s}`} style={{ width: `${(counts[s] / total) * 100}%` }} />)}
        </div>
        <div className="flow-legend">
          <span><i className="key" style={{ background: "#9aa6b6" }} />In stock, not listed <b>{int(counts.IN_STOCK)}</b></span>
          <span><i className="key" style={{ background: "var(--listed)" }} />Listed <b>{int(counts.LISTED)}</b></span>
          <span><i className="key" style={{ background: "var(--label)" }} />Sold <b>{int(counts.SOLD)}</b></span>
        </div>
      </div>

      <div className="section">
        <div className="toolbar">
          <h2>Have the purchases paid for themselves?</h2>
          <Link className="btn ghost" href="/purchases">All purchases</Link>
        </div>
        {lots.length === 0 ? (
          <div className="panel empty">
            <p>No purchases yet. When you import a collection and enter what you paid, you can follow here how much of it has come back in sales.</p>
            <Link className="btn" href="/import">Import a collection</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Purchase</th><th className="num">Cards sold</th><th className="num">Paid</th><th className="num">Sold for</th><th className="num">Value left in stock</th><th>Paid back</th></tr></thead>
              <tbody>
                {lots.slice(0, 8).map((l) => (
                  <tr key={l.id}>
                    <td><Link href={`/purchases/${l.id}`} className="card-name">{l.name}</Link><span className="card-sub">{date(l.purchasedAt)}</span></td>
                    <td className="num">{int(l.sold)} of {int(l.cards)}</td>
                    <td className="num">{eur(l.totalCost)}</td>
                    <td className="num">{eur(l.revenue)}</td>
                    <td className="num">{eur(l.stockValue)}</td>
                    <td><Payback value={l.payback} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
