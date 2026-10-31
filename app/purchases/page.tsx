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
          <h1>Purchases</h1>
          <p>Each collection you buy has its price split over its cards. That gives you the cost of every single card, and shows when the collection has paid for itself.</p>
        </div>
      </div>

      {lots.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Purchase</th><th>Split</th><th className="num">Cards</th><th className="num">Paid</th><th className="num">Sold for</th><th className="num">Margin</th><th>Paid back</th></tr></thead>
            <tbody>
              {lots.map((l) => (
                <tr key={l.id}>
                  <td><Link href={`/purchases/${l.id}`} className="card-name">{l.name}</Link><span className="card-sub">{date(l.purchasedAt)}</span></td>
                  <td className="muted small">{METHOD_LABEL[l.method] ?? l.method}</td>
                  <td className="num">{int(l.sold)} of {int(l.cards)} sold</td>
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
        <h2>Add a purchase</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          The easiest way is to create the purchase while you <Link href="/import">import from ManaBox</Link>. Create it here if you want to add the cards afterwards, for example by scanning single cards.
        </p>
        <NewPurchaseForm />
      </div>
    </>
  );
}
