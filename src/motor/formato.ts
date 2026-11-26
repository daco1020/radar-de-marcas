// Formatos de número y dinero idénticos a los de los scripts de Python.
import { COP_POR_USD } from "./constantes";
import { MES3, type Fecha } from "./fechas";

/** f"{int(x):,}".replace(',', '.') */
export function n(x: number | string | null | undefined): string {
  const v = Math.trunc(Number(x ?? 0));
  return String(Math.abs(v))
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    .replace(/^/, v < 0 ? "-" : "");
}
/** f"{v:.1f}×" con coma */
export function xf(v: number | null | undefined): string {
  return v == null ? "—" : `${v.toFixed(1).replace(".", ",")}×`;
}
export function pct(x: number): string {
  return 0.99 < x && x < 1 ? `${(x * 100).toFixed(1).replace(".", ",")}%` : `${pyRound(x * 100)}%`;
}
/** fecha corta '27 nov' desde 'YYYY-MM-DD' */
export function fecha(d: Fecha): string {
  const [, m, dd] = d.split("-").map(Number);
  return `${dd} ${MES3[m! - 1]}`;
}
/** Valor en USD de las tarifas → texto en pesos (igual que cop() de narr_auto.py). */
export function cop(x: number): string {
  const v = x * COP_POR_USD;
  if (v >= 1e7) return `COP ${(v / 1e6).toFixed(0)} millones`;
  if (v >= 1e6) return `COP ${(v / 1e6).toFixed(1).replace(".", ",")} millones`;
  return `COP ${n(pyRound(v / 1000) * 1000)}`;
}
export function copr(lo: number, hi: number): string {
  return `${cop(lo)} a ${cop(hi)}`;
}
export const ws = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ");
export function cita(t: string | null | undefined, k = 120): string {
  const s = ws(t).trim();
  return s ? "«" + (largo(s) > k ? corte(s, k).trimEnd() + "…" : s) + "»" : "";
}
/** Counter.most_common(): por cantidad, empates en orden de aparición. */
export function masComunes<T>(xs: T[]): [T, number][] {
  const c = new Map<T, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]);
}

/** round() de Python (redondeo bancario a n decimales). */
export function pyRound(x: number, n = 0): number {
  const k = 10 ** n,
    v = x * k,
    t = Math.trunc(v);
  const r = Math.abs(v - t) === 0.5 ? (t % 2 === 0 ? t : t + Math.sign(v)) : Math.round(v);
  return r / k;
}
/** s[:k] de Python: corta por caracteres (un emoji cuenta 1), no por unidades UTF-16. */
export function corte(s: string | null | undefined, k: number): string {
  const a = Array.from(s ?? "");
  return a.length <= k ? (s ?? "") : a.slice(0, k).join("");
}
export function largo(s: string | null | undefined): number {
  return Array.from(s ?? "").length;
}
