"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface InvRow {
  id: number; location: string; name: string; set: string; number: string; condition: string;
  language: string; foil: boolean; askPrice: number | null; trend: number | null; costBasis: number | null;
  status: string; hasProduct: boolean; lastListing: string | null;
}

const eur = (n: number | null) => (n == null ? "—" : `€${n.toFixed(2)}`);

export default function InventoryTable({ rows, apiEnabled }: { rows: InvRow[]; apiEnabled: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState("IN_STOCK");
  const [q, setQ] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const shown = useMemo(() => rows.filter((r) =>
    (status === "ALL" || r.status === status) &&
    (!q || `${r.name} ${r.set} ${r.location}`.toLowerCase().includes(q.toLowerCase())) &&
    (!minPrice || (r.askPrice ?? 0) >= Number(minPrice)),
  ), [rows, status, q, minPrice]);

  const ids = [...sel].filter((id) => shown.some((r) => r.id === id));
  const allChecked = shown.length > 0 && shown.every((r) => sel.has(r.id));
  const toggleAll = () => setSel(allChecked ? new Set() : new Set(shown.map((r) => r.id)));
  const toggle = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function post(url: string, body: object) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      return j;
    } catch (e) { setMsg(`Error: ${(e as Error).message}`); return null; }
    finally { setBusy(false); }
  }

  async function exportCsv(markListed: boolean) {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/cardmarket/export", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, markListed }),
    });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "cardmarket.csv";
    a.click();
    setMsg(`Exported ${res.headers.get("X-Copies")} copies in ${res.headers.get("X-Rows")} listing rows${markListed ? " — marked as listed" : ""}.`);
    setBusy(false);
    if (markListed) { setSel(new Set()); router.refresh(); }
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {["IN_STOCK", "LISTED", "SOLD", "ALL"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <input placeholder="Search name / set / location" value={q} onChange={(e) => setQ(e.target.value)} />
        <input placeholder="Min €" value={minPrice} style={{ width: 70 }} onChange={(e) => setMinPrice(e.target.value)} />
        <span className="muted">{shown.length} copies · {ids.length} selected</span>
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <button disabled={busy} className="secondary" onClick={async () => {
          const j = await post("/api/inventory/reprice", { ids });
          if (j) { setMsg(`Repriced: ${j.changed} of ${j.checked} changed.`); router.refresh(); }
        }}>Reprice {ids.length ? "selected" : "all"} from trend</button>
        <button disabled={busy || !ids.length} onClick={() => exportCsv(false)} className="secondary">Cardmarket CSV</button>
        <button disabled={busy || !ids.length} onClick={() => exportCsv(true)}>CSV + mark listed</button>
        <button disabled={busy || !ids.length || !apiEnabled} title={apiEnabled ? "" : "Cardmarket API credentials not configured"}
          onClick={async () => {
            const j = await post("/api/cardmarket/push", { ids });
            if (j) {
              setMsg(`${j.dryRun ? "[DRY RUN] " : ""}Listed ${j.listed}, failed ${j.failed}, skipped (no Cardmarket product) ${j.skippedNoProduct}.${j.errors?.length ? " " + j.errors[0] : ""}`);
              setSel(new Set()); router.refresh();
            }
          }}>Push to Cardmarket (API)</button>
        <button disabled={busy || !ids.length} className="secondary" onClick={async () => {
          const p = prompt("New ask price (EUR) for selected copies:");
          if (p && (await post("/api/inventory/status", { ids, action: "setPrice", price: Number(p.replace(",", ".")) }))) router.refresh();
        }}>Set price</button>
        <button disabled={busy || !ids.length} className="secondary" onClick={async () => {
          if (await post("/api/inventory/status", { ids, status: "SOLD" })) { setSel(new Set()); router.refresh(); }
        }}>Mark sold</button>
        <button disabled={busy || !ids.length} className="secondary" onClick={async () => {
          if (confirm(`Unlist ${ids.length} copies (back to IN_STOCK)? Remember to remove them on the marketplace.`) &&
            (await post("/api/inventory/status", { ids, status: "IN_STOCK" }))) { setSel(new Set()); router.refresh(); }
        }}>Back to stock</button>
      </div>
      {msg && <div className="notice">{msg}</div>}

      <table>
        <thead>
          <tr>
            <th><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
            <th>Location</th><th>Card</th><th>Set</th><th>Cond</th><th>Lang</th><th>Foil</th>
            <th className="num">Trend</th><th className="num">Ask</th><th className="num">Cost</th><th>Status</th><th>Last listing</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.id}>
              <td><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>
              <td className="loc">{r.location}</td>
              <td>{r.name}{!r.hasProduct && <span className="err" title="No Cardmarket product id — CSV/API listing will need manual match"> ⚠</span>}</td>
              <td>{r.set} #{r.number}</td>
              <td>{r.condition}</td>
              <td>{r.language.toUpperCase()}</td>
              <td>{r.foil ? "★" : ""}</td>
              <td className="num">{eur(r.trend)}</td>
              <td className="num"><strong>{eur(r.askPrice)}</strong></td>
              <td className="num">{eur(r.costBasis)}</td>
              <td><span className={`pill ${r.status}`}>{r.status}</span></td>
              <td className="muted" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.lastListing ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
