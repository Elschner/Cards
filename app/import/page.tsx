"use client";
import { useState } from "react";
import { parseManabox, type ImportRow } from "@/lib/core/manabox";

interface Placement {
  line: number; name: string; set: string; number: string; condition: string; language: string;
  foil: boolean; askPrice: number | null; flags: string[]; locations: string[];
}
interface Result { imported: number; skipped: number; errors: string[]; value: number; placements: Placement[] }

const eur = (n: number | null) => (n == null ? "—" : `€${n.toFixed(2)}`);

export default function ImportPage() {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [useFilePrice, setUseFilePrice] = useState(false);
  const [usdToEur, setUsdToEur] = useState("0.92");
  const [defaultCost, setDefaultCost] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [fail, setFail] = useState<string | null>(null);

  async function onFile(f: File) {
    const text = await f.text();
    const p = parseManabox(text);
    setCsv(text); setFileName(f.name); setRows(p.rows); setErrors(p.errors); setResult(null); setFail(null);
  }

  async function doImport() {
    setBusy(true); setFail(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, useFilePrice, usdToEur, defaultCost }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      setResult(j);
    } catch (e) { setFail((e as Error).message); }
    finally { setBusy(false); }
  }

  const importable = rows.filter((r) => !r.skip);
  const copies = importable.reduce((n, r) => n + r.quantity, 0);

  if (result) {
    return (
      <>
        <h1>Importeret: {result.imported} kort</h1>
        <p>
          Samlet salgsværdi {eur(result.value)}
          {result.skipped > 0 && ` · ${result.skipped} linjer sprunget over`}
        </p>
        {result.errors.map((e) => <div key={e} className="err">{e}</div>)}
        <div className="notice">
          <strong>Læg kortene på plads:</strong> listen følger scan-rækkefølgen i ManaBox (ældste scanning først).
          Tag bunken i samme rækkefølge og læg hvert kort på pladsen ud for det.
        </div>
        <div className="row" style={{ marginBottom: 12 }}>
          <button onClick={() => window.print()}>Print placeringsliste</button>
          <a className="btn" href="/inventory">Til lageret</a>
          <button className="secondary" onClick={() => { setResult(null); setRows([]); setCsv(""); setFileName(""); }}>Importér en fil til</button>
        </div>
        <table>
          <thead><tr><th>#</th><th>Placering</th><th>Kort</th><th>Sæt</th><th>Stand</th><th>Sprog</th><th>Foil</th><th className="num">Pris</th><th>Note</th></tr></thead>
          <tbody>
            {result.placements.map((p, i) => (
              <tr key={p.line}>
                <td className="muted">{i + 1}</td>
                <td className="loc">{p.locations.join(", ")}</td>
                <td>{p.name}</td>
                <td>{p.set} #{p.number}</td>
                <td>{p.condition}</td>
                <td>{p.language.toUpperCase()}</td>
                <td>{p.foil ? "★" : ""}</td>
                <td className="num">{eur(p.askPrice)}</td>
                <td className="err">{p.flags.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  return (
    <>
      <h1>Importér fra ManaBox</h1>
      <p className="muted">
        I ManaBox: scan kortene, sæt stand og sprog, og eksportér samlingen/listen som CSV. Vælg filen her.
      </p>

      <label className="drop" style={{ display: "block", cursor: "pointer" }}>
        <strong>{fileName || "Vælg ManaBox CSV-fil"}</strong>
        <div className="muted">Klik for at vælge fil</div>
        <input type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>

      {errors.map((e) => <div key={e} className="err" style={{ marginTop: 8 }}>{e}</div>)}

      {rows.length > 0 && (
        <>
          <h2>{copies} kort klar til import ({importable.length} linjer)</h2>
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="row">
              <label>
                <input type="checkbox" checked={useFilePrice} onChange={(e) => setUseFilePrice(e.target.checked)} />{" "}
                Brug “Purchase price” fra filen som kostpris
              </label>
              {useFilePrice && (
                <label>USD→EUR kurs <input value={usdToEur} onChange={(e) => setUsdToEur(e.target.value)} style={{ width: 70 }} /></label>
              )}
              <label>
                {useFilePrice ? "Ellers kostpris pr. kort €" : "Kostpris pr. kort €"}{" "}
                <input value={defaultCost} onChange={(e) => setDefaultCost(e.target.value)} placeholder="tom = ukendt" style={{ width: 100 }} />
              </label>
            </div>
            <p className="muted" style={{ marginBottom: 0 }}>
              ManaBox udfylder ofte “Purchase price” med markedsprisen, ikke hvad du har betalt – slå kun til, hvis du selv har sat den.
            </p>
          </div>
          <div className="row" style={{ marginBottom: 12 }}>
            <button disabled={busy || !importable.length} onClick={doImport}>
              {busy ? "Importerer… (henter priser)" : `Importér ${copies} kort`}
            </button>
            {fail && <span className="err">{fail}</span>}
          </div>
          <table>
            <thead><tr><th>Kort</th><th>Sæt</th><th>Stand</th><th>Sprog</th><th>Foil</th><th className="num">Antal</th><th>Bemærkning</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.line} style={r.skip ? { opacity: 0.45 } : undefined}>
                  <td>{r.name}</td>
                  <td>{r.setCode} #{r.collectorNumber}</td>
                  <td>{r.condition}</td>
                  <td>{r.language.toUpperCase()}</td>
                  <td>{r.foil ? "★" : ""}</td>
                  <td className="num">{r.quantity}</td>
                  <td className="err">{[r.skip, ...r.flags].filter(Boolean).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
