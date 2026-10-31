import Link from "next/link";
import { purchasesWithStats } from "@/lib/purchases";
import { date, eur, int, METHOD_LABEL } from "@/lib/format";
import Payback from "@/components/Payback";
import NewPurchaseForm from "@/components/NewPurchaseForm";

export const dynamic = "force-dynamic";

export default async function Purchases() {
  const lots = await purchasesWithStats();
  return (
    <>
      <div className="head">
        <div>
          <h1>Indkøb</h1>
          <p>Hver samling du køber, får sin pris fordelt ud på kortene. Så kender du kostprisen på hvert enkelt kort og kan se, hvornår samlingen har tjent sig hjem.</p>
        </div>
      </div>

      {lots.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Indkøb</th><th>Fordeling</th><th className="num">Kort</th><th className="num">Betalt</th><th className="num">Solgt for</th><th className="num">Avance</th><th>Tjent hjem</th></tr></thead>
            <tbody>
              {lots.map((l) => (
                <tr key={l.id}>
                  <td><Link href={`/purchases/${l.id}`} className="card-name">{l.name}</Link><span className="card-sub">{date(l.purchasedAt)}</span></td>
                  <td className="muted small">{METHOD_LABEL[l.method] ?? l.method}</td>
                  <td className="num">{int(l.sold)} af {int(l.cards)} solgt</td>
                  <td className="num">{eur(l.totalCost)}</td>
                  <td className="num">{eur(l.revenue)}</td>
                  <td className="num">{eur(l.revenue - l.costOfSold)}</td>
                  <td><Payback value={l.payback} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="section">
        <h2>Registrér et indkøb</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Det nemmeste er at oprette indkøbet direkte under <Link href="/import">Importér fra ManaBox</Link>. Opret det her, hvis du vil tilføje kortene bagefter, fx ved at scanne enkeltkort.
        </p>
        <NewPurchaseForm />
      </div>
    </>
  );
}
