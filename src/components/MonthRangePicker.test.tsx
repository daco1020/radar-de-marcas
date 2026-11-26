import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { MonthRangePicker } from "./MonthRangePicker";

function Harness({ inicial = "2026-10_2026-11" }: { inicial?: string }) {
  const [p, setP] = useState(inicial);
  return (
    <>
      <MonthRangePicker value={p} onChange={setP} />
      <output data-testid="p">{p}</output>
    </>
  );
}
const mes = (n: string) => screen.getByRole("button", { name: new RegExp(`^${n} 2026`) });
const valor = () => screen.getByTestId("p").textContent;

describe("MonthRangePicker", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 26)); // 26 nov 2026
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("elige un rango con dos clics", () => {
    render(<Harness />);
    fireEvent.click(mes("marzo"));
    expect(valor()).toBe("2026-03_2026-03");
    fireEvent.click(mes("mayo"));
    expect(valor()).toBe("2026-03_2026-05");
  });

  it("recorta a 3 meses y acepta el orden inverso", () => {
    render(<Harness />);
    fireEvent.click(mes("enero"));
    fireEvent.click(mes("junio"));
    expect(valor()).toBe("2026-01_2026-03");
    fireEvent.click(mes("agosto"));
    fireEvent.click(mes("julio"));
    expect(valor()).toBe("2026-07_2026-08");
  });

  it("no deja elegir meses que no han empezado", () => {
    render(<Harness />);
    expect((mes("diciembre") as HTMLButtonElement).disabled).toBe(true);
    expect((mes("noviembre") as HTMLButtonElement).disabled).toBe(false);
  });

  it("los atajos eligen los últimos meses y avisa del mes en curso", () => {
    render(<Harness inicial="2026-03_2026-03" />);
    fireEvent.click(screen.getByRole("button", { name: "Últimos 3 meses" }));
    expect(valor()).toBe("2026-09_2026-11");
    expect(screen.getByText(/El mes en curso sale parcial/)).toBeTruthy();
  });
});
