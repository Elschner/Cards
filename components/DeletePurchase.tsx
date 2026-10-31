"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** Deletes the purchase only. Its cards stay in inventory, without a purchase or cost. */
export default function DeletePurchase({ id, cards }: { id: number; cards: number }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="row" style={{ marginTop: 12 }}>
      <button className="danger" onClick={async () => {
        const note = cards ? ` Its ${cards} cards stay in inventory without a cost. Delete them first on the Inventory page if they should go too.` : "";
        if (!confirm(`Delete this purchase?${note}`)) return;
        const res = await fetch(`/api/purchases/${id}`, { method: "DELETE" });
        if (!res.ok) return setErr((await res.json().catch(() => ({}))).error ?? "Could not delete");
        router.push("/purchases");
        router.refresh();
      }}>Delete purchase</button>
      {err && <span className="err">{err}</span>}
    </div>
  );
}
