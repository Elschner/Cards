import Link from "next/link";
import { prisma } from "@/lib/db";
import { locationLabel, pickOrder } from "@/lib/core/chaos";
import { cards, eur } from "@/lib/format";

export const dynamic = "force-dynamic";

// Listed copies in walking order (box → slot). When an order comes in, find the card by
// its SKU (shown in the Cardmarket order comment), pull it, then mark it sold.
export default async function PickList() {
  const items = await prisma.inventoryItem.findMany({
    where: { status: "LISTED" },
    include: { card: true, box: true },
  });
  const ordered = pickOrder(items.map((i) => ({ ...i, boxCode: i.box?.code ?? null })));
  return (
    <>
      <div className="head">
        <div>
          <h1>Pick list</h1>
          <p>All {cards(ordered.length)} that are listed, in the order they sit in the boxes. Find a sold card by the SKU in the Cardmarket order (Cmd+F).</p>
        </div>
        {ordered.length > 0 && <Link className="btn ghost" href="/inventory?status=LISTED">Mark cards as sold</Link>}
      </div>
      <div className="table-wrap">
        {ordered.length === 0 ? (
          <div className="empty"><p>No cards are listed yet.</p><Link className="btn" href="/inventory?status=IN_STOCK">List cards for sale</Link></div>
        ) : (
          <table>
            <thead><tr><th>Location</th><th>SKU</th><th>Card</th><th>Condition</th><th className="num">Price</th></tr></thead>
            <tbody>
              {ordered.map((i) => (
                <tr key={i.id}>
                  <td>{i.boxCode && i.slot ? <span className="loc">{locationLabel(i.boxCode, i.slot)}</span> : <span className="loc none">None</span>}</td>
                  <td className="sku">{i.sku}</td>
                  <td><span className="card-name">{i.card.name}</span><span className="card-sub">{i.card.setName} #{i.card.collectorNumber}{i.foil ? ", foil" : ""}</span></td>
                  <td>{i.condition} {i.language.toUpperCase()}</td>
                  <td className="num">{eur(i.askPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
