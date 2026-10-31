"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cards, eur } from "@/lib/format";

interface Part { part: number; rows: number; copies: number; ids: number[]; csv: string }
interface Row { name: string; condition: string; language: string; foil: boolean; quantity: number; price: number; comment: string; rarity: string }
export interface Group {
  setCode: string; setName: string; cardmarketName: string | null; url: string;
  copies: number; value: number; rows: Row[]; parts: Part[];
}

const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

export default function ListingSet({ group }: { group: Group }) {
  const router = useRouter();
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function download(p: Part) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([p.csv], { type: "text/csv" }));
    a.download = `cardmarket-${slug(group.setName)}${group.parts.length > 1 ? `-part${p.part}` : ""}.csv`;
    a.click();
  }

  async function markListed(p: Part) {
    setErr(null);
    const res = await fetch("/api/cardmarket/listed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: p.ids }) });
    if (!res.ok) return setErr("Could not mark as listed");
    setDone((d) => ({ ...d, [p.part]: true }));
    router.refresh();
  }

  const allDone = group.parts.every((p) => done[p.part]);

  return (
    <div className="panel" style={allDone ? { opacity: 0.55 } : undefined}>
      <div className="toolbar" style={{ marginBottom: 6 }}>
        <div>
          <h3>{group.cardmarketName ?? group.setName}</h3>
          <span className="hint">
            {group.setCode.toUpperCase()}, {cards(group.copies)}, {eur(group.value)}
            {group.cardmarketName && group.cardmarketName !== group.setName && `. Scryfall calls it ${group.setName}`}
          </span>
        </div>
        <button className="ghost" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Hide cards" : "Show cards"}</button>
      </div>

      {group.parts.map((p) => (
        <div key={p.part} className="row" style={{ marginTop: 10 }}>
          {group.parts.length > 1 && <span className="muted small" style={{ width: 120 }}>Part {p.part}: {p.rows} rows</span>}
          <button className="ghost" onClick={() => download(p)}>Download CSV</button>
          <a className="btn ghost" href={group.url} target="_blank" rel="noreferrer">Open on Cardmarket</a>
          {done[p.part]
            ? <span className="st LISTED">Marked as listed</span>
            : <button onClick={() => markListed(p)}>Mark as listed</button>}
        </div>
      ))}
      {err && <p className="err">{err}</p>}

      {open && (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead><tr><th>Card</th><th>Rarity</th><th>Condition</th><th className="num">Qty</th><th className="num">Price</th><th>SKU</th></tr></thead>
            <tbody>
              {group.rows.map((r) => (
                <tr key={r.comment}>
                  <td><span className="card-name">{r.name}</span>{r.foil && <span className="card-sub">Foil</span>}</td>
                  <td className="small">{r.rarity}</td>
                  <td>{r.condition} {r.language.toUpperCase()}</td>
                  <td className="num">{r.quantity}</td>
                  <td className="num">{eur(r.price)}</td>
                  <td className="sku">{r.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
