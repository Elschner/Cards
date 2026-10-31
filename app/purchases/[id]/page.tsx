import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { lotStats } from "@/lib/core/allocation";
import { locationLabel } from "@/lib/core/chaos";
import { date, eur, int, STATUS_LABEL } from "@/lib/format";
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
          <p className="small" style={{ margin: "0 0 6px" }}><Link href="/purchases">Indkøb</Link></p>
          <h1>{p.name}</h1>
          <p>Købt {date(p.purchasedAt)} for {eur(p.totalCost)}. {int(s.cards)} kort, {int(s.sold)} solgt.</p>
        </div>
      </div>

      <div className="ledger">
        <div><div className="v">{eur(s.totalCost)}</div><div className="k">Betalt</div></div>
        <div><div className="v">{eur(s.revenue)}</div><div className="k">Solgt for, brutto</div></div>
        <div><div className="v">{eur(s.revenue - s.costOfSold)}</div><div className="k">Avance på solgte kort</div></div>
        <div><div className="v">{eur(s.stockValue)}</div><div className="k">Salgsværdi tilbage</div></div>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 10 }}>Tjent hjem</h3>
        <Payback value={s.payback} />
      </div>

      <div className="section">
        <h2>Pris og fordeling</h2>
        <EditPurchase id={p.id} name={p.name} totalCost={p.totalCost} method={p.method} />
      </div>

      <div className="section">
        <div className="toolbar">
          <h2>Kort i indkøbet</h2>
          <Link className="btn ghost" href={`/inventory?lot=${p.id}`}>Vis på lageret</Link>
        </div>
        {items.length === 0 ? (
          <div className="panel empty">
            <p>Ingen kort endnu. Importér en ManaBox-fil og vælg dette indkøb, eller scan enkeltkort ind i det.</p>
            <Link className="btn" href="/import">Importér fra ManaBox</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>SKU</th><th>Placering</th><th>Kort</th><th>Stand</th><th className="num">Kostpris</th><th className="num">Salgspris</th><th>Status</th></tr></thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td className="sku">{i.sku}</td>
                    <td>{i.box && i.slot ? <span className="loc">{locationLabel(i.box.code, i.slot)}</span> : <span className="loc none">Ingen</span>}</td>
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
