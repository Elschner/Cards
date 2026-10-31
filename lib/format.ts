// Danish formatting, safe for both server and client components.
const eurFmt = new Intl.NumberFormat("da-DK", { style: "currency", currency: "EUR" });
const intFmt = new Intl.NumberFormat("da-DK");
const dateFmt = new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric" });

export const eur = (n: number | null | undefined) => (n == null ? "–" : eurFmt.format(n));
export const int = (n: number) => intFmt.format(n);
export const date = (d: Date | string) => dateFmt.format(new Date(d));
export const pct = (x: number) => `${Math.round(x * 100)} %`;

export const STATUS_LABEL: Record<string, string> = {
  IN_STOCK: "På lager",
  LISTED: "Til salg",
  SOLD: "Solgt",
  REMOVED: "Fjernet",
};

export const METHOD_LABEL: Record<string, string> = {
  VALUE: "Efter markedsværdi",
  EQUAL: "Lige meget pr. kort",
};
