"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { eur, int, STATUS_LABEL } from "@/lib/format";

export interface InvRow {
  id: number; sku: string; location: string | null; name: string; setName: string; set: string; number: string;
  condition: string; language: string; foil: boolean; askPrice: number | null; soldPrice: number | null;
  trend: number | null; costBasis: number | null; status: string; lotId: number | null; lotName: string | null;
  hasProduct: boolean; lastListing: string | null;
}

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

  const ids = [...sel].filter((id) => shown.some((r) => r.id === id));
  const allChecked = shown.length > 0 && shown.every((r) => sel.has(r.id));
  const toggleAll = () => setSel(allChecked ? new Set() : new Set(shown.map((r) => r.id)));
  const toggle = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selValue = shown.filter((r) => sel.has(r.id)).reduce((s, r) => s + (r.askPrice ?? 0), 0);

  async function post(url: string, body: object) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "cardmarket.csv";
    a.click();
    setMsg({ ok: true, text: `${res.headers.get("X-Copies")} kort eksporteret i ${res.headers.get("X-Rows")} rækker${markListed ? " og markeret som til salg" : ""}.` });
    setBusy(false);
    if (markListed) { setSel(new Set()); router.refresh(); }
  }

  const done = (text: string) => { setMsg({ ok: true, text }); setSel(new Set()); router.refresh(); };

  return (
    <>
      <div className="toolbar">
        <div className="row">
          <div className="seg" role="radiogroup" aria-label="Status">
            {["IN_STOCK", "LISTED", "SOLD", "ALL"].map((s) => (
              <label key={s}><input type="radio" name="status" checked={status === s} onChange={() => { setStatus(s); setSel(new Set()); }} />{s === "ALL" ? "Alle" : STATUS_LABEL[s]}</label>
            ))}
          </div>
          <select value={lot} onChange={(e) => setLot(e.target.value)} aria-label="Indkøb">
            <option value="">Alle indkøb</option>
            {lots.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <input placeholder="Søg navn, sæt, SKU eller plads" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />
          <input placeholder="Min. pris €" value={minPrice} inputMode="decimal" style={{ width: 100 }} onChange={(e) => setMinPrice(e.target.value)} />
        </div>
        <span className="muted small">{int(shown.length)} kort{ids.length > 0 && `, ${int(ids.length)} valgt til ${eur(selValue)}`}</span>
      </div>

      <div className="panel" style={{ padding: 12, marginBottom: 12 }}>
        <div className="row">
          <button disabled={busy || !ids.length} onClick={() => exportCsv(true)}>Sæt til salg (Cardmarket-CSV)</button>
          <button disabled={busy || !ids.length} className="ghost" onClick={() => exportCsv(false)}>Kun hent CSV</button>
          <button disabled={busy || !ids.length || !apiEnabled} className="ghost"
            title={apiEnabled ? "" : "Kræver API-adgang fra Cardmarket. Se README."}
            onClick={async () => {
              const j = await post("/api/cardmarket/push", { ids });
              if (j) done(`${j.dryRun ? "Testkørsel: " : ""}${j.listed} sat til salg, ${j.failed} fejlede, ${j.skippedNoProduct} uden Cardmarket-produkt.${j.errors?.length ? " " + j.errors[0] : ""}`);
            }}>Send via API</button>
          <span style={{ flex: 1 }} />
          <button disabled={busy} className="ghost" onClick={async () => {
            const j = await post("/api/inventory/reprice", { ids });
            if (j) { setMsg({ ok: true, text: `Priser opdateret: ${j.changed} af ${j.checked} ændret.` }); router.refresh(); }
          }}>Opdatér priser{ids.length ? "" : " på alle"}</button>
          <button disabled={busy || !ids.length} className="ghost" onClick={async () => {
            const p = prompt(status === "SOLD" ? "Hvad blev kortene solgt for (EUR pr. kort)?" : "Ny pris (EUR pr. kort):");
            if (p && (await post("/api/inventory/status", { ids, action: "setPrice", price: Number(p.replace(",", ".")) }))) done("Pris gemt.");
          }}>{status === "SOLD" ? "Ret salgspris" : "Sæt pris"}</button>
          <button disabled={busy || !ids.length} className="ghost" onClick={async () => {
            if (await post("/api/inventory/status", { ids, status: "SOLD" })) done(`${ids.length} kort markeret som solgt. Pladserne er ledige igen.`);
          }}>Markér solgt</button>
          <button disabled={busy || !ids.length} className="ghost" onClick={async () => {
            if (confirm(`Sæt ${ids.length} kort tilbage på lager? Husk at fjerne dem fra Cardmarket.`) &&
              (await post("/api/inventory/status", { ids, status: "IN_STOCK" }))) done("Kortene er tilbage på lager.");
          }}>Tilbage på lager</button>
        </div>
      </div>
      {msg && <div className={msg.ok ? "ok" : "notice err"}>{msg.text}</div>}

      <div className="table-wrap">
        {shown.length === 0 ? (
          <div className="empty">
            <p>{rows.length === 0 ? "Lageret er tomt." : "Ingen kort matcher filtrene."}</p>
            {rows.length === 0 && <Link className="btn" href="/import">Importér fra ManaBox</Link>}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th><input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Vælg alle" /></th>
                <th>Placering</th><th>SKU</th><th>Kort</th><th>Stand</th>
                <th className="num">Trend</th><th className="num">{status === "SOLD" ? "Solgt for" : "Pris"}</th><th className="num">Kostpris</th>
                <th>Status</th><th>Indkøb</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} onClick={(e) => { if ((e.target as HTMLElement).closest("a,input")) return; toggle(r.id); }} style={{ cursor: "pointer" }}>
                  <td><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Vælg ${r.name}`} /></td>
                  <td>{r.location ? <span className="loc">{r.location}</span> : <span className="loc none">Ingen</span>}</td>
                  <td className="sku">{r.sku}</td>
                  <td>
                    <span className="card-name">{r.name}</span>
                    {!r.hasProduct && <span className="err" title="Mangler Cardmarket-produkt. Skal matches i hånden."> ⚠</span>}
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
