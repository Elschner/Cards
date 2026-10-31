import Link from "next/link";
import { prisma } from "@/lib/db";
import { ensureSkus, purchasesWithStats } from "@/lib/purchases";
import { date, eur, int } from "@/lib/format";
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
        <div className="head"><div><h1>Oversigt</h1></div></div>
        <div className="panel empty">
          <p>Lageret er tomt. Start med en samling: scan den i ManaBox, og importér filen sammen med det, du betalte.</p>
          <Link className="btn" href="/import">Importér fra ManaBox</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>Oversigt</h1>
          <p>{int(counts.IN_STOCK + counts.LISTED)} kort på hylderne i {boxes} {boxes === 1 ? "kasse" : "kasser"}.</p>
        </div>
        <div className="row">
          <Link className="btn ghost" href="/import">Importér</Link>
          <Link className="btn" href="/inventory?status=IN_STOCK">Sæt kort til salg</Link>
        </div>
      </div>

      <div className="ledger">
        <div><div className="v">{eur(onHand._sum.costBasis ?? 0)}</div><div className="k">Kostpris på lager</div></div>
        <div><div className="v">{eur(onHand._sum.askPrice ?? 0)}</div><div className="k">Salgsværdi på lager</div></div>
        <div><div className="v">{eur(revenue)}</div><div className="k">Solgt for, brutto</div></div>
        <div><div className="v">{eur(margin)}</div><div className="k">Avance på solgte kort</div></div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Hvor er kortene</h3>
        <div className="flow" role="img" aria-label={`${counts.IN_STOCK} på lager, ${counts.LISTED} til salg, ${counts.SOLD} solgt`}>
          {(["IN_STOCK", "LISTED", "SOLD"] as const).map((s) => counts[s] > 0 && <span key={s} className={`f-${s}`} style={{ width: `${(counts[s] / total) * 100}%` }} />)}
        </div>
        <div className="flow-legend">
          <span><i className="key" style={{ background: "#9aa6b6" }} />På lager, ikke sat til salg <b>{int(counts.IN_STOCK)}</b></span>
          <span><i className="key" style={{ background: "var(--listed)" }} />Til salg <b>{int(counts.LISTED)}</b></span>
          <span><i className="key" style={{ background: "var(--label)" }} />Solgt <b>{int(counts.SOLD)}</b></span>
        </div>
      </div>

      <div className="section">
        <div className="toolbar">
          <h2>Har indkøbene tjent sig hjem?</h2>
          <Link className="btn ghost" href="/purchases">Alle indkøb</Link>
        </div>
        {lots.length === 0 ? (
          <div className="panel empty">
            <p>Ingen indkøb registreret. Når du importerer en samling og skriver, hvad du betalte, kan du følge her, hvornår den har tjent sig hjem.</p>
            <Link className="btn" href="/import">Importér en samling</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Indkøb</th><th className="num">Kort solgt</th><th className="num">Betalt</th><th className="num">Solgt for</th><th className="num">Tilbage på lager</th><th>Tjent hjem</th></tr></thead>
              <tbody>
                {lots.slice(0, 8).map((l) => (
                  <tr key={l.id}>
                    <td><Link href={`/purchases/${l.id}`} className="card-name">{l.name}</Link><span className="card-sub">{date(l.purchasedAt)}</span></td>
                    <td className="num">{int(l.sold)} af {int(l.cards)}</td>
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
