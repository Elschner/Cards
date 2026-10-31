import Link from "next/link";
import { prisma } from "@/lib/db";
import { locationLabel, pickOrder } from "@/lib/core/chaos";
import { eur, int } from "@/lib/format";

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
          <h1>Plukliste</h1>
          <p>Alle {int(ordered.length)} kort til salg, i den rækkefølge de står i kasserne. Find et solgt kort med dets SKU fra Cardmarket-ordren (Cmd+F).</p>
        </div>
        {ordered.length > 0 && <Link className="btn ghost" href="/inventory?status=LISTED">Markér solgte kort</Link>}
      </div>
      <div className="table-wrap">
        {ordered.length === 0 ? (
          <div className="empty"><p>Ingen kort er sat til salg endnu.</p><Link className="btn" href="/inventory?status=IN_STOCK">Sæt kort til salg</Link></div>
        ) : (
          <table>
            <thead><tr><th>Placering</th><th>SKU</th><th>Kort</th><th>Stand</th><th className="num">Pris</th></tr></thead>
            <tbody>
              {ordered.map((i) => (
                <tr key={i.id}>
                  <td>{i.boxCode && i.slot ? <span className="loc">{locationLabel(i.boxCode, i.slot)}</span> : <span className="loc none">Ingen</span>}</td>
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
