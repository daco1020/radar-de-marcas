/* eslint-disable @typescript-eslint/no-explicit-any */
// Elige las imágenes que usa el informe y las baja. Copia de informes/scripts/fetch_images.py.
import type { Fecha } from "./fechas";

/** Baja `url` y la guarda con `nombre`; devuelve false si no se pudo. Debe ser idempotente (si ya está, true). */
export type Bajar = (url: string, nombre: string) => Promise<boolean>;

async function primeras(
  rows: any[],
  k: number,
  ident: string,
  url: string,
  nombre: (r: any) => string,
  dl: Bajar,
): Promise<any[]> {
  const out: any[] = [];
  for (const r of rows) {
    if (out.length >= k) break;
    if (r[url] && (await dl(r[url], nombre(r)))) out.push(r[ident]);
  }
  return out;
}
const porVistas = (rows: any[]) => [...rows].sort((a, b) => (+b.views || 0) - (+a.views || 0));

export async function elegirImagenes(
  d: {
    ads: any[];
    tta: any[];
    ig: any[];
    tt: any[];
    cat: any[] | null;
    W26: [Fecha, Fecha];
    W25: [Fecha, Fecha];
  },
  dl: Bajar,
) {
  const { W26, W25 } = d;
  const picks: any = {};
  const order: Record<string, number> = { holiday: 0, offer: 1, launch: 2, brand: 3 };
  const ads = d.ads.filter((a) => a.start <= W26[1]);
  picks.ads = await primeras(
    [...ads].sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9)),
    12,
    "id",
    "img",
    (a) => `img/ad_${a.id}.jpg`,
    dl,
  );
  picks.tt_ads = await primeras(
    [...d.tta].sort((a, b) => +b.views - +a.views),
    4,
    "id",
    "thumb",
    (r) => `img/ttad_${r.id}.jpg`,
    dl,
  );
  const ig26 = porVistas(d.ig.filter((r) => W26[0] <= r.date && r.date <= W26[1]));
  picks.ig_top = await primeras(
    ig26.filter((r) => !r.coauthors),
    4,
    "code",
    "cover",
    (r) => `img/ig_${r.code}.jpg`,
    dl,
  );
  picks.ig_collab = await primeras(
    ig26.filter((r) => r.coauthors || r.paid === true || r.paid === "True"),
    4,
    "code",
    "cover",
    (r) => `img/ig_${r.code}.jpg`,
    dl,
  );
  const hol = d.ig.filter(
    (r) =>
      (r.tag === "holiday" || r.tag === "offer") &&
      ((W25[0] <= r.date && r.date <= W25[1]) || (W26[0] <= r.date && r.date <= W26[1])),
  );
  picks.ig_holiday = await primeras(
    porVistas(hol),
    4,
    "code",
    "cover",
    (r) => `img/ig_${r.code}.jpg`,
    dl,
  );
  picks.tt_others = await primeras(
    porVistas(d.tt.filter((r) => r.kind !== "owned")),
    6,
    "id",
    "cover",
    (r) => `img/tt_${r.id}.jpg`,
    dl,
  );
  picks.tt_owned = await primeras(
    porVistas(d.tt.filter((r) => r.kind === "owned")),
    4,
    "id",
    "cover",
    (r) => `img/tt_${r.id}.jpg`,
    dl,
  );
  const cat = d.cat ?? [];
  const deep = cat
    .filter((c) => c.list && c.price < c.list)
    .sort((a, b) => a.price / a.list - b.price / b.list);
  const rel = (c: any) => c.release || "";
  const full = cat
    .filter((c) => !(c.list && c.price < c.list * 0.995))
    .sort((a, b) => (rel(b) < rel(a) ? -1 : rel(b) > rel(a) ? 1 : 0));
  const newest = [...cat].sort((a, b) => (rel(b) < rel(a) ? -1 : rel(b) > rel(a) ? 1 : 0));
  const sel: any[] = [];
  for (const c of [...deep.slice(0, 3), ...(full.length ? full.slice(0, 3) : newest.slice(0, 3))]) {
    const nombre = `img/prod_${sel.length}.jpg`;
    if (c.img && (await dl(c.img, nombre))) sel.push({ ...c, file: nombre });
  }
  picks.products = sel;
  return picks;
}
