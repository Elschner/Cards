"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function MethodChoice({ value, onChange, name }: { value: string; onChange: (v: "VALUE" | "EQUAL") => void; name: string }) {
  return (
    <div className="field">
      Fordel prisen
      <div className="seg" role="radiogroup">
        <label><input type="radio" name={name} checked={value === "VALUE"} onChange={() => onChange("VALUE")} />Efter markedsværdi</label>
        <label><input type="radio" name={name} checked={value === "EQUAL"} onChange={() => onChange("EQUAL")} />Lige meget pr. kort</label>
      </div>
      <span className="hint">
        {value === "VALUE"
          ? "Et kort til 20 € bærer 100 gange så meget af prisen som et kort til 0,20 €. Det giver retvisende avance pr. kort."
          : "Alle kort får samme kostpris. Enkelt, men dyre kort ser for billige ud og bulk for dyrt."}
      </span>
    </div>
  );
}

export default function NewPurchaseForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [total, setTotal] = useState("");
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<"VALUE" | "EQUAL">("VALUE");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/purchases", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, totalCost: total, purchasedAt: day, method }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg(j.error);
    router.push(`/purchases/${j.id}`);
  }

  return (
    <div className="panel">
      <div className="grid-form" style={{ marginTop: 0 }}>
        <label className="field">Navn<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fx Samling fra DBA, Peter" /></label>
        <label className="field">Betalt i alt (EUR)<input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="Inkl. fragt" /></label>
        <label className="field">Købt den<input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
      </div>
      <div style={{ marginTop: 14 }}><MethodChoice name="new-method" value={method} onChange={setMethod} /></div>
      <div className="row" style={{ marginTop: 16 }}>
        <button disabled={busy || !total} onClick={save}>Opret indkøb</button>
        {msg && <span className="err">{msg}</span>}
      </div>
    </div>
  );
}
