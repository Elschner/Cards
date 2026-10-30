import { prisma } from "@/lib/db";
import { locationLabel, pickOrder } from "@/lib/core/chaos";

export const dynamic = "force-dynamic";

// Listed copies in walking order (box → slot). When an order comes in, find the card
// here, pull it, then mark it sold in Inventory (frees the slot for reuse).
export default async function PickList() {
  const items = await prisma.inventoryItem.findMany({
    where: { status: "LISTED" },
    include: { card: true, box: true },
  });
  const ordered = pickOrder(items.map((i) => ({ ...i, boxCode: i.box?.code ?? null })));
  return (
    <>
      <h1>Pick list</h1>
      <p className="muted">All listed copies in storage order. Use your browser’s find (Ctrl/Cmd+F) to locate an ordered card.</p>
      <table>
        <thead><tr><th>Location</th><th>Card</th><th>Set</th><th>Cond</th><th>Lang</th><th>Foil</th><th className="num">Ask</th><th>ID</th></tr></thead>
        <tbody>
          {ordered.map((i) => (
            <tr key={i.id}>
              <td className="loc">{i.boxCode && i.slot ? locationLabel(i.boxCode, i.slot) : "—"}</td>
              <td>{i.card.name}</td>
              <td>{i.card.setCode.toUpperCase()} #{i.card.collectorNumber}</td>
              <td>{i.condition}</td>
              <td>{i.language.toUpperCase()}</td>
              <td>{i.foil ? "★" : ""}</td>
              <td className="num">€{(i.askPrice ?? 0).toFixed(2)}</td>
              <td className="muted">{i.id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
