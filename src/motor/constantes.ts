import type { Fecha } from "./fechas";

export const BF_LEGADO: { "2025": Fecha; "2026": Fecha } = {
  "2025": "2025-11-28",
  "2026": "2026-11-27",
};

// Tarifas (estimaciones en USD por unidad, convertidas a pesos a 4.000 al mostrarlas). Igual que compute_generic.py.
export const RATE = { ad: [8, 23, 62] as const, owned: [150, 500, 1500] as const };
export const TIER: [number, [number, number, number]][] = [
  [10_000, [25, 75, 150]],
  [100_000, [125, 375, 750]],
  [500_000, [750, 1500, 2500]],
  [1_000_000, [2500, 4000, 6000]],
  [1e12, [5000, 10000, 25000]],
];
export function tierRate(fol: number | null | undefined): [number, number, number] {
  for (const [cap, r] of TIER) if ((fol ?? 0) < cap) return r;
  return TIER[TIER.length - 1]![1];
}
export const COP_POR_USD = 4000;
