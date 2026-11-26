// Periodos de los informes: "YYYY-MM_YYYY-MM" (de 1 a 3 meses de 2026).
// "oct-nov-2026" es el formato original y se sigue mostrando en el historial.
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
export const MESES_CORTOS = [
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
export const ANIO = 2026;
export const MAX_MESES = 3;
export const PERIODO_LEGADO = "oct-nov-2026";

/** Último mes que se puede elegir (1-12): el mes en curso, si estamos en 2026. */
export function ultimoMes(hoy: Date = new Date()): number {
  if (hoy.getFullYear() < ANIO) return 0;
  if (hoy.getFullYear() > ANIO) return 12;
  return hoy.getMonth() + 1;
}

export function aPeriodo(desde: number, hasta: number): string {
  const p = (m: number) => String(m).padStart(2, "0");
  return `${ANIO}-${p(desde)}_${ANIO}-${p(hasta)}`;
}

export function leerPeriodo(
  periodo: string | null | undefined,
): { desde: number; hasta: number } | null {
  if (!periodo) return null;
  if (periodo === PERIODO_LEGADO) return { desde: 10, hasta: 11 };
  const m = /^(\d{4})-(\d{2})_(\d{4})-(\d{2})$/.exec(periodo);
  if (!m) return null;
  const desde = Number(m[2]),
    hasta = Number(m[4]);
  if (desde < 1 || hasta > 12 || hasta < desde) return null;
  return { desde, hasta };
}

export function periodoValido(periodo: string, hoy: Date = new Date()): boolean {
  if (periodo === PERIODO_LEGADO) return true;
  const r = leerPeriodo(periodo);
  return !!r && r.hasta - r.desde < MAX_MESES && r.desde <= ultimoMes(hoy);
}

function lista(nombres: string[]): string {
  if (nombres.length === 1) return nombres[0]!;
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

function mayus(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** "Octubre y noviembre 2026" */
export function nombrePeriodo(periodo: string | null | undefined): string {
  const r = leerPeriodo(periodo);
  if (!r) return periodo ?? "—";
  const ns = [];
  for (let m = r.desde; m <= r.hasta; m++) ns.push(MESES[m - 1]!);
  return `${mayus(lista(ns))} ${ANIO}`;
}

/** "oct–nov 2026" */
export function nombreCorto(periodo: string | null | undefined): string {
  const r = leerPeriodo(periodo);
  if (!r) return periodo ?? "—";
  return r.desde === r.hasta
    ? `${MESES_CORTOS[r.desde - 1]} ${ANIO}`
    : `${MESES_CORTOS[r.desde - 1]}–${MESES_CORTOS[r.hasta - 1]} ${ANIO}`;
}

/** Atajos: los últimos n meses que ya se pueden elegir. */
export function ultimosMeses(n: number, hoy: Date = new Date()): string | null {
  const hasta = ultimoMes(hoy);
  if (hasta < 1) return null;
  return aPeriodo(Math.max(1, hasta - n + 1), hasta);
}

export function incluyeMesActual(periodo: string, hoy: Date = new Date()): boolean {
  const r = leerPeriodo(periodo);
  return !!r && hoy.getFullYear() === ANIO && r.hasta >= hoy.getMonth() + 1;
}
