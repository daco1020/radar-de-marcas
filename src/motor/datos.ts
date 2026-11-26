/* eslint-disable @typescript-eslint/no-explicit-any */
// Descarga de datos en pasos cortos y reanudables (cada llamada al motor hace unos pocos).
// Equivale a pull_brand.sh, metapager2.py, igpager3.py, ttsearch2.py, shopfetch2.py, vtexfetch.py y los pasos de run_job.py.
import type { Almacen } from "./almacen";
import { pyRound } from "./formato";
import { deTimestamp, divPiso, difDias, type Fecha } from "./fechas";
import type { Temporada, Ventana } from "./periodo";
import { treg as tregHttp } from "./treg";

export type Ctx = {
  A: Almacen;
  token: string;
  PER: Ventana;
  today: Fecha;
  cfg: {
    key: string;
    name: string;
    domain: string;
    page: string;
    ig: string;
    tt: string;
    q: string[];
    catalog_note?: string;
  };
  /** estado persistente del trabajo (cursores, contadores) */
  st: any;
  /** suma el costo (micro-dólares) de cada llamada */
  gasto: (micro: number) => void;
  /** para pruebas: otra forma de llamar a treg (por ejemplo, el CLI) */
  llamar?: typeof tregHttp;
};
const UA = {
  "User-Agent": "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/131 Safari/537.36",
  Accept: "application/json",
};

async function guardar(c: Ctx, nombre: string, ll: { body: any; status: number; micro: number }) {
  await c.A.escribir(`raw/${nombre}.json`, {
    result: ll.body,
    _treg: { http_status: ll.status, charged_micro: ll.micro },
  });
  c.gasto(ll.micro);
}

/** Un paso de descarga; devuelve true cuando la sub-tarea terminó. */
export const PASOS_DATOS: Record<string, (c: Ctx) => Promise<boolean>> = {
  // Anuncios activos de Meta en Colombia, página por página (hasta 29).
  async meta(c) {
    const s = (c.st.meta ??= { i: 1, cur: null, seen: [] as string[], ads: 0, fin: false });
    const body: any = {
      pageId: c.cfg.page,
      country: "CO",
      startDate: c.PER.meta_from,
      endDate: c.PER.meta_to,
      sortBy: "recent",
    };
    if (s.cur) body.cursor = s.cur;
    const ll = await (c.llamar ?? tregHttp)(c.token, "anyapi.facebook.company_ads", {
      body,
      timeoutMs: 45_000,
    });
    await guardar(c, `m_ads26_p${s.i}`, ll);
    const d = ll.body?.output?.data;
    const prev: any[] = (await c.A.leer("data/meta_ads_26.json")) ?? [];
    if (!d) {
      await c.A.escribir("data/meta_ads_26.json", prev);
      return true;
    }
    const nuevos = (d.ads ?? []).filter((a: any) => !s.seen.includes(a.id));
    for (const a of d.ads ?? []) if (!s.seen.includes(a.id)) s.seen.push(a.id);
    await c.A.escribir("data/meta_ads_26.json", [...prev, ...nuevos]);
    s.cur = d.nextCursor ?? null;
    s.i++;
    return (s.i > 2 && !nuevos.length) || !s.cur || !(d.ads ?? []).length || s.i > 29;
  },
  async google(c) {
    await guardar(
      c,
      "g_transp",
      await (c.llamar ?? tregHttp)(c.token, "adyntel.google.ads.transparency", {
        body: { company_domain: c.cfg.domain },
        timeoutMs: 60_000,
      }),
    );
    return true;
  },
  async tiktokAds(c) {
    const ll = await (c.llamar ?? tregHttp)(c.token, "adyntel.tiktok-ads.library.search.company", {
      body: { company_domain: c.cfg.domain, influencer_ads: true },
      timeoutMs: 60_000,
    });
    await guardar(c, "tt_ads", ll);
    if (ll.body?.handle) c.cfg.tt = ll.body.handle;
    return true;
  },
  // 6 búsquedas en TikTok (las 3 primeras con una segunda página).
  async tiktok(c) {
    const s = (c.st.tt ??= { i: 0, segunda: false });
    const q = c.cfg.q[s.i];
    if (q == null) return true;
    const n = `tt_s${String(s.i).padStart(2, "0")}`;
    const query: Record<string, string> = { query: q, date_posted: "last-3-months", region: "CO" };
    if (!s.segunda) {
      const ll = await (c.llamar ?? tregHttp)(c.token, "scrapecreators.tiktok.search.videos", {
        query,
      });
      await guardar(c, n, ll);
      const cur = ll.body?.cursor;
      if (s.i < 3 && cur) {
        s.segunda = String(cur);
        return false;
      }
    } else {
      await guardar(
        c,
        n + "b",
        await (c.llamar ?? tregHttp)(c.token, "scrapecreators.tiktok.search.videos", {
          query: { ...query, cursor: String(s.segunda) },
        }),
      );
      s.segunda = false;
    }
    s.i++;
    return s.i >= c.cfg.q.length;
  },
  // Instagram de la marca, hacia atrás hasta el inicio de la ventana del año anterior (máximo 110 páginas).
  async instagram(c) {
    const s = (c.st.ig ??= { i: 1, cur: null });
    const query: Record<string, string> = { handle: c.cfg.ig };
    if (s.cur) query["next_max_id"] = s.cur;
    const ll = await (c.llamar ?? tregHttp)(c.token, "scrapecreators.instagram.user.posts", {
      query,
    });
    await guardar(c, `ig_${c.cfg.ig}_${s.i}`, ll);
    const d = ll.body ?? {};
    const items: any[] = d.items ?? [];
    const prev: any[] = (await c.A.leer(`data/ig_${c.cfg.ig}_raw.json`)) ?? [];
    await c.A.escribir(`data/ig_${c.cfg.ig}_raw.json`, [...prev, ...items]);
    s.cur = d.more_available ? (d.next_max_id ?? null) : null;
    s.i++;
    if (!items.length) return true;
    const oldest = items.map((x) => deTimestamp(x.taken_at ?? 0)).sort()[0]!;
    return !s.cur || oldest < c.PER.ig_stop || s.i > 110;
  },
  // Catálogo público: Shopify (/products.json) o VTEX (API de búsqueda), sin costo.
  async catalogo(c) {
    const s = (c.st.cat ??= {
      tipo: null as null | "shopify" | "vtex" | "no",
      page: 1,
      from: 0,
      host: "",
    });
    const get = async (url: string) => {
      try {
        const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20_000) });
        if (!r.ok) return null;
        const t = await r.text();
        if (t.startsWith("<") || t.startsWith("local_rate")) return null;
        return JSON.parse(t);
      } catch {
        return null;
      }
    };
    if (!s.tipo) {
      if ((await get(`https://${c.cfg.domain}/products.json?limit=1`))?.products)
        s.tipo = "shopify";
      else
        for (const host of [`www.${c.cfg.domain}`, c.cfg.domain]) {
          const d = await get(
            `https://${host}/api/catalog_system/pub/products/search?_from=0&_to=0`,
          );
          if (Array.isArray(d) && d.length) {
            s.tipo = "vtex";
            s.host = host;
            break;
          }
        }
      if (!s.tipo) {
        s.tipo = "no";
        c.cfg.catalog_note = "sin catálogo público legible (la tienda no usa Shopify ni VTEX)";
        return true;
      }
      return false;
    }
    if (s.tipo === "shopify") {
      const d = await get(`https://${c.cfg.domain}/products.json?limit=250&page=${s.page}`);
      const prev: any[] = (await c.A.leer("raw/all.json")) ?? [];
      const ps: any[] = d?.products ?? [];
      await c.A.escribir("raw/all.json", [...prev, ...ps]);
      s.page++;
      if (!d || ps.length < 250 || s.page > 11) {
        c.cfg.catalog_note = "los productos disponibles del catálogo público (tienda Shopify)";
        return true;
      }
      return false;
    }
    // VTEX: 50 por página, hasta 2.500
    const d = await get(
      `https://${s.host}/api/catalog_system/pub/products/search?_from=${s.from}&_to=${s.from + 49}`,
    );
    const prev: any[] = (await c.A.leer("data/catalog.json")) ?? [];
    const ids = new Set(prev.map((p) => p.id));
    for (const p of Array.isArray(d) ? d : []) {
      if (ids.has(p.productId)) continue;
      ids.add(p.productId);
      const items = p.items ?? [];
      const offers = items.flatMap((it: any) =>
        (it.sellers ?? [])
          .slice(0, 1)
          .map((se: any) => [
            se.commertialOffer?.Price,
            se.commertialOffer?.ListPrice,
            se.commertialOffer?.AvailableQuantity ?? 0,
          ]),
      );
      prev.push({
        id: p.productId,
        name: p.productName,
        link: p.link,
        release: String(p.releaseDate ?? "").slice(0, 10),
        categories: (p.categories ?? [""])[0],
        clusters: Object.values(p.productClusters ?? {}),
        price: Math.min(
          ...(offers.map((o: any) => o[0]).filter(Boolean).length
            ? offers.map((o: any) => o[0]).filter(Boolean)
            : [0]),
        ),
        list: Math.max(
          ...(offers.map((o: any) => o[1]).filter(Boolean).length
            ? offers.map((o: any) => o[1]).filter(Boolean)
            : [0]),
        ),
        n_var: offers.length,
        avail: offers.filter((o: any) => (o[2] || 0) > 0).length,
        img: items.length ? (((items[0].images ?? [{}])[0] ?? {}).imageUrl ?? "") : "",
      });
    }
    await c.A.escribir("data/catalog.json", prev);
    s.from += 50;
    if (!Array.isArray(d) || d.length < 50 || s.from >= 2500) {
      c.cfg.catalog_note =
        `los ${prev.length.toLocaleString("es-CO").replace(/,/g, ".")} productos del catálogo público` +
        (prev.length >= 2500 ? " (el tope de la consulta)" : "");
      return true;
    }
    return false;
  },
  // Búsquedas semanales de la marca en Colombia (Google Trends vía DataForSEO), dos temporadas.
  async busquedas(c) {
    const s = (c.st.sr ??= { y: 0, rows: [] as any[] });
    const y = (["2025", "2026"] as Temporada[])[s.y]!;
    const [f, t] = c.PER.trend[y];
    const ll = await (c.llamar ?? tregHttp)(
      c.token,
      "dataforseo.x.keywords-data-dataforseo-trends-explore-live",
      {
        body: [
          {
            keywords: [c.cfg.name.toLowerCase()],
            location_code: 2170,
            date_from: f,
            date_to: t,
            type: "web",
          },
        ],
        timeoutMs: 60_000,
      },
    );
    await guardar(c, `trend_${y}`, ll);
    try {
      const g = ll.body.tasks[0].result[0].items[0].data as any[];
      const pts = g.map(
        (p) =>
          [
            divPiso(difDias(p.date_from, c.PER.D0[y]), 7),
            p.values[0],
            p.date_from,
            p.missing_data,
          ] as const,
      );
      const base = pts
        .filter(([w, v]) => c.PER.base[0] <= w && w <= c.PER.base[1] && v != null)
        .map(([, v]) => v as number);
      const b = base.length ? base.reduce((a, v) => a + v, 0) / base.length : 0;
      for (const [w, v, d, m] of pts)
        if (c.PER.WMIN <= w && w <= 0)
          s.rows.push({
            season: y,
            brand: c.cfg.key,
            week: w,
            week_start: d,
            idx: v,
            x_baseline: v != null && b ? pyRound(v / b, 2) : "",
            partial: !!m,
            base: pyRound(b, 1),
          });
    } catch {
      /* sin datos de búsquedas para esa temporada */
    }
    s.y++;
    if (s.y < 2) return false;
    await c.A.escribir("data/search_weekly.json", s.rows);
    return true;
  },
  // Portada de la web (solo si hoy cae dentro de los meses del informe).
  async web(c) {
    const moves: any[] = (await c.A.leer("data/moves_extra.json")) ?? [];
    if (
      c.PER.start["2026"] <= c.today &&
      c.today <= c.PER.end["2026"] &&
      !moves.some((m) => m.auto)
    ) {
      const ll = await (c.llamar ?? tregHttp)(c.token, "treg.web.extract", {
        body: { url: `https://www.${c.cfg.domain}/` },
        headers: { "X-Treg-Route-Prefer": "tinyfish", "X-Treg-Route-Max-Cost": "0.01" },
        timeoutMs: 45_000,
      });
      await guardar(c, "x_home", ll);
      const pg = ((ll.body?.output ?? {}).pages ?? [{}])[0] ?? {};
      const title = String(pg.title ?? "").trim(),
        desc = String(pg.description ?? "").trim();
      if (title)
        moves.push({
          date: c.today,
          season: "2026",
          channel: "Site & offers",
          move:
            `La web abre con: «${title.slice(0, 90)}»` + (desc ? ` — ${desc.slice(0, 120)}` : ""),
          auto: true,
        });
    }
    await c.A.escribir("data/moves_extra.json", moves);
    return true;
  },
};
