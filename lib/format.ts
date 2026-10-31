// Formatting helpers, safe for both server and client components.
const eurFmt = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });
const intFmt = new Intl.NumberFormat("en-GB");
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const eur = (n: number | null | undefined) => (n == null ? "–" : eurFmt.format(n));
export const int = (n: number) => intFmt.format(n);
export const date = (d: Date | string) => dateFmt.format(new Date(d));
export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const cards = (n: number) => `${int(n)} ${n === 1 ? "card" : "cards"}`;

export const STATUS_LABEL: Record<string, string> = {
  IN_STOCK: "In stock",
  LISTED: "Listed",
  SOLD: "Sold",
  REMOVED: "Removed",
};

export const METHOD_LABEL: Record<string, string> = {
  VALUE: "By market value",
  EQUAL: "Equal per card",
};
