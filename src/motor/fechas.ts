// Fechas como texto 'YYYY-MM-DD' (UTC) y días desde 1970, igual que datetime.date en Python.
export const MES3 = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];
export const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const DIA = 86_400_000;
export type Fecha = string; // 'YYYY-MM-DD'

export function dias(f: Fecha): number {
  const [y, m, d] = f.split("-").map(Number);
  return Math.round(Date.UTC(y!, m! - 1, d!) / DIA);
}
export function fecha(n: number): Fecha {
  return new Date(n * DIA).toISOString().slice(0, 10);
}
export function suma(f: Fecha, n: number): Fecha {
  return fecha(dias(f) + n);
}
export function difDias(a: Fecha, b: Fecha): number {
  return dias(a) - dias(b);
}
export function min(a: Fecha, b: Fecha): Fecha {
  return a < b ? a : b;
}
export function max(a: Fecha, b: Fecha): Fecha {
  return a > b ? a : b;
}
/** datetime.utcfromtimestamp(t).date() */
export function deTimestamp(t: number): Fecha {
  return new Date((t || 0) * 1000).toISOString().slice(0, 10);
}
export function hoy(): Fecha {
  return new Date().toISOString().slice(0, 10);
}
export function finDeMes(y: number, m: number): Fecha {
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
export function corta(f: Fecha): string {
  const [, m, d] = f.split("-").map(Number);
  return `${d} ${MES3[m! - 1]}`;
}
export function larga(f: Fecha): string {
  return `${corta(f)} ${f.slice(0, 4)}`;
}
/** Python floor division para negativos. */
export function divPiso(a: number, b: number): number {
  return Math.floor(a / b);
}
