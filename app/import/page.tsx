"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { parseManabox, type ImportRow } from "@/lib/core/manabox";
import { eur, int } from "@/lib/format";
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
            <h1>{int(result.imported)} kort er på lageret</h1>
            <p>
              Salgsværdi {eur(result.value)}.
              {result.skipped > 0 && ` ${result.skipped} linjer blev sprunget over.`}
            </p>
          </div>
          <div className="row no-print">
            <button onClick={() => window.print()}>Print placeringsliste</button>
            {result.purchaseId && <Link className="btn ghost" href={`/purchases/${result.purchaseId}`}>Se indkøbet</Link>}
            <button className="ghost" onClick={() => { setResult(null); setRows([]); setCsv(""); setFileName(""); setLotName(""); setLotTotal(""); }}>Importér en fil til</button>
          </div>
        </div>
        {result.errors.map((e) => <div key={e} className="err">{e}</div>)}
        <div className="notice">
          Listen følger rækkefølgen, du scannede i. Tag bunken fra toppen, og læg hvert kort på pladsen ud for det.
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Placering</th><th>SKU</th><th>Kort</th><th>Stand</th><th className="num">Pris</th><th>Bemærkning</th></tr></thead>
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
          <h1>Importér fra ManaBox</h1>
          <p>Scan kortene i ManaBox, sæt stand og sprog dér, og eksportér som CSV. Hvert kort får en plads, en pris og sit eget SKU.</p>
        </div>
      </div>

      <label className="drop">
        <strong>{fileName || "Vælg ManaBox-fil"}</strong>
        <span className="muted">{fileName ? `${int(copies)} kort fundet. Klik for at vælge en anden fil.` : "CSV-eksport fra ManaBox"}</span>
        <input type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
      {parseErrors.map((e) => <div key={e} className="err" style={{ marginTop: 8 }}>{e}</div>)}

      {rows.length > 0 && (
        <>
          <div className="section">
            <h2>Hvad har du betalt?</h2>
            <div className="panel">
              <div className="seg" role="radiogroup" aria-label="Kostpris">
                <label><input type="radio" name="mode" checked={mode === "newLot"} onChange={() => setMode("newLot")} />Nyt indkøb</label>
                <label><input type="radio" name="mode" checked={mode === "existingLot"} onChange={() => setMode("existingLot")} disabled={!lots.length} />Tilføj til indkøb</label>
                <label><input type="radio" name="mode" checked={mode === "flat"} onChange={() => setMode("flat")} />Fast pris pr. kort</label>
                <label><input type="radio" name="mode" checked={mode === "file"} onChange={() => setMode("file")} />Pris fra ManaBox</label>
              </div>

              {mode === "newLot" && (
                <>
                  <div className="grid-form">
                    <label className="field">Navn på indkøbet<input value={lotName} onChange={(e) => setLotName(e.target.value)} placeholder="Fx Samling fra DBA, Peter" /></label>
                    <label className="field">Betalt i alt (EUR)<input inputMode="decimal" value={lotTotal} onChange={(e) => setLotTotal(e.target.value)} placeholder="Inkl. fragt" /></label>
                    <label className="field">Købt den<input type="date" value={lotDate} onChange={(e) => setLotDate(e.target.value)} /></label>
                  </div>
                  <div style={{ marginTop: 14 }}><MethodChoice name="import-method" value={lotMethod} onChange={setLotMethod} /></div>
                </>
              )}
              {mode === "existingLot" && (
                <div className="grid-form">
                  <label className="field">Indkøb
                    <select value={purchaseId} onChange={(e) => setPurchaseId(e.target.value)}>
                      <option value="">Vælg…</option>
                      {lots.map((l) => <option key={l.id} value={l.id}>{l.name} ({int(l.cards)} kort, {eur(l.totalCost)})</option>)}
                    </select>
                    <span className="hint">Prisen fordeles igen over alle kort i indkøbet, også dem du har importeret før.</span>
                  </label>
                </div>
              )}
              {mode === "flat" && (
                <div className="grid-form">
                  <label className="field">Kostpris pr. kort (EUR)<input inputMode="decimal" value={flatCost} onChange={(e) => setFlatCost(e.target.value)} placeholder="Tom = ukendt" /></label>
                </div>
              )}
              {mode === "file" && (
                <div className="grid-form">
                  <label className="field">USD til EUR<input inputMode="decimal" value={usdToEur} onChange={(e) => setUsdToEur(e.target.value)} /></label>
                  <label className="field">Kort uden pris i filen (EUR)<input inputMode="decimal" value={flatCost} onChange={(e) => setFlatCost(e.target.value)} placeholder="Tom = ukendt" /></label>
                  <span className="hint" style={{ alignSelf: "end" }}>ManaBox udfylder ofte markedsprisen her, ikke det du betalte. Brug kun dette, hvis du selv har skrevet priserne ind.</span>
                </div>
              )}
            </div>
          </div>

          <div className="row" style={{ margin: "20px 0" }}>
            <button disabled={busy || !importable.length || missingCost} onClick={doImport}>
              {busy ? "Henter priser og fordeler pladser…" : `Importér ${int(copies)} kort`}
            </button>
            {missingCost && <span className="hint">{mode === "newLot" ? "Skriv hvad du har betalt." : "Vælg et indkøb."}</span>}
            {fail && <span className="err">{fail}</span>}
          </div>

          <div className="table-wrap">
            <table>
              <thead><tr><th>Kort</th><th>Stand</th><th>Sprog</th><th className="num">Antal</th><th>Bemærkning</th></tr></thead>
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
