import { describe, expect, it } from "vitest";
import { cop, limpiarDominio } from "./format";

describe("formato", () => {
  it("dinero en pesos con punto de miles", () => {
    expect(cop(392)).toBe("COP 392");
    expect(cop(1234567)).toBe("COP 1.234.567");
    expect(cop(null)).toBe("—");
  });
  it("quita https:// y www.", () => {
    expect(limpiarDominio("https://www.koaj.co/")).toBe("koaj.co");
  });
});
