import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { lotStats } from "@/lib/core/allocation";
import { locationLabel } from "@/lib/core/chaos";
import { cards, date, eur, int, STATUS_LABEL } from "@/lib/format";
import DeletePurchase from "@/components/DeletePurchase";
import Payback from "@/components/Payback";
import EditPurchase from "@/components/EditPurchase";

export const dynamic = "force-dynamic";

export default async function PurchaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await prisma.purchase.findUnique({
    where: { id: Number(id) },
    include: { items: { include: { card: true, box: true }, orderBy: [{ costBasis: "desc" }, { id: "asc" }] } },
  });
  if (!p) notFound();
  const s = lotStats(p.totalCost, p.items);
  const items = p.items.filter((i) => i.status !== "REMOVED");

  return (
    <>
      <div className="head">
        <div>
          <p className="small" style={{ margin: "0 0 6px" }}><Link href="/purchases">Purchases</Link></p>
          <h1>{p.name}</h1>
          <p>Bought {date(p.purchasedAt)} for {eur(p.totalCost)}. {cards(s.cards)}, {int(s.sold)} sold.</p>
        </div>
      </div>

      <div className="ledger">
        <div><div className="v">{eur(s.totalCost)}</div><div className="k">Paid</div></div>
        <div><div className="v">{eur(s.revenue)}</div><div className="k">Sold for, gross</div></div>
        <div><div className="v">{eur(s.revenue - s.costOfSold)}</div><div className="k">Margin on sold cards</div></div>
        <div><div className="v">{eur(s.stockValue)}</div><div className="k">Sales value left</div></div>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 10 }}>Paid back</h3>
        <Payback value={s.payback} />
      </div>

      <div className="section">
        <h2>Price and split</h2>
        <EditPurchase id={p.id} name={p.name} totalCost={p.totalCost} method={p.method} />
        <DeletePurchase id={p.id} cards={items.length} />
      </div>

      <div className="section">
        <div className="toolbar">
          <h2>Cards in this purchase</h2>
          <Link className="btn ghost" href={`/inventory?lot=${p.id}`}>Show in inventory</Link>
        </div>
        {items.length === 0 ? (
          <div className="panel empty">
            <p>No cards yet. Import a ManaBox file and choose this purchase, or scan single cards into it.</p>
            <Link className="btn" href="/import">Import from ManaBox</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>SKU</th><th>Location</th><th>Card</th><th>Condition</th><th className="num">Cost</th><th className="num">Price</th><th>Status</th></tr></thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td className="sku">{i.sku}</td>
                    <td>{i.box && i.slot ? <span className="loc">{locationLabel(i.box.code, i.slot)}</span> : <span className="loc none">None</span>}</td>
                    <td><span className="card-name">{i.card.name}</span><span className="card-sub">{i.card.setName} #{i.card.collectorNumber}{i.foil ? ", foil" : ""}</span></td>
                    <td>{i.condition} {i.language.toUpperCase()}</td>
                    <td className="num">{eur(i.costBasis)}</td>
                    <td className="num">{i.status === "SOLD" ? eur(i.soldPrice) : eur(i.askPrice)}</td>
                    <td><span className={`st ${i.status}`}>{STATUS_LABEL[i.status] ?? i.status}</span></td>
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
