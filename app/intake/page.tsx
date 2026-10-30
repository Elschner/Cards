"use client";
import { useCallback, useRef, useState } from "react";
import { CONDITIONS, CONDITION_LABELS, computeAskPrice, type Condition } from "@/lib/core/pricing";

interface Printing {
  id: string; name: string; set: string; set_name: string; collector_number: string; lang: string;
  finishes?: string[];
  image_uris?: { small: string; normal: string };
  card_faces?: { image_uris?: { small: string; normal: string } }[];
  prices: { eur: string | null; eur_foil: string | null };
}

interface Row {
  key: string;
  previewUrl: string | null;
  photoPath: string | null;
  state: "recognizing" | "ready" | "saving" | "saved" | "error";
  error?: string;
  confidence?: string;
  printings: Printing[];
  selectedId: string | null;
  condition: Condition;
  foil: boolean;
  language: string;
  quantity: number;
  costBasis: string;
  locations?: string[];
  manualQuery: string;
  suggestions: string[];
}

const LANGS = ["en", "de", "fr", "it", "es", "pt", "ja", "ko", "ru", "zhs", "zht"];

/** Shrink phone photos (often 3–8 MB) to ~1600px JPEG before upload: faster and cheaper to read. */
async function downscale(file: File, maxSide = 1600): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
    return blob ?? file;
  } catch {
    return file;
  }
}
const img = (p?: Printing) => p?.image_uris?.small ?? p?.card_faces?.[0]?.image_uris?.small;

const blank = (key: string, previewUrl: string | null): Row => ({
  key, previewUrl, photoPath: null, state: "recognizing", printings: [], selectedId: null,
  condition: "NM", foil: false, language: "en", quantity: 1, costBasis: "", manualQuery: "", suggestions: [],
});

export default function Intake() {
  const [rows, setRows] = useState<Row[]>([]);
  const [over, setOver] = useState(false);
  const [defaults, setDefaults] = useState({ condition: "NM" as Condition, costBasis: "" });
  const inputRef = useRef<HTMLInputElement>(null);

  const patch = useCallback((key: string, p: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  }, []);

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const newRows = list.map((f) => ({ ...blank(crypto.randomUUID(), URL.createObjectURL(f)), condition: defaults.condition, costBasis: defaults.costBasis }));
    setRows((rs) => [...newRows, ...rs]);
    // Sequential to stay well inside API rate limits.
    for (let i = 0; i < list.length; i++) {
      const key = newRows[i].key;
      try {
        const fd = new FormData();
        fd.append("image", await downscale(list[i]), "card.jpg");
        const res = await fetch("/api/recognize", { method: "POST", body: fd });
        const j = await res.json();
        const printings: Printing[] = j.alternatives?.length ? j.alternatives : j.match ? [j.match] : [];
        if (j.match && !printings.some((p) => p.id === j.match.id)) printings.unshift(j.match);
        patch(key, {
          photoPath: j.photoPath ?? null,
          printings,
          selectedId: j.match?.id ?? null,
          language: j.reading?.language && LANGS.includes(j.reading.language) ? j.reading.language : "en",
          foil: Boolean(j.reading?.foil),
          confidence: j.reading?.confidence,
          state: j.match ? "ready" : "error",
          error: j.match ? undefined : j.error ?? "Not recognized — search manually",
        });
      } catch (e) {
        patch(key, { state: "error", error: (e as Error).message });
      }
    }
  }

  async function search(row: Row, q: string) {
    patch(row.key, { manualQuery: q });
    if (q.length < 2) return patch(row.key, { suggestions: [] });
    const s: string[] = await (await fetch(`/api/scryfall/autocomplete?q=${encodeURIComponent(q)}`)).json();
    patch(row.key, { suggestions: s.slice(0, 8) });
  }

  async function pickName(row: Row, name: string) {
    patch(row.key, { manualQuery: name, suggestions: [] });
    const p: Printing[] = await (await fetch(`/api/scryfall/printings?name=${encodeURIComponent(name)}`)).json();
    patch(row.key, { printings: p, selectedId: p[0]?.id ?? null, state: p.length ? "ready" : "error", error: p.length ? undefined : "No printings found" });
  }

  async function save(row: Row) {
    if (!row.selectedId) return;
    patch(row.key, { state: "saving" });
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scryfallId: row.selectedId, condition: row.condition, foil: row.foil, language: row.language,
        quantity: row.quantity, costBasis: row.costBasis, photoPath: row.photoPath,
      }),
    });
    const j = await res.json();
    if (!res.ok) return patch(row.key, { state: "ready", error: j.error });
    patch(row.key, { state: "saved", locations: j.created.map((c: { location: string }) => c.location), error: undefined });
  }

  return (
    <>
      <h1>Intake</h1>
      <div className="row" style={{ marginBottom: 12 }}>
        <span className="muted">Defaults for new uploads:</span>
        <select value={defaults.condition} onChange={(e) => setDefaults({ ...defaults, condition: e.target.value as Condition })}>
          {CONDITIONS.map((c) => <option key={c} value={c}>{c} – {CONDITION_LABELS[c]}</option>)}
        </select>
        <input placeholder="Cost per card €" style={{ width: 140 }} value={defaults.costBasis}
          onChange={(e) => setDefaults({ ...defaults, costBasis: e.target.value })} />
        <button className="secondary" onClick={() => setRows((rs) => [{ ...blank(crypto.randomUUID(), null), state: "error", error: "Manual entry", condition: defaults.condition, costBasis: defaults.costBasis }, ...rs])}>
          + Manual entry
        </button>
      </div>

      <div
        className={`drop ${over ? "over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
      >
        <strong>Drop card photos here</strong> or click to choose / use phone camera
        <div className="muted">One card per photo, info line (bottom-left) in focus.</div>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple hidden
          onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      </div>

      {rows.map((row) => {
        const sel = row.printings.find((p) => p.id === row.selectedId);
        const est = sel ? computeAskPrice({
          priceEur: sel.prices.eur ? Number(sel.prices.eur) : null,
          priceEurFoil: sel.prices.eur_foil ? Number(sel.prices.eur_foil) : null,
          foil: row.foil, condition: row.condition, language: row.language,
        }) : null;
        const locked = row.state === "saved" || row.state === "saving";
        return (
          <div key={row.key} className="panel intake-card">
            <div>{row.previewUrl ? <img src={row.previewUrl} alt="upload" /> : <span className="muted">No photo</span>}</div>
            <div>{img(sel) ? <img src={img(sel)} alt={sel?.name} /> : <span className="muted">{row.state === "recognizing" ? "Reading card…" : "No match"}</span>}</div>
            <div>
              {row.state === "saved" ? (
                <>
                  <div><strong>{sel?.name}</strong> <span className="muted">{sel?.set.toUpperCase()} #{sel?.collector_number}</span></div>
                  <div className="muted" style={{ marginTop: 8 }}>Put in:</div>
                  {row.locations?.map((l) => <div key={l} className="big-loc">{l}</div>)}
                </>
              ) : (
                <>
                  {row.error && <div className="err" style={{ marginBottom: 6 }}>{row.error}</div>}
                  {(row.state === "error" || !sel) && row.state !== "recognizing" && (
                    <div style={{ position: "relative", marginBottom: 8 }}>
                      <input placeholder="Search card name…" value={row.manualQuery} style={{ width: 320 }}
                        onChange={(e) => search(row, e.target.value)} />
                      {row.suggestions.length > 0 && (
                        <div className="panel" style={{ position: "absolute", zIndex: 5, padding: 4, width: 320 }}>
                          {row.suggestions.map((s) => (
                            <div key={s} style={{ padding: 4, cursor: "pointer" }} onClick={() => pickName(row, s)}>{s}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {row.printings.length > 0 && (
                    <div className="row" style={{ marginBottom: 8 }}>
                      <select value={row.selectedId ?? ""} disabled={locked} style={{ maxWidth: 460 }}
                        onChange={(e) => patch(row.key, { selectedId: e.target.value })}>
                        {row.printings.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {p.set_name} ({p.set.toUpperCase()}) #{p.collector_number} · €{p.prices.eur ?? "–"} / foil €{p.prices.eur_foil ?? "–"}
                          </option>
                        ))}
                      </select>
                      {row.confidence && <span className="muted">read confidence: {row.confidence}</span>}
                    </div>
                  )}
                  <div className="row">
                    <select value={row.condition} disabled={locked} onChange={(e) => patch(row.key, { condition: e.target.value as Condition })}>
                      {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={row.language} disabled={locked} onChange={(e) => patch(row.key, { language: e.target.value })}>
                      {LANGS.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                    </select>
                    <label><input type="checkbox" checked={row.foil} disabled={locked} onChange={(e) => patch(row.key, { foil: e.target.checked })} /> Foil</label>
                    <input type="number" min={1} value={row.quantity} disabled={locked} style={{ width: 64 }}
                      onChange={(e) => patch(row.key, { quantity: Number(e.target.value) })} title="Quantity" />
                    <input placeholder="Cost €" value={row.costBasis} disabled={locked} style={{ width: 80 }}
                      onChange={(e) => patch(row.key, { costBasis: e.target.value })} />
                    <span>
                      Ask: <strong>{est?.price != null ? `€${est.price.toFixed(2)}` : "—"}</strong>
                      {est?.isBulk && <span className="muted"> (bulk)</span>}
                    </span>
                    <button disabled={!sel || locked} onClick={() => save(row)}>
                      {row.state === "saving" ? "Saving…" : "Add to inventory"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
