// Ventana de análisis a partir del periodo elegido. Copia de informes/scripts/periodo.py.
import { BF_LEGADO } from "./constantes";
import { MESES, divPiso, difDias, finDeMes, min, suma, type Fecha } from "./fechas";

export type Temporada = "2025" | "2026";
export type Ventana = {
  legacy: boolean;
  period: string;
  D0: Record<Temporada, Fecha>;
  WMIN: number;
  WMAX: number;
  TODAY: Fecha;
  meses: string;
  titulo: string;
  slug: string;
  base: [number, number];
  bf: Record<Temporada, number | null>;
  ig_stop: Fecha;
  meta_from: Fecha;
  meta_to: Fecha;
  trend: Record<Temporada, [Fecha, Fecha]>;
  month_start: Fecha | null;
  month_end: Fecha | null;
  start: Record<Temporada, Fecha>;
  end: Record<Temporada, Fecha>;
  wl: Record<number, string>;
};

const SLUG3 = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function lista(m1: number, m2: number): string {
  const ns: string[] = [];
  for (let m = m1; m <= m2; m++) ns.push(MESES[m - 1]!);
  return ns.length === 1 ? ns[0]! : `${ns.slice(0, -1).join(", ")} y ${ns[ns.length - 1]}`;
}

export function ventana(period: string, today: Fecha): Ventana {
  let v: Omit<Ventana, "start" | "end" | "wl">;
  if (!period || period === "oct-nov-2026") {
    v = {
      legacy: true,
      period: "oct-nov-2026",
      D0: { ...BF_LEGADO },
      WMIN: -9,
      WMAX: 0,
      TODAY: "2026-11-24",
      meses: "octubre y noviembre",
      titulo: "octubre y noviembre 2026",
      slug: "Oct-Nov-2026",
      base: [-16, -10],
      bf: { "2025": 0, "2026": 0 },
      ig_stop: "2025-09-26",
      meta_from: "2026-09-25",
      meta_to: "2026-11-24",
      trend: { "2025": ["2025-06-16", "2025-12-15"], "2026": ["2026-06-15", "2026-11-24"] },
      month_start: null,
      month_end: null,
    };
  } else {
    const m = /^(\d{4})-(\d{2})_(\d{4})-(\d{2})$/.exec(period);
    if (!m) throw new Error(`Periodo no válido: ${period}`);
    const y1 = +m[1]!,
      m1 = +m[2]!,
      y2 = +m[3]!,
      m2 = +m[4]!;
    if (y1 !== 2026 || y2 !== 2026 || !(1 <= m1 && m1 <= m2 && m2 <= 12) || m2 - m1 > 2)
      throw new Error(`Periodo fuera de rango: ${period}`);
    const start = `${y1}-${String(m1).padStart(2, "0")}-01`;
    const end = finDeMes(y2, m2);
    if (start > today) throw new Error("El periodo elegido todavía no empieza.");
    const nw = Math.ceil((difDias(end, start) + 1) / 7);
    const d0 = suma(start, 7 * (nw - 1));
    const WMIN = -(nw - 1);
    const D0: Record<Temporada, Fecha> = { "2026": d0, "2025": suma(d0, -364) };
    const bf = {} as Record<Temporada, number | null>;
    for (const y of ["2025", "2026"] as Temporada[]) {
      const w = divPiso(difDias(BF_LEGADO[y], D0[y]), 7);
      bf[y] = WMIN <= w && w <= 0 ? w : null;
    }
    const base: [number, number] = [WMIN - 7, WMIN - 1];
    const tr = (y: Temporada): [Fecha, Fecha] => [
      suma(D0[y], 7 * base[0] - 7),
      min(suma(D0[y], 6), today),
    ];
    const n = m2 - m1 + 1;
    const slug =
      n <= 2
        ? Array.from({ length: n }, (_, i) => SLUG3[m1 - 1 + i]).join("-")
        : `${SLUG3[m1 - 1]}-${SLUG3[m2 - 1]}`;
    v = {
      legacy: false,
      period,
      D0,
      WMIN,
      WMAX: 0,
      TODAY: today,
      meses: lista(m1, m2),
      titulo: `${lista(m1, m2)} ${y2}`,
      slug: `${slug}-${y2}`,
      base,
      bf,
      ig_stop: suma(D0["2025"], 7 * WMIN),
      meta_from: suma(D0["2026"], 7 * WMIN),
      meta_to: today,
      trend: { "2025": tr("2025"), "2026": tr("2026") },
      month_start: start,
      month_end: end,
    };
  }
  const startW = { "2025": suma(v.D0["2025"], 7 * v.WMIN), "2026": suma(v.D0["2026"], 7 * v.WMIN) };
  let endW = {
    "2025": suma(v.D0["2025"], 6 + 7 * v.WMAX),
    "2026": suma(v.D0["2026"], 6 + 7 * v.WMAX),
  };
  if (!v.legacy && v.month_end)
    endW = {
      "2026": min(endW["2026"], v.month_end),
      "2025": min(endW["2025"], suma(v.month_end, -364)),
    };
  const full: Ventana = { ...v, start: startW, end: endW, wl: {} };
  for (let w = full.WMIN; w <= full.WMAX; w++) full.wl[w] = etiqueta(full, w);
  return full;
}

export function etiqueta(
  v: Pick<Ventana, "bf" | "legacy" | "WMIN">,
  w: number,
  y: Temporada = "2026",
): string {
  if (v.bf[y] === w) return "BF";
  return v.legacy ? `S${w}` : `S${w - v.WMIN + 1}`;
}
