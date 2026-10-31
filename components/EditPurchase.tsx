"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MethodChoice } from "./NewPurchaseForm";

export default function EditPurchase(p: { id: number; name: string; totalCost: number; method: string }) {
  const router = useRouter();
  const [name, setName] = useState(p.name);
  const [total, setTotal] = useState(String(p.totalCost).replace(".", ","));
  const [method, setMethod] = useState<"VALUE" | "EQUAL">(p.method === "EQUAL" ? "EQUAL" : "VALUE");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/purchases/${p.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, totalCost: total, method }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: j.error });
    setMsg({ ok: true, text: `Gemt. Prisen er fordelt på ${j.items} kort.` });
    router.refresh();
  }

  return (
    <div className="panel">
      <div className="grid-form" style={{ marginTop: 0 }}>
        <label className="field">Navn<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field">Betalt i alt (EUR)<input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} /></label>
      </div>
      <div style={{ marginTop: 14 }}><MethodChoice name={`method-${p.id}`} value={method} onChange={setMethod} /></div>
      <div className="row" style={{ marginTop: 16 }}>
        <button disabled={busy} onClick={save}>{busy ? "Fordeler…" : "Gem og fordel prisen"}</button>
        <span className="hint">Solgte kort er med i fordelingen, så indkøbets samlede kostpris altid passer.</span>
      </div>
      {msg && <div className={msg.ok ? "ok" : "notice err"}>{msg.text}</div>}
    </div>
  );
}
