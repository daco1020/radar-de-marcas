/* eslint-disable @typescript-eslint/no-explicit-any */
// Cálculo por marca: semanas, unidades, gasto estimado y métricas. Copia de informes/scripts/compute_generic.py.
import type { Almacen } from "./almacen";
import { AI_RESPUESTAS } from "./ai_respuestas";
import { RATE, tierRate } from "./constantes";
import { corte, pyRound } from "./formato";
export { pyRound };
import { deTimestamp, divPiso, difDias, min, max, suma, type Fecha } from "./fechas";
import type { Temporada, Ventana } from "./periodo";

export type Marca = {
  key: string;
  name: string;
  domain: string;
  ig: string;
  tt: string;
  name_rx?: string;
};

const HOL = /black ?(friday|days?|week|sale|month|fest)|viernes negro|cyber|bf ?20/i;
const OFF =
  /\d+ ?%|descuento|\bsale\b|promo|c[oó]digo|rebaja|2x1|3x2|lleva \d|off\b|precio especial|oferta/i;
const NEW = /nuev|new|colecci|lanz|drop|llegó|lleg[oa]ron|disponible/i;
export function tagText(t: string | null | undefined): string {
  t = t ?? "";
  return HOL.test(t) ? "holiday" : OFF.test(t) ? "offer" : NEW.test(t) ? "launch" : "brand";
}
const ws = (s: string) => s.replace(/\s+/g, " ");
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const med = (L: number[]) =>
  L.length ? [...L].sort((a, b) => a - b)[Math.floor(L.length / 2)]! : 0;
const KNOWN_RX: Record<string, string> = {
  stopjeans: "stop ?jeans|@?stopjeans",
  ela: "@?moda_?ela|\\bela\\b",
  sevenseven: "seven ?seven|@?sevenseven",
  rifle: "\\brifle\\b|@?rifleoficial",
  studiof: "studio ?f\\b|@?studiof",
};

export type Resultado = {
  metrics: any;
  meta_ads: any[];
  tiktok_ads: any[];
  tiktok_labeled: any[];
  ig_owned: any[];
  catalog_norm: any[] | null;
  timeline: any[];
  volume_weekly: any[];
  spend_weekly: any[];
};

export async function calcular(
  A: Almacen,
  CFG: Marca,
  PER: Ventana,
  searchRows: any[] | null,
): Promise<Resultado> {
  const TODAY = PER.TODAY,
    D0 = PER.D0,
    WMIN = PER.WMIN,
    WMAX = PER.WMAX;
  const wk = (d: Fecha, y: Temporada) => divPiso(difDias(d, D0[y]), 7);
  const season = (d: Fecha): Temporada | null => {
    for (const y of ["2025", "2026"] as Temporada[])
      if (WMIN <= wk(d, y) && wk(d, y) <= WMAX && d <= PER.end[y]) return y;
    return null;
  };
  const vol = new Map<string, { units: number; views: number }>();
  const spend = new Map<string, [number, number, number]>();
  const items = new Map<string, string[]>();
  const add = (
    y: Temporada | null,
    w: number,
    ch: string,
    units = 1,
    views = 0,
    item?: string,
    sp?: readonly number[],
    stype?: string,
  ) => {
    if (y == null || !(WMIN <= w && w <= WMAX)) return;
    const k = `${y}|${w}|${ch}`;
    const v = vol.get(k) ?? { units: 0, views: 0 };
    v.units += units;
    v.views += views;
    vol.set(k, v);
    if (item) items.set(k, [...(items.get(k) ?? []), item]);
    if (sp) {
      const sk = `${y}|${w}|${stype}`;
      const s = spend.get(sk) ?? [0, 0, 0];
      s[0] += sp[0]!;
      s[1] += sp[1]!;
      s[2] += sp[2]!;
      spend.set(sk, s);
    }
  };
  const diasPorSemana = (s0: Fecha, e1: Fecha) => {
    const c = new Map<number, number>();
    for (let i = 0; i <= difDias(e1, s0); i++) {
      const w = wk(suma(s0, i), "2026");
      c.set(w, (c.get(w) ?? 0) + 1);
    }
    return c;
  };

  // ---------- Meta ----------
  const ads: any[] = (await A.leer("data/meta_ads_26.json")) ?? [];
  let meta_total: number | null = null;
  const p1 = await A.leer("raw/m_ads26_p1.json");
  try {
    meta_total = p1?.result?.output?.data?.totalResults ?? null;
  } catch {
    /* sin total */
  }
  const rows: any[] = [];
  for (const a of ads) {
    const s: Fecha = a.startDate ? deTimestamp(a.startDate) : TODAY;
    const e: Fecha = min(a.endDate ? deTimestamp(a.endDate) : TODAY, TODAY);
    const txt = ws(
      a.text ||
        (a.creatives ?? [])
          .slice(0, 1)
          .map((c: any) => c.body ?? "")
          .join(" "),
    );
    const link = (a.linkUrl ?? "").replace(/\?.*/s, "");
    const kind = tagText(txt + " " + link);
    rows.push({
      id: a.id,
      start: s,
      end: e,
      format: a.displayFormat,
      platforms: (a.platforms ?? []).join("|"),
      kind,
      whatsapp: link.includes("whatsapp"),
      landing: link,
      text: corte(txt, 240),
      link: `https://www.facebook.com/ads/library/?id=${a.id}`,
      img: a.media ? ((a.media[0] ?? {}).url ?? "") : "",
    });
    const s0 = max(s, suma(D0["2026"], 7 * WMIN)),
      e1 = min(e, PER.end["2026"]);
    if (s0 > e1) continue;
    for (const [w, n] of diasPorSemana(s0, e1)) {
      const [lo, mid, hi] = RATE.ad;
      add(
        "2026",
        w,
        "Paid ads",
        1,
        0,
        `Meta ${a.displayFormat} · ${kind} · ${corte(txt, 60)}`,
        [lo * n, mid * n, hi * n],
        "Meta ads",
      );
    }
  }
  // ---------- TikTok anuncios ----------
  const tta: any[] = [];
  let tt_followers: number | null = null;
  const ttr = await A.leer("raw/tt_ads.json");
  try {
    const d = ttr.result;
    const adv = d.advertiser_data ?? {};
    for (const a of d.brand_ads ?? [])
      tta.push({
        id: a.aweme_id,
        date: deTimestamp(a.posted_at),
        views: a.stats.play_count,
        desc: corte((a.desc ?? "").replace(/\n/g, " "), 200),
        url: `https://www.tiktok.com/@${d.handle}/video/${a.aweme_id}`,
        thumb: a.thumbnail_url ?? "",
      });
    tt_followers = adv.follower_count ?? null;
  } catch {
    tt_followers = null;
  }
  for (const r of tta) {
    const s0 = max(r.date, suma(D0["2026"], 7 * WMIN)),
      e1 = min(TODAY, PER.end["2026"]);
    if (s0 > e1) continue;
    for (const [w, n] of diasPorSemana(s0, e1)) {
      const [lo, mid, hi] = RATE.ad;
      add(
        "2026",
        w,
        "Paid ads",
        1,
        0,
        `TikTok impulsado · ${corte(r.desc, 60)}`,
        [lo * n, mid * n, hi * n],
        "TikTok ads",
      );
    }
  }
  // ---------- Google ----------
  let gads: any[] = [];
  try {
    gads = (await A.leer("raw/g_transp.json"))?.result?.ads ?? [];
  } catch {
    gads = [];
  }
  for (const a of gads)
    for (const y of ["2025", "2026"] as Temporada[])
      for (let w = WMIN; w <= WMAX; w++) {
        const wsd = suma(D0[y], 7 * w),
          we = suma(wsd, 6);
        if (a.start <= we && a.last_seen >= wsd && wsd <= TODAY)
          add(y, w, "Paid ads", 1, 0, `Google ${a.format} creative (since ${a.start})`);
      }
  // ---------- TikTok búsquedas ----------
  const handle = (CFG.tt || CFG.ig).toLowerCase(),
    bname = CFG.name.toLowerCase();
  const nameRx = new RegExp(
    CFG.name_rx ||
      KNOWN_RX[CFG.key] ||
      "\\b" +
        reEsc(bname).replace(/ /g, " ?") +
        "\\b|@?" +
        reEsc(handle) +
        "|@?" +
        reEsc(CFG.ig.toLowerCase()),
    "i",
  );
  const fashion =
    /jean|ropa|outfit|look|blusa|pantal|vestid|tienda|haul|moda|prenda|camisa|chaqueta|falda|compr|black|descuento|colecci|estilo/i;
  const seen = new Map<string, any>();
  for (const p of await A.listar("raw/tt_s")) {
    try {
      for (const it of (await A.leer(p))?.result?.search_item_list ?? []) {
        const a = it.aweme_info ?? it;
        if (!seen.has(a.aweme_id)) seen.set(a.aweme_id, a);
      }
    } catch {
      /* archivo dañado */
    }
  }
  const tt: any[] = [];
  for (const [vid, a] of seen) {
    const au = a.author ?? {},
      desc: string = a.desc ?? "",
      st = a.statistics ?? {};
    const d = deTimestamp(a.create_time ?? 0),
      author = (au.unique_id ?? "").toLowerCase();
    if (a.region !== "CO" || season(d) !== "2026") continue;
    if (!nameRx.test(desc) && author !== handle) continue;
    if (author !== handle && !fashion.test(desc)) continue;
    const dl = desc.toLowerCase();
    const kind =
      author === handle || author.includes(handle)
        ? "owned"
        : /1\.1|aaa|r[eé]plica|mayorist|por mayor|alto gramaje/.test(dl)
          ? "replica_or_wholesale"
          : /env[ií]o|pedido|domicilio|📲|whatsapp|cat[aá]logo|contra ?entrega|\d{3} ?\d{3} ?\d{4}|disponible en nuestra/.test(
                dl,
              )
            ? "reseller"
            : a.branded_content_type ||
                /#(ad|publi|publicidad|partner|colab)|c[oó]digo/.test(dl) ||
                dl.includes("@" + handle) ||
                (au.follower_count ?? 0) >= 5000
              ? "creator"
              : "organic_mention";
    const r = {
      id: vid,
      date: d,
      author,
      followers: au.follower_count || 0,
      views: st.play_count || 0,
      kind,
      paid: !!(a.branded_content_type || /#(ad|publi|publicidad|partner)/.test(dl)),
      desc: corte(ws(desc), 220),
      cover: (((a.video ?? {}).cover ?? {}).url_list ?? [""])[0],
      url: `https://www.tiktok.com/@${author}/video/${vid}`,
    };
    tt.push(r);
    const w = wk(d, "2026");
    if (kind === "creator")
      add(
        "2026",
        w,
        "Social media collabs",
        1,
        r.views,
        `@${author} (${r.followers} seg.): ${corte(r.desc, 60)}`,
        r.paid ? tierRate(r.followers) : [25, 35, 60],
        r.paid ? "Paid collab posts" : "Gifted collab posts",
      );
    else if (kind === "owned")
      add(
        "2026",
        w,
        "Owned social",
        1,
        r.views,
        `TikTok: ${corte(r.desc, 60)}`,
        RATE.owned,
        "Making owned posts",
      );
    else if (kind === "reseller")
      add("2026", w, "Retail & prices", 1, r.views, `@${author}: ${corte(r.desc, 60)}`);
  }
  // ---------- Instagram propio ----------
  const P: any[] = (await A.leer(`data/ig_${CFG.ig}_raw.json`)) ?? [];
  const sp = new Map<string, any>();
  for (const p of P) {
    const k = String(p.code ?? p.pk);
    if (!sp.has(k)) sp.set(k, p);
  }
  const ig: any[] = [];
  for (const p of sp.values()) {
    const d = deTimestamp(p.taken_at);
    const cap: string =
      (p.caption && typeof p.caption === "object" ? p.caption.text : p.caption) || "";
    const views = p.play_count || p.ig_play_count || 0;
    const coauth = (p.coauthor_producers ?? [])
      .map((u: any) => u.username)
      .filter((u: string) => u !== CFG.ig);
    const tag = tagText(cap);
    const cover = (((p.image_versions2 ?? {}).candidates ?? [{}])[0] ?? {}).url ?? "";
    const r = {
      date: d,
      code: p.code,
      tag,
      views,
      likes: p.like_count || 0,
      comments: p.comment_count || 0,
      coauthors: coauth.join("|"),
      paid: !!p.is_paid_partnership,
      caption: corte(ws(cap), 260),
      url: `https://www.instagram.com/p/${p.code}/`,
      cover,
    };
    ig.push(r);
    const y = season(d);
    if (!y) continue;
    const c1 = corte(r.caption, 60);
    if (coauth.length || r.paid)
      add(
        y,
        wk(d, y),
        "Social media collabs",
        1,
        views,
        `IG con @${coauth.length ? coauth[0] : "creador"}: ${c1}`,
        [750, 1500, 2500],
        "Paid collab posts",
      );
    else
      add(
        y,
        wk(d, y),
        "Owned social",
        1,
        views,
        `IG ${tag}: ${c1}`,
        RATE.owned,
        "Making owned posts",
      );
  }
  ig.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const oldest_ig = ig.length ? ig[0].date : null;
  // ---------- catálogo ----------
  let cat: any[] | null = null;
  const vtex = await A.leer("data/catalog.json");
  if (vtex)
    cat = vtex.map((c: any) => ({
      name: c.name,
      price: c.price,
      list: c.list || c.price,
      avail: c.avail,
      n: c.n_var,
      release: c.release,
      link: c.link,
      img: c.img,
      clusters: c.clusters,
    }));
  else {
    const shop = await A.leer("raw/all.json");
    if (shop) {
      cat = [];
      for (const p of shop) {
        if (!p.variants.some((v: any) => v.available)) continue;
        const vs = p.variants;
        const pr = Math.min(...vs.map((v: any) => parseFloat(v.price)));
        const ca = Math.max(...vs.map((v: any) => parseFloat(v.compare_at_price || 0)));
        cat.push({
          name: p.title,
          price: pr,
          list: Math.max(ca, pr),
          avail: vs.filter((v: any) => v.available).length,
          n: vs.length,
          release: p.created_at.slice(0, 10),
          link: `https://${CFG.domain}/products/${p.handle}`,
          img: p.images?.length ? p.images[0].src : "",
          clusters: p.tags,
        });
      }
    }
  }
  // ---------- movimientos ----------
  const moves: any[] = [];
  const starts = new Map<string, number>();
  for (const r of rows) starts.set(r.start, (starts.get(r.start) ?? 0) + 1);
  const startsSorted = [...starts.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  for (const [d, n] of startsSorted) {
    if (n >= 5 && season(d) === "2026") {
      const kc = new Map<string, number>();
      for (const r of rows) if (r.start === d) kc.set(r.kind, (kc.get(r.kind) ?? 0) + 1);
      const ks = [...kc.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
      moves.push({
        date: d,
        season: "2026",
        channel: "Paid ads",
        move: `${n} anuncios nuevos en Meta en un día (mensaje principal: ${({ holiday: "temporada", offer: "oferta", launch: "lanzamiento", brand: "marca" } as any)[ks]})`,
      });
    }
  }
  for (const y of ["2025", "2026"] as Temporada[]) {
    const first = ig.find((r) => season(r.date) === y && r.tag === "holiday");
    if (first)
      moves.push({
        date: first.date,
        season: y,
        channel: "Owned social",
        move: `Primera publicación de temporada en Instagram: «${corte(first.caption, 90)}»`,
      });
  }
  moves.push(...(((await A.leer("data/moves_extra.json")) ?? []) as any[]));
  moves.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const timeline: any[] = [];
  for (const m of moves) {
    const y = m.season as Temporada,
      w = wk(m.date, y);
    if (season(m.date) !== y) continue;
    timeline.push({
      date: m.date,
      season: y,
      week: w,
      channel: m.channel,
      move: m.move,
      evidence: "SEEN",
    });
    add(y, w, m.channel, 1, 0, m.move);
  }
  const sortK = (a: string, b: string) => {
    const [ya, wa, ca] = a.split("|"),
      [yb, wb, cb] = b.split("|");
    return ya !== yb
      ? ya! < yb!
        ? -1
        : 1
      : +wa! !== +wb!
        ? +wa! - +wb!
        : ca! < cb!
          ? -1
          : ca! > cb!
            ? 1
            : 0;
  };
  const volume_weekly = [...vol.keys()].sort(sortK).map((k) => {
    const [y, w, ch] = k.split("|");
    const v = vol.get(k)!;
    return {
      brand: CFG.name,
      season: y,
      week: +w!,
      channel: ch,
      units: v.units,
      views: v.views,
      items: (items.get(k) ?? []).slice(0, 6).join(" || "),
    };
  });
  const spend_weekly = [...spend.keys()].sort(sortK).map((k) => {
    const [y, w, t] = k.split("|");
    const s = spend.get(k)!;
    return {
      season: y,
      week: +w!,
      type: t,
      low: Math.round(s[0]),
      mid: Math.round(s[1]),
      high: Math.round(s[2]),
    };
  });
  // ---------- métricas ----------
  const ig26 = ig.filter((r) => season(r.date) === "2026"),
    ig25 = ig.filter((r) => season(r.date) === "2025");
  const byt = new Map<string, [number, number, number]>();
  for (const [k, s] of spend) {
    const [y, , t] = k.split("|");
    if (y === "2026") {
      const b = byt.get(t!) ?? [0, 0, 0];
      b[0] += s[0];
      b[1] += s[1];
      b[2] += s[2];
      byt.set(t!, b);
    }
  }
  const search = (searchRows ?? []).filter((r) => r.brand === CFG.key || r.brand == null);
  const sx = (y: Temporada, w: number): number | null => {
    const r = search.find((r) => r.season === y && +r.week === w);
    if (!r || r.x_baseline === "" || r.x_baseline == null) return null;
    if (y === "2026" && (PER.legacy ? w >= -1 : suma(D0["2026"], 7 * w + 6) > TODAY)) return null;
    return +r.x_baseline;
  };
  const ai: Record<string, boolean> = {};
  const aiRx = new RegExp(nameRx.source, "i");
  for (const i of ["1", "2", "3"]) ai[i] = aiRx.test(AI_RESPUESTAS[i] ?? "");
  const count = (xs: string[]) => {
    const c: Record<string, number> = {};
    for (const x of xs) c[x] = (c[x] ?? 0) + 1;
    return c;
  };
  const ttViews: Record<string, number> = {};
  for (const r of tt) ttViews[r.kind] = (ttViews[r.kind] ?? 0) + r.views;
  for (const k of Object.keys(ttViews)) if (!(ttViews[k]! > 0)) delete ttViews[k];
  const m: any = {
    brand: CFG.name,
    key: CFG.key,
    today: TODAY,
    meta_ads: rows.length,
    meta_total,
    meta_formats: count(rows.map((r) => r.format)),
    meta_kinds: count(rows.map((r) => r.kind)),
    meta_whatsapp: rows.filter((r) => r.whatsapp).length,
    meta_starts: startsSorted,
    meta_first: startsSorted.length ? startsSorted[0]![0] : null,
    meta_new_oct_nov: startsSorted
      .filter(([d]) => d >= (PER.month_start ?? "2026-10-01"))
      .reduce((s, [, n]) => s + n, 0),
    tt_ads: tta.length,
    tt_ads_views: tta.reduce((s, r) => s + r.views, 0),
    tt_followers,
    google_ads: gads.length,
    google_live: gads.filter((a) => a.last_seen >= suma(TODAY, -4)).length,
    tt_kinds: count(tt.map((r) => r.kind)),
    tt_views: ttViews,
    ig_posts_26: ig26.length,
    ig_posts_25: ig25.length,
    ig_oldest: oldest_ig,
    ig_tags_26: count(ig26.map((r) => r.tag)),
    ig_tags_25: count(ig25.map((r) => r.tag)),
    ig_median_26: med(ig26.filter((r) => r.views).map((r) => r.views)),
    ig_median_25: med(ig25.filter((r) => r.views).map((r) => r.views)),
    ig_collabs_26: ig26.filter((r) => r.coauthors || r.paid).length,
    ig_first_holiday_26: ig26.find((r) => r.tag === "holiday")?.date ?? null,
    ig_first_holiday_25: ig25.find((r) => r.tag === "holiday")?.date ?? null,
    spend_2026: Object.fromEntries(
      [...byt.entries()].map(([k, v]) => [k, v.map((x) => Math.round(x))]),
    ),
    search: Object.fromEntries(
      (["2025", "2026"] as Temporada[]).map((y) => [
        y,
        Object.fromEntries(
          Array.from({ length: WMAX - WMIN + 1 }, (_, i) => [String(WMIN + i), sx(y, WMIN + i)]),
        ),
      ]),
    ),
    ai,
  };
  m.spend_2026_total = [0, 1, 2].map((i) =>
    (Object.values(m.spend_2026) as number[][]).reduce((s, v) => s + v[i]!, 0),
  );
  if (cat && cat.length) {
    const disc = cat
      .filter((c) => c.list && c.price < c.list * 0.995)
      .map((c) => 1 - c.price / c.list);
    const depth: Record<string, number> = {};
    for (const x of disc) {
      const k = String(Math.round(pyRound(x * 10)) * 10);
      depth[k] = (depth[k] ?? 0) + 1;
    }
    const rel: Record<string, number> = {};
    for (const c of cat) {
      const k = (c.release || "").slice(0, 7);
      rel[k] = (rel[k] ?? 0) + 1;
    }
    const relSorted = Object.entries(rel)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-6);
    const cl = new Map<string, number>();
    for (const c of cat)
      for (const x of c.clusters ?? [])
        if (/black|%|off|sale|promo|descu|bf|más es|2x|3x/i.test(String(x)))
          cl.set(String(x), (cl.get(String(x)) ?? 0) + 1);
    m.catalog = {
      products: cat.length,
      discounted: disc.length,
      share: pyRound(disc.length / cat.length, 3),
      median_depth: pyRound(med(disc), 2),
      max_depth: disc.length ? pyRound(Math.max(...disc), 2) : 0,
      depth: Object.fromEntries(Object.entries(depth).sort((a, b) => +a[0] - +b[0])),
      full: cat.length - disc.length,
      median_price: med(cat.map((c) => c.price)),
      release_by_month: Object.fromEntries(relSorted),
      in_stock: pyRound(cat.filter((c) => c.avail).length / cat.length, 2),
      clusters: [...cl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
    };
  }
  return {
    metrics: m,
    meta_ads: rows,
    tiktok_ads: tta,
    tiktok_labeled: tt,
    ig_owned: ig,
    catalog_norm: cat,
    timeline,
    volume_weekly,
    spend_weekly,
  };
}
