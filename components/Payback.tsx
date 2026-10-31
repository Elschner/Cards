import { pct } from "@/lib/format";

/** How much of a lot's purchase price has come back as sales. Yellow once it's paid off. */
export default function Payback({ value }: { value: number }) {
  const w = Math.min(1, value) * 100;
  return (
    <div className="payback" title={`${pct(value)} of the purchase price has come back in sales`}>
      <div className="track"><div className={value >= 1 ? "fill over" : "fill"} style={{ width: `${w}%` }} /></div>
      <span className="pv">{pct(value)}</span>
    </div>
  );
}
