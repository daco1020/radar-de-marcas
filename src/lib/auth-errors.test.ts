import { describe, expect, it } from "vitest";
import { mensajeAuth } from "./auth-errors";

describe("mensajeAuth", () => {
  it("traduce la contraseña débil por código y por texto", () => {
    expect(mensajeAuth({ code: "weak_password", message: "x" })).toMatch(/filtraciones públicas/);
    expect(
      mensajeAuth({
        message: "Password is known to be weak and easy to guess, please choose a different one.",
      }),
    ).toMatch(/filtraciones públicas/);
  });

  it("conserva el largo mínimo", () => {
    expect(mensajeAuth({ message: "Password should be at least 8 characters." })).toBe(
      "La contraseña debe tener al menos 8 caracteres.",
    );
  });

  it("nunca devuelve el texto en inglés", () => {
    expect(mensajeAuth({ message: "Something unexpected" })).toBe(
      "No se pudo completar. Intenta de nuevo.",
    );
    expect(mensajeAuth(null, "Correo o contraseña incorrectos.")).toBe(
      "Correo o contraseña incorrectos.",
    );
  });
});
