"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cards, eur } from "@/lib/format";

export interface PtExport {
  csv: string; rows: number; copies: number; ids: number[]; value: number;
  missing: { sku: string | null; name: string; set: string }[];
}

/** Route A: every set in one file, uploaded through TCG PowerTools. */
export default function PowertoolsPanel({ data }: { data: PtExport }) {
  const router = useRouter();
  const [downloaded, setDownloaded] = useState(false);
  const [listed, setListed] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function download() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data.csv], { type: "text/csv" }));
    a.download = `powertools-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.csv`;
    a.click();
    setDownloaded(true);
  }

  async function markListed() {
    if (!confirm(`Mark ${cards(data.copies)} as listed? Only do this once PowerTools has published them to Cardmarket.`)) return;
    setErr(null);
    const res = await fetch("/api/cardmarket/listed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: data.ids }) });
    if (!res.ok) return setErr("Could not mark as listed");
    setListed(true);
    router.refresh();
  }

  return (
    <div className="panel" style={{ borderColor: "var(--ink-3)" }}>
      <h2>All sets at once, through TCG PowerTools</h2>
      <p className="muted" style={{ margin: "6px 0 12px" }}>
        {cards(data.copies)} worth {eur(data.value)} in one file, {data.rows} rows. PowerTools matches each card by its Cardmarket ID.
      </p>
      <div className="row">
        <button onClick={download} disabled={!data.copies}>Download PowerTools CSV</button>
        {listed
          ? <span className="st LISTED">Marked as listed</span>
          : <button className="ghost" onClick={markListed} disabled={!downloaded || !data.copies} title={downloaded ? "" : "Download the file first"}>Mark as listed</button>}
      </div>
      <ol className="small muted" style={{ margin: "12px 0 0", paddingLeft: 20, lineHeight: 1.7 }}>
        <li>In PowerTools: <b>Listing &amp; Appraisal</b>, then <b>Import a file</b>, and choose the downloaded file.</li>
        <li>Check the imported list: prices, conditions and foil. Then <b>Publish to Cardmarket</b>.</li>
        <li>Back here: <b>Mark as listed</b>.</li>
      </ol>
      {data.missing.length > 0 && (
        <p className="err small" style={{ marginBottom: 0 }}>
          Not in the file, no Cardmarket ID: {data.missing.map((m) => `${m.name} (${m.set}${m.sku ? `, ${m.sku}` : ""})`).join("; ")}. List these by hand or with the per-set files below.
        </p>
      )}
      {err && <p className="err">{err}</p>}
    </div>
  );
}
