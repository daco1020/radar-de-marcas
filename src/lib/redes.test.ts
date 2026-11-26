import { describe, expect, it } from "vitest";
import { enlaceFacebook, extraerRedes, ordenar, type Candidato } from "./redes";

const HTML = `
<a href="https://www.facebook.com/pandarojo.col">fb</a><a href="https://www.facebook.com/pandarojo.col">fb</a>
<a href="https://www.facebook.com/sharer/sharer.php?u=x">compartir</a>
<a href="https://www.instagram.com/pandarojo.col/">ig</a><a href="https://www.instagram.com/p/ABC123/">post</a>
<a href="https://www.tiktok.com/@pandarojo.col">tt</a>`;

describe("extraerRedes", () => {
  it("toma los perfiles y descarta botones de compartir y publicaciones", () => {
    expect(extraerRedes(HTML)).toEqual({
      facebook: "https://www.facebook.com/pandarojo.col",
      instagram: "pandarojo.col",
      tiktok: "pandarojo.col",
    });
  });
  it("devuelve null cuando la web no enlaza redes", () => {
    expect(extraerRedes("<html></html>")).toEqual({
      facebook: null,
      instagram: null,
      tiktok: null,
    });
  });
});

describe("enlaceFacebook", () => {
  it("acepta enlace o usuario", () => {
    expect(enlaceFacebook("https://web.facebook.com/pandarojo.col?ref=1")).toBe(
      "https://www.facebook.com/pandarojo.col",
    );
    expect(enlaceFacebook("pandarojo.col")).toBe("https://www.facebook.com/pandarojo.col");
    expect(enlaceFacebook("https://facebook.com/sharer")).toBeNull();
    expect(enlaceFacebook("hola mundo")).toBeNull();
  });
});

describe("ordenar", () => {
  const b = (id: string, ig: string | null, f: number) => ({
    page_id: id,
    name: id,
    category: null,
    ig_username: ig,
    ig_followers: f,
    likes: 0,
  });
  const web: Candidato = { ...b("W", "pandarojo.col", 0), origen: "web", coincide: true };
  it("pone primero la página de la web, luego las del mismo Instagram, sin repetir", () => {
    const r = ordenar(
      web,
      [b("A", "otra", 9000), b("W", "pandarojo.col", 10), b("C", "PandaRojo.col", 5)],
      "pandarojo.col",
    );
    expect(r.map((x) => x.page_id)).toEqual(["W", "C", "A"]);
    expect(r[1]!.coincide).toBe(true);
    expect(r[2]!.coincide).toBe(false);
  });
  it("sin web ordena por seguidores", () => {
    expect(ordenar(null, [b("A", null, 1), b("B", null, 5)], null).map((x) => x.page_id)).toEqual([
      "B",
      "A",
    ]);
  });
});
