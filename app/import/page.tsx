"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { parseManabox, type ImportRow } from "@/lib/core/manabox";
import { cards, eur } from "@/lib/format";
import { MethodChoice } from "@/components/NewPurchaseForm";

interface Placement {
  line: number; name: string; set: string; number: string; condition: string; language: string;
  foil: boolean; askPrice: number | null; flags: string[]; locations: string[]; skus: string[];
}
interface Result { imported: number; skipped: number; errors: string[]; value: number; purchaseId: number | null; placements: Placement[] }
interface Lot { id: number; name: string; cards: number; totalCost: number }
type Mode = "newLot" | "existingLot" | "flat" | "file";

export default function ImportPage() {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);

  const [mode, setMode] = useState<Mode>("newLot");
  const [lotName, setLotName] = useState("");
  const [lotTotal, setLotTotal] = useState("");
  const [lotDate, setLotDate] = useState(new Date().toISOString().slice(0, 10));
  const [lotMethod, setLotMethod] = useState<"VALUE" | "EQUAL">("VALUE");
  const [purchaseId, setPurchaseId] = useState("");
  const [flatCost, setFlatCost] = useState("");
  const [usdToEur, setUsdToEur] = useState("0,92");

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [fail, setFail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/purchases").then((r) => r.json()).then((l: Lot[]) => setLots(l)).catch(() => {});
  }, []);

  async function onFile(f: File) {
    const text = await f.text();
    const p = parseManabox(text);
    setCsv(text); setFileName(f.name); setRows(p.rows); setParseErrors(p.errors); setResult(null); setFail(null);
    if (!lotName) setLotName(f.name.replace(/\.csv$/i, ""));
  }

  async function doImport() {
    setBusy(true); setFail(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, costMode: mode, lotName, lotTotal, lotDate, lotMethod, purchaseId, flatCost, usdToEur }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      setResult(j);
    } catch (e) { setFail((e as Error).message); }
    finally { setBusy(false); }
  }

  const importable = rows.filter((r) => !r.skip);
  const copies = importable.reduce((n, r) => n + r.quantity, 0);
  const missingCost = (mode === "newLot" && !lotTotal) || (mode === "existingLot" && !purchaseId);

  if (result) {
    return (
      <>
        <div className="head">
          <div>
            <h1>{cards(result.imported)} added to inventory</h1>
            <p>
              Sales value {eur(result.value)}.
              {result.skipped > 0 && ` ${result.skipped} lines were skipped.`}
            </p>
          </div>
          <div className="row no-print">
            <button onClick={() => window.print()}>Print placement list</button>
            {result.purchaseId && <Link className="btn ghost" href={`/purchases/${result.purchaseId}`}>View purchase</Link>}
            <button className="ghost" onClick={() => { setResult(null); setRows([]); setCsv(""); setFileName(""); setLotName(""); setLotTotal(""); }}>Import another file</button>
          </div>
        </div>
        {result.errors.map((e) => <div key={e} className="err">{e}</div>)}
        <div className="notice">
          The list follows the order you scanned in. Take the stack from the top and put each card in the slot next to it.
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Location</th><th>SKU</th><th>Card</th><th>Condition</th><th className="num">Price</th><th>Note</th></tr></thead>
            <tbody>
              {result.placements.map((p) => (
                <tr key={p.line}>
                  <td><div className="row" style={{ gap: 4 }}>{p.locations.map((l) => <span key={l} className="loc">{l}</span>)}</div></td>
                  <td className="sku">{p.skus.join(" ")}</td>
                  <td><span className="card-name">{p.name}</span><span className="card-sub">{p.set} #{p.number}{p.foil ? ", foil" : ""}</span></td>
                  <td>{p.condition} {p.language.toUpperCase()}</td>
                  <td className="num">{eur(p.askPrice)}</td>
                  <td className="err small">{p.flags.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>Import from ManaBox</h1>
          <p>Scan the cards in ManaBox, set condition and language there, and export as CSV. Every card gets a slot, a price and its own SKU.</p>
        </div>
      </div>

      <label className="drop">
        <strong>{fileName || "Choose ManaBox file"}</strong>
        <span className="muted">{fileName ? `${cards(copies)} found. Click to choose another file.` : "CSV export from ManaBox"}</span>
        <input type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
      {parseErrors.map((e) => <div key={e} className="err" style={{ marginTop: 8 }}>{e}</div>)}

      {rows.length > 0 && (
        <>
          <div className="section">
            <h2>What did you pay?</h2>
            <div className="panel">
              <div className="seg" role="radiogroup" aria-label="Cost">
                <label><input type="radio" name="mode" checked={mode === "newLot"} onChange={() => setMode("newLot")} />New purchase</label>
                <label><input type="radio" name="mode" checked={mode === "existingLot"} onChange={() => setMode("existingLot")} disabled={!lots.length} />Add to purchase</label>
                <label><input type="radio" name="mode" checked={mode === "flat"} onChange={() => setMode("flat")} />Fixed cost per card</label>
                <label><input type="radio" name="mode" checked={mode === "file"} onChange={() => setMode("file")} />Price from ManaBox</label>
              </div>

              {mode === "newLot" && (
                <>
                  <div className="grid-form">
                    <label className="field">Purchase name<input value={lotName} onChange={(e) => setLotName(e.target.value)} placeholder="E.g. Collection from DBA, Peter" /></label>
                    <label className="field">Total paid (EUR)<input inputMode="decimal" value={lotTotal} onChange={(e) => setLotTotal(e.target.value)} placeholder="Incl. shipping" /></label>
                    <label className="field">Purchase date<input type="date" value={lotDate} onChange={(e) => setLotDate(e.target.value)} /></label>
                  </div>
                  <div style={{ marginTop: 14 }}><MethodChoice name="import-method" value={lotMethod} onChange={setLotMethod} /></div>
                </>
              )}
              {mode === "existingLot" && (
                <div className="grid-form">
                  <label className="field">Purchase
                    <select value={purchaseId} onChange={(e) => setPurchaseId(e.target.value)}>
                      <option value="">Choose…</option>
                      {lots.map((l) => <option key={l.id} value={l.id}>{l.name} ({cards(l.cards)}, {eur(l.totalCost)})</option>)}
                    </select>
                    <span className="hint">The price is split again over all cards in the purchase, including those imported earlier.</span>
                  </label>
                </div>
              )}
              {mode === "flat" && (
                <div className="grid-form">
                  <label className="field">Cost per card (EUR)<input inputMode="decimal" value={flatCost} onChange={(e) => setFlatCost(e.target.value)} placeholder="Empty = unknown" /></label>
                </div>
              )}
              {mode === "file" && (
                <div className="grid-form">
                  <label className="field">USD to EUR<input inputMode="decimal" value={usdToEur} onChange={(e) => setUsdToEur(e.target.value)} /></label>
                  <label className="field">Cards without a price in the file (EUR)<input inputMode="decimal" value={flatCost} onChange={(e) => setFlatCost(e.target.value)} placeholder="Empty = unknown" /></label>
                  <span className="hint" style={{ alignSelf: "end" }}>ManaBox often fills in the market price here, not what you paid. Only use this if you entered the prices yourself.</span>
                </div>
              )}
            </div>
          </div>

          <div className="row" style={{ margin: "20px 0" }}>
            <button disabled={busy || !importable.length || missingCost} onClick={doImport}>
              {busy ? "Fetching prices and assigning slots…" : `Import ${cards(copies)}`}
            </button>
            {missingCost && <span className="hint">{mode === "newLot" ? "Enter what you paid." : "Choose a purchase."}</span>}
            {fail && <span className="err">{fail}</span>}
          </div>

          <div className="table-wrap">
            <table>
              <thead><tr><th>Card</th><th>Condition</th><th>Language</th><th className="num">Qty</th><th>Note</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line} className={r.skip ? "dim" : undefined}>
                    <td><span className="card-name">{r.name}</span><span className="card-sub">{r.setName || r.setCode} #{r.collectorNumber}{r.foil ? ", foil" : ""}</span></td>
                    <td>{r.condition}</td>
                    <td>{r.language.toUpperCase()}</td>
                    <td className="num">{r.quantity}</td>
                    <td className="err small">{[r.skip, ...r.flags].filter(Boolean).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
