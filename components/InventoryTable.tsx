"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cards, eur, int, STATUS_LABEL } from "@/lib/format";

export interface InvRow {
  id: number; sku: string; location: string | null; name: string; setName: string; set: string; number: string;
  condition: string; language: string; foil: boolean; askPrice: number | null; soldPrice: number | null;
  trend: number | null; costBasis: number | null; status: string; lotId: number | null; lotName: string | null;
  hasProduct: boolean; lastListing: string | null;
}

const FILTERS = ["IN_STOCK", "LISTED", "SOLD", "ALL"] as const;

export default function InventoryTable({ rows, lots, apiEnabled, initialStatus, initialLot }: {
  rows: InvRow[]; lots: { id: number; name: string }[]; apiEnabled: boolean; initialStatus: string; initialLot: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [lot, setLot] = useState(initialLot);
  const [q, setQ] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const shown = useMemo(() => rows.filter((r) =>
    (status === "ALL" || r.status === status) &&
    (!lot || String(r.lotId) === lot) &&
    (!q || `${r.name} ${r.set} ${r.setName} ${r.location ?? ""} ${r.sku}`.toLowerCase().includes(q.toLowerCase())) &&
    (!minPrice || (r.askPrice ?? 0) >= Number(minPrice.replace(",", "."))),
  ), [rows, status, lot, q, minPrice]);

  const selected = shown.filter((r) => sel.has(r.id));
  const ids = selected.map((r) => r.id);
  const count = (s: string) => selected.filter((r) => r.status === s).length;
  const nStock = count("IN_STOCK"), nListed = count("LISTED"), nSold = count("SOLD");
  // What the selection allows. Listed and sold cards can never be listed again.
  const canList = ids.length > 0 && nStock === ids.length;
  const canSell = ids.length > 0 && nListed + nStock === ids.length;
  const canUnlist = ids.length > 0 && nListed + nSold === ids.length;
  const allChecked = shown.length > 0 && shown.every((r) => sel.has(r.id));
  const toggleAll = () => setSel(allChecked ? new Set() : new Set(shown.map((r) => r.id)));
  const toggle = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selValue = selected.reduce((s, r) => s + (r.askPrice ?? 0), 0);
  const listBlock = ids.length > 0 && !canList
    ? `${nListed + nSold} of the selected cards are already ${nSold && !nListed ? "sold" : "listed"}. Only cards in stock can be listed.`
    : "";

  async function post(url: string, body: object, method = "POST") {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      return j;
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); return null; }
    finally { setBusy(false); }
  }

  async function exportCsv(markListed: boolean) {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/cardmarket/export", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, markListed }),
    });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); return setMsg({ ok: false, text: j.error ?? "Export failed" }); }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "cardmarket.csv";
    a.click();
    const skipped = Number(res.headers.get("X-Skipped") || 0);
    setMsg({
      ok: true,
      text: `Exported ${cards(Number(res.headers.get("X-Copies")))} in ${res.headers.get("X-Rows")} rows${markListed ? " and marked them as listed" : ""}.${skipped ? ` ${skipped} skipped (no price).` : ""}`,
    });
    if (markListed) { setSel(new Set()); router.refresh(); }
  }

  const done = (text: string) => { setMsg({ ok: true, text }); setSel(new Set()); router.refresh(); };

  return (
    <>
      <div className="toolbar">
        <div className="row">
          <div className="seg" role="radiogroup" aria-label="Status">
            {FILTERS.map((s) => (
              <label key={s}>
                <input type="radio" name="status" checked={status === s} onChange={() => { setStatus(s); setSel(new Set()); }} />
                {s === "ALL" ? "All" : STATUS_LABEL[s]}
              </label>
            ))}
          </div>
          <select value={lot} onChange={(e) => setLot(e.target.value)} aria-label="Purchase">
            <option value="">All purchases</option>
            {lots.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <input placeholder="Search name, set, SKU or location" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 250 }} />
          <input placeholder="Min. price €" value={minPrice} inputMode="decimal" style={{ width: 110 }} onChange={(e) => setMinPrice(e.target.value)} />
        </div>
        <span className="muted small">{cards(shown.length)}{ids.length > 0 && `, ${int(ids.length)} selected worth ${eur(selValue)}`}</span>
      </div>

      <div className="panel" style={{ padding: 12, marginBottom: 12 }}>
        <div className="row">
          <button disabled={busy || !canList} title={listBlock} onClick={() => exportCsv(true)}>List on Cardmarket (CSV)</button>
          <button disabled={busy || !canList} title={listBlock} className="ghost" onClick={() => exportCsv(false)}>Download CSV only</button>
          <button disabled={busy || !canList || !apiEnabled} className="ghost"
            title={apiEnabled ? listBlock : "Needs API access from Cardmarket. See README."}
            onClick={async () => {
              const j = await post("/api/cardmarket/push", { ids });
              if (j) done(`${j.dryRun ? "Test run: " : ""}${j.listed} listed, ${j.failed} failed, ${j.skippedNoProduct} without a Cardmarket product.${j.errors?.length ? " " + j.errors[0] : ""}`);
            }}>List via API</button>
          <span style={{ flex: 1 }} />
          <button disabled={busy} className="ghost" onClick={async () => {
            const j = await post("/api/inventory/reprice", { ids });
            if (j) { setMsg({ ok: true, text: `Prices updated: ${j.changed} of ${j.checked} changed.` }); router.refresh(); }
          }}>Update prices{ids.length ? "" : " for all"}</button>
          <button disabled={busy || !ids.length} className="ghost" onClick={async () => {
            const p = prompt(nSold === ids.length ? "What did the cards sell for (EUR per card)?" : "New price (EUR per card):");
            if (p && (await post("/api/inventory/status", { ids, action: "setPrice", price: Number(p.replace(",", ".")) }))) done("Price saved.");
          }}>{nSold > 0 && nSold === ids.length ? "Correct sale price" : "Set price"}</button>
          <button disabled={busy || !canSell} className="ghost" onClick={async () => {
            if (await post("/api/inventory/status", { ids, status: "SOLD" })) done(`${cards(ids.length)} marked as sold. Their slots are free again.`);
          }}>Mark sold</button>
          <button disabled={busy || !canUnlist} className="ghost" onClick={async () => {
            if (confirm(`Put ${cards(ids.length)} back in stock?${nListed ? " Remember to remove them from Cardmarket." : ""}`) &&
              (await post("/api/inventory/status", { ids, status: "IN_STOCK" }))) done("The cards are back in stock.");
          }}>Back to stock</button>
          <button disabled={busy || !ids.length} className="danger" onClick={async () => {
            const warn = nListed ? `\n\n${nListed} of them are listed. Remove them from Cardmarket too.` : "";
            if (!confirm(`Delete ${cards(ids.length)} permanently? This can't be undone.${warn}`)) return;
            const j = await post("/api/inventory/delete", { ids });
            if (j) done(`Deleted ${cards(j.deleted)}.${j.wereListed ? ` ${j.wereListed} were listed: remove them from Cardmarket.` : ""}`);
          }}>Delete</button>
        </div>
        {listBlock && <p className="hint" style={{ margin: "8px 0 0" }}>{listBlock}</p>}
      </div>
      {msg && <div className={msg.ok ? "ok" : "notice err"}>{msg.text}</div>}

      <div className="table-wrap">
        {shown.length === 0 ? (
          <div className="empty">
            <p>{rows.length === 0 ? "Your inventory is empty." : "No cards match these filters."}</p>
            {rows.length === 0 && <Link className="btn" href="/import">Import from ManaBox</Link>}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th><input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" /></th>
                <th>Location</th><th>SKU</th><th>Card</th><th>Condition</th>
                <th className="num">Trend</th><th className="num">{status === "SOLD" ? "Sold for" : "Price"}</th><th className="num">Cost</th>
                <th>Status</th><th>Purchase</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} onClick={(e) => { if ((e.target as HTMLElement).closest("a,input")) return; toggle(r.id); }} style={{ cursor: "pointer" }}>
                  <td><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.name}`} /></td>
                  <td>{r.location ? <span className="loc">{r.location}</span> : <span className="loc none">None</span>}</td>
                  <td className="sku">{r.sku}</td>
                  <td>
                    <span className="card-name">{r.name}</span>
                    {!r.hasProduct && <span className="err" title="No Cardmarket product. Must be matched by hand."> ⚠</span>}
                    <span className="card-sub">{r.setName} #{r.number}{r.foil ? ", foil" : ""}</span>
                  </td>
                  <td>{r.condition} {r.language.toUpperCase()}</td>
                  <td className="num muted">{eur(r.trend)}</td>
                  <td className="num"><strong>{r.status === "SOLD" ? eur(r.soldPrice) : eur(r.askPrice)}</strong></td>
                  <td className="num">{eur(r.costBasis)}</td>
                  <td><span className={`st ${r.status}`} title={r.lastListing ?? ""}>{STATUS_LABEL[r.status] ?? r.status}</span></td>
                  <td className="small">{r.lotId ? <Link href={`/purchases/${r.lotId}`}>{r.lotName}</Link> : <span className="hint">–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
