import { describe, expect, it } from "vitest";
import {
  aPeriodo,
  incluyeMesActual,
  leerPeriodo,
  nombreCorto,
  nombrePeriodo,
  periodoValido,
  ultimoMes,
  ultimosMeses,
} from "./periodo";

const HOY = new Date(2026, 10, 26); // 26 nov 2026

describe("periodo", () => {
  it("arma y lee periodos", () => {
    expect(aPeriodo(3, 5)).toBe("2026-03_2026-05");
    expect(leerPeriodo("2026-03_2026-05")).toEqual({ desde: 3, hasta: 5 });
    expect(leerPeriodo("oct-nov-2026")).toEqual({ desde: 10, hasta: 11 });
    expect(leerPeriodo("basura")).toBeNull();
  });

  it("nombra los meses en español", () => {
    expect(nombrePeriodo("2026-10_2026-11")).toBe("Octubre y noviembre 2026");
    expect(nombrePeriodo("2026-03_2026-05")).toBe("Marzo, abril y mayo 2026");
    expect(nombrePeriodo("2026-07_2026-07")).toBe("Julio 2026");
    expect(nombrePeriodo("oct-nov-2026")).toBe("Octubre y noviembre 2026");
    expect(nombreCorto("2026-03_2026-05")).toBe("mar–may 2026");
  });

  it("valida rango, máximo de meses y meses futuros", () => {
    expect(periodoValido("2026-03_2026-05", HOY)).toBe(true);
    expect(periodoValido("2026-03_2026-06", HOY)).toBe(false);
    expect(periodoValido("2026-12_2026-12", HOY)).toBe(false);
    expect(periodoValido("oct-nov-2026", HOY)).toBe(true);
  });

  it("atajos y mes en curso", () => {
    expect(ultimoMes(HOY)).toBe(11);
    expect(ultimosMeses(3, HOY)).toBe("2026-09_2026-11");
    expect(ultimosMeses(3, new Date(2026, 0, 10))).toBe("2026-01_2026-01");
    expect(incluyeMesActual("2026-10_2026-11", HOY)).toBe(true);
    expect(incluyeMesActual("2026-03_2026-05", HOY)).toBe(false);
  });
});
