"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function MethodChoice({ value, onChange, name }: { value: string; onChange: (v: "VALUE" | "EQUAL") => void; name: string }) {
  return (
    <div className="field">
      Split the price
      <div className="seg" role="radiogroup">
        <label><input type="radio" name={name} checked={value === "VALUE"} onChange={() => onChange("VALUE")} />By market value</label>
        <label><input type="radio" name={name} checked={value === "EQUAL"} onChange={() => onChange("EQUAL")} />Equal per card</label>
      </div>
      <span className="hint">
        {value === "VALUE"
          ? "A €20 card carries 100 times as much of the price as a €0.20 card. This gives a true margin per card."
          : "Every card gets the same cost. Simple, but expensive cards look too cheap and bulk too expensive."}
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
        <label className="field">Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="E.g. Collection from DBA, Peter" /></label>
        <label className="field">Total paid (EUR)<input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="Incl. shipping" /></label>
        <label className="field">Purchase date<input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
      </div>
      <div style={{ marginTop: 14 }}><MethodChoice name="new-method" value={method} onChange={setMethod} /></div>
      <div className="row" style={{ marginTop: 16 }}>
        <button disabled={busy || !total} onClick={save}>Create purchase</button>
        {msg && <span className="err">{msg}</span>}
      </div>
    </div>
  );
}
