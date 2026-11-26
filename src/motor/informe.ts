/* eslint-disable @typescript-eslint/no-explicit-any */
// Arma el informe HTML (versión web y de impresión). Copia de informes/scripts/build_generic_es.py.
import { CSS, IX_CSS, IX_JS, JS } from "./plantilla";
import { corte, n, pct, pyRound, xf } from "./formato";
import { MES3, difDias, min, suma, type Fecha } from "./fechas";
import type { Ventana } from "./periodo";

export type EntradaInforme = {
  CFG: { name: string; ig: string; tt: string; catalog_note?: string };
  PER: Ventana;
  M: any;
  N: any;
  PK: any;
  vol: any[];
  spend: any[];
  timeline: any[];
  ads: any[];
  tta: any[];
  tt: any[];
  ig: any[];
  /** nombre de archivo de imagen (p. ej. 'img/ad_123.jpg') → data URI; vacío si no se pudo bajar */
  img: (nombre: string) => string;
};

const NOUSD = /\s*\/?\s*(?:US|\u{1D5E8}\u{1D5E6})\s*\$\s*[\d.,\u{1D7CE}-\u{1D7FF}]*/giu;
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(NOUSD, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
const fecha = (d: Fecha) => `${+d.slice(8, 10)} ${MES3[+d.slice(5, 7) - 1]}`;
const fechaLarga = (d: Fecha) => `${fecha(d)} ${d.slice(0, 4)}`;
const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
function usd(x: number): string {
  const v = x * 4000;
  if (v >= 1e9) return `COP ${n(Number((v / 1e6).toFixed(0)))} millones`;
  if (v >= 1e7) return `COP ${(v / 1e6).toFixed(0)} millones`;
  if (v >= 1e6)
    return `COP ${(v / 1e6).toFixed(1).replace(".", ",").replace(",0 ", " ")} millones`.replace(
      ",0 millones",
      " millones",
    );
  return `COP ${n(pyRound(v / 1000) * 1000)}`;
}
const CH = [
  "Paid ads",
  "Social media collabs",
  "Owned social",
  "Site & offers",
  "Retail & prices",
  "Search & PR",
];
const CH_ES: Record<string, string> = {
  "Paid ads": "Anuncios pagados",
  "Social media collabs": "Colaboraciones en redes",
  "Owned social": "Redes propias",
  "Site & offers": "Web y ofertas",
  "Retail & prices": "Tiendas y precios",
  "Search & PR": "Búsquedas y PR",
};
const ST = [
  "Meta ads",
  "TikTok ads",
  "Paid collab posts",
  "Gifted collab posts",
  "Making owned posts",
];
const ST_ES: Record<string, string> = {
  "Meta ads": "Anuncios en Meta",
  "TikTok ads": "Videos impulsados en TikTok",
  "Paid collab posts": "Publicaciones con creadores",
  "Gifted collab posts": "Prendas regaladas a creadores",
  "Making owned posts": "Producción de contenido propio",
};
const KIND_ES: Record<string, string> = {
  holiday: "temporada",
  offer: "oferta",
  launch: "lanzamiento",
  brand: "marca",
};
const TT_ES: Record<string, string> = {
  creator: "Creador",
  organic_mention: "Mención espontánea",
  reseller: "Revendedor",
  replica_or_wholesale: "Réplica o mayorista",
  owned: "Cuenta oficial",
};

function itemEs(t: string): string {
  let m = /^Meta (\w+) · (\w+) · (.*)/s.exec(t);
  if (m) return `Meta ${m[1]} · ${KIND_ES[m[2]!] ?? m[2]} · «${m[3]}»`;
  m = /^Google (\w+) creative \(since ([\d-]+)\)/.exec(t);
  if (m)
    return `Anuncio de Google (${({ Text: "texto", Image: "imagen", Video: "video" } as any)[m[1]!] ?? m[1]}), activo desde ${fechaLarga(m[2]!)}`;
  m = /^IG con @(\S+): (.*)/s.exec(t);
  if (m) return `Instagram con @${m[1]}: «${m[2]}»`;
  m = /^IG (\w+): (.*)/s.exec(t);
  if (m) return `Instagram, ${KIND_ES[m[1]!] ?? m[1]}: «${m[2]}»`;
  m = /^TikTok impulsado · (.*)/s.exec(t);
  if (m) return `Video impulsado en TikTok: «${m[1]}»`;
  m = /^TikTok: (.*)/s.exec(t);
  if (m) return `TikTok: «${m[1]}»`;
  return t;
}
function calCh(t: string): string {
  t = t.replace(/<[^>]+>/g, "").toLowerCase();
  if (t.startsWith("instagram")) return "ig";
  if (t.includes("tiktok")) return "tt";
  if (t.includes("anuncio") || t.startsWith("meta")) return "ads";
  return "web";
}
const maxPor = <T>(xs: T[], f: (x: T) => number): T | null =>
  xs.length ? xs.reduce((a, b) => (f(b) > f(a) ? b : a)) : null;

export function armarInforme(E: EntradaInforme): string {
  const { CFG, PER, M, N, PK, vol, spend, timeline, ads, tta, tt, ig, img } = E;
  const NAME = CFG.name,
    LEG = PER.legacy,
    MESES = PER.meses,
    TIT = PER.titulo,
    TODAY = PER.TODAY;
  const S26 = PER.start["2026"],
    E26 = PER.end["2026"],
    S25 = PER.start["2025"],
    E25 = PER.end["2025"];
  const FIN = min(E26, TODAY);
  const CERRADO = (PER.month_end ?? E26) < TODAY;
  const RANGO_TXT = `${fecha(S26)} a ${fecha(FIN)}`;
  const LEIDO = `${fecha(TODAY)} ${TODAY.slice(0, 4)}`;
  const WLAB = PER.wl,
    BFW = PER.bf["2026"];
  const wl = (w: number, def?: string) => WLAB[w] ?? def ?? `S${w}`;

  let js = JS.replace(
    "__CAP26__",
    LEG
      ? "'Del 25 sep al 3 dic 2026: octubre y noviembre completos. La semana del 27 nov aún no sale.'"
      : `'Del ${fecha(S26)} al ${fecha(E26)} 2026: ${MESES} completos.` +
          (E26 > TODAY ? ` Las semanas después del ${fecha(TODAY)} aún no salen.` : "") +
          "'",
  );
  js = js.replace(
    "__CAP25__",
    LEG
      ? "'Del 26 sep al 4 dic 2025: octubre y noviembre completos. Solo lo que sigue visible un año después: anuncios de Google, publicaciones de Instagram y campañas.'"
      : `'Del ${fecha(S25)} al ${fecha(E25)} 2025: ${MESES} completos. Solo lo que sigue visible un año después: anuncios de Google, publicaciones de Instagram y campañas.'`,
  );
  js = js.split("__MARCA__").join(NAME);

  // ---------- semanas ----------
  const weeks: Record<string, any[]> = {};
  for (const y of ["2025", "2026"] as const) {
    const wsArr: any[] = [];
    for (let w = PER.WMIN; w <= PER.WMAX; w++) {
      const start = suma(PER.D0[y], 7 * w);
      const future = start > TODAY;
      const partial = !future && suma(start, 6) > TODAY;
      const units: Record<string, number> = Object.fromEntries(CH.map((c) => [c, 0]));
      let views = 0;
      const items: Record<string, string[]> = Object.fromEntries(CH.map((c) => [c, []]));
      for (const r of vol)
        if (r.season === y && +r.week === w) {
          units[r.channel] = (units[r.channel] ?? 0) + +r.units;
          views += +r.views;
          items[r.channel] = String(r.items).split(" || ").filter(Boolean).map(itemEs).slice(0, 4);
        }
      const sp: Record<string, number[]> = Object.fromEntries(ST.map((t) => [t, [0, 0, 0]]));
      for (const r of spend)
        if (r.season === y && +r.week === w && r.type in sp) sp[r.type] = [+r.low, +r.mid, +r.high];
      let sx = M.search[y][String(w)] ?? null;
      if (partial || future) sx = null;
      wsArr.push({
        w,
        label: fecha(start),
        future,
        partial,
        units,
        views,
        items,
        spend: sp,
        search: sx,
      });
    }
    weeks[y] = wsArr;
  }
  const igc = new Map<string, any>(ig.map((r) => [r.code, r]));
  const C = M.catalog ?? null;
  const tot = M.spend_2026_total,
    sp26 = M.spend_2026;
  const spv = (t: string, i = 1) => (sp26[t] ?? [0, 0, 0])[i];
  const sum = (o: Record<string, number>) => Object.values(o).reduce((s, v) => s + v, 0);
  const best = (y: string, f: (w: any) => number) =>
    maxPor(
      weeks[y]!.filter((w) => !w.future),
      f,
    );
  const bwUnits = best("2026", (w) => sum(w.units)),
    bwSp = best("2026", (w) => ST.reduce((s, t) => s + w.spend[t][1], 0));
  const bw25 = best("2025", (w) => sum(w.units));
  const wlab = (w: any) => (WLAB[w.w] === "BF" ? "semana BF" : wl(w.w)) + `, ${w.label}`;
  const R26 = [
    ["Empezó a prepararse", N.prep26 ?? "—", N.prep26_note ?? ""],
    ["Mayor empuje", wlab(bwUnits), `${sum(bwUnits.units)} unidades activas`],
    [
      "Mayor gasto est.",
      wlab(bwSp),
      `${usd(ST.reduce((s, t) => s + bwSp.spend[t][1], 0))} (${usd(ST.reduce((s, t) => s + bwSp.spend[t][0], 0))}–${usd(ST.reduce((s, t) => s + bwSp.spend[t][2], 0))})`,
    ],
    LEG
      ? ["Resultado", "Todavía es pronto", "Final el 11 dic"]
      : !CERRADO
        ? ["Resultado", "Todavía es pronto", `Final después del ${fecha(PER.month_end!)}`]
        : ["Resultado", "Sin datos de ventas", "Las ventas de la marca no son públicas"],
  ];
  const R25 = [
    ["Empezó a prepararse", N.prep25 ?? "—", N.prep25_note ?? ""],
    ["Mayor empuje", wlab(bw25), `${sum(bw25.units)} unidades activas`],
    [
      "Mayor gasto est.",
      "contenido propio",
      "Los anuncios de 2025 ya no están en la biblioteca de Meta",
    ],
    ["Resultado", N.res25 ?? "Ventas no públicas", N.res25_note ?? ""],
  ];
  const data = {
    weeks,
    CH,
    ST,
    CH_ES,
    ST_ES,
    depth: C
      ? [
          { pct: 0, n: C.full ?? 0 },
          ...Object.entries(C.depth ?? {}).map(([k, v]) => ({ pct: +k, n: v })),
        ]
      : [],
    tiers: [],
    price_sellers: {},
    ad_starts: M.meta_starts.filter(([d]: [string]) => d >= S26),
    R26,
    R25,
    WL: Object.fromEntries(Object.entries(WLAB).map(([k, v]) => [String(k), v])),
    BFW,
    SHADE: LEG ? [-4, -1] : BFW != null ? [BFW - 4, BFW - 1] : null,
    BASE_TXT: LEG ? "S-10 a S-6" : "las 7 semanas antes del periodo",
  };

  const postCard = (
    im: string,
    views: number,
    pill: string,
    who: string,
    date: Fecha,
    src: string,
    cap: string,
    url: string,
    dupe = false,
  ) =>
    !im
      ? ""
      : `<div class="post${dupe ? " dupe" : ""}"><img src="${im}" alt="portada"><div class="meta"><div class="row"><b>${n(views)} vistas</b><span class="pill">${esc(pill)}</span></div><span>${esc(who)}</span><span class="muted">${fechaLarga(date)} · ${src}</span><span class="muted" style="font-size:12px">«${esc(corte(cap, 95))}»</span><a href="${url}" target="_blank" rel="noopener">Abrir publicación</a></div></div>`;
  const chartDiv = (i: number) => `<div class="chart" id="chChart${i}"></div>`;
  const moveList = (ch: string) => {
    const rows = timeline.filter((m) => m.channel === ch);
    if (!rows.length) return '<p class="muted">No hay movimientos fechados en este canal.</p>';
    return (
      '<div class="moves">' +
      rows
        .map(
          (m) =>
            `<div class="move"><span class="mono">${fechaLarga(m.date)}</span><span>${esc(m.move)}</span><span class="pill seen">VISTO</span></div>`,
        )
        .join("") +
      "</div>"
    );
  };
  const weekTable = (ch: string) => {
    const types =
      (
        {
          "Paid ads": ["Meta ads", "TikTok ads"],
          "Social media collabs": ["Paid collab posts", "Gifted collab posts"],
          "Owned social": ["Making owned posts"],
        } as any
      )[ch] ?? [];
    let s =
      '<details><summary>Ver la tabla semana a semana</summary><div class="tbl"><table class="stack"><thead><tr><th>Semana</th><th>Qué corrió</th><th>Unidades</th><th>Gasto est. (rango)</th><th>Búsquedas vs. normal</th><th>Vistas</th></tr></thead><tbody>';
    const omit: string[] = [];
    for (const wk of weeks["2026"]!) {
      const lab = `${wl(wk.w)} · ${wk.label}`;
      if (wk.future) {
        s += `<tr><td>${lab}</td><td colspan="5" class="muted">aún no sale</td></tr>`;
        continue;
      }
      const it = wk.items[ch].slice(0, 2).join("; ") || "—";
      const sp = [0, 1, 2].map((k) =>
        types.reduce((a: number, t: string) => a + wk.spend[t][k], 0),
      );
      const spt =
        types.length && sp[1]
          ? `${usd(sp[1]!)} (${usd(sp[0]!)}–${usd(sp[2]!)})`
          : !types.length
            ? "sin estimar"
            : "COP 0";
      const sxx = wk.search != null ? xf(wk.search) : wk.partial ? "aún no sale" : "sin datos";
      const vt = ch === "Paid ads" ? "no es público" : n(wk.views);
      const empty = it === "—" && wk.units[ch] === 0;
      if (empty) omit.push(wl(wk.w));
      s += `<tr${empty ? ' class="empty"' : ""}><td>${lab}</td><td>${esc(corte(it, 150))}</td><td>${wk.units[ch]}</td><td>${spt}</td><td>${sxx}</td><td>${vt}</td></tr>`;
    }
    s += "</tbody></table></div>";
    if (omit.length)
      s += `<p class="note print-only">Semanas sin actividad en este canal (omitidas en esta versión): ${omit.join(", ")}.</p>`;
    return s + "</details>";
  };
  const bullets = (l: string[]) => "<ul>" + l.map((x) => `<li>${x}</li>`).join("") + "</ul>";
  const summary = (tint: string, budget: string, note: string, did: string[], when: string[]) =>
    `<div class="summary"><div class="${tint}"><span class="lbl">Presupuesto estimado</span><span class="big">${budget}</span><span class="muted">${note}</span></div><div class="${tint}"><span class="lbl">Lo que hizo ${esc(NAME)}</span>${bullets(did)}</div><div class="${tint}"><span class="lbl">Cuándo</span>${bullets(when)}</div></div>`;

  const D = difDias(TODAY, PER.D0["2026"]);
  const s26 = M.search["2026"],
    s25 = M.search["2025"];
  const H: string[] = [];
  const a = (x: string) => H.push(x);
  a(
    `<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<title>${esc(NAME)} ${TIT}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">`,
  );
  a(CSS);
  a(IX_CSS);
  a(
    '<nav class="toc" aria-label="Secciones"><div class="in"><a href="#calendar">Calendario</a><a href="#timeline">Cronología</a><a href="#channels">Canales</a><a href="#moves">Precios y movimientos</a><a href="#sales">Ventas</a><a href="#verdict">Veredicto</a><a href="#plays">Qué copiar</a></div></nav><div class="wrap">',
  );
  const kpiCat = C
    ? `<div class="kpi"><span>Productos con descuento</span><b>${pct(C.share)}</b><span>${N.kpi_cat_note ?? ""}</span></div>`
    : '<div class="kpi"><span>Catálogo</span><b>sin datos</b><span>no hay catálogo público</span></div>';
  const refs = (
    LEG ? [-2, -3] : Array.from({ length: PER.WMAX - PER.WMIN + 1 }, (_, i) => PER.WMAX - i)
  ).filter((w) => s26[String(w)] != null);
  const REFW = refs.length ? refs[0]! : -2;
  const srchNow = s26[String(REFW)] ?? null,
    srchThen = s25[String(REFW)] ?? null;
  const sw = (
    LEG ? [-5, -4, -3, -2] : Array.from({ length: PER.WMAX - PER.WMIN + 1 }, (_, i) => PER.WMIN + i)
  )
    .filter((w) => s26[String(w)] != null)
    .slice(-4);
  const metaDe = M.meta_total && M.meta_total !== M.meta_ads ? ` de ${M.meta_total}` : "";
  a(`<header class="hero">
<div class="badges"><span class="pill solid">${LEG ? "D" + D : weeks["2026"]!.length + " semanas"}</span><span class="lbl">Colombia · ${TIT} · leído el ${LEIDO}</span></div>
<h1>Análisis del marketing de ${TIT}: ${esc(NAME)}</h1>
<p>${N.hero}</p>
<div class="badges"><span class="lbl">Veredicto</span><span class="pill verdict">${!LEG && CERRADO ? "Sin datos de ventas" : "Todavía es pronto"}</span><span class="muted" style="font-size:13px">${esc(N.verdict_line)}</span></div>
<div class="kpis">
<div class="kpi"><span>Anuncios activos en Meta</span><b>${M.meta_ads}${metaDe}</b><span>${N.kpi_ads_note ?? ""}</span></div>
${kpiCat}
<div class="kpi"><span>Gasto estimado, ${RANGO_TXT}</span><b>${usd(tot[0 + 1])}</b><span>rango ${usd(tot[0])} a ${usd(tot[2])}</span></div>
<div class="kpi"><span>Mediana de vistas en Instagram</span><b>${n(M.ig_median_26)}</b><span>mismos meses de 2025: ${n(M.ig_median_25)}</span></div>
</div>
<div class="print-only toc-print"><span class="lbl">Contenido</span><ol>
<li><b>Calendario de ${MESES}.</b> Cada oferta y campaña, en orden.</li>
<li><b>Parte 1 · Lo que hizo ${esc(NAME)}.</b> Cronología 2026 y 2025 y cada canal semana a semana.</li>
<li><b>Precios y movimientos.</b> Descuentos del catálogo y todos los movimientos fechados.</li>
<li><b>Parte 2 · ¿Funcionó?</b> Señales de ventas, búsquedas y el veredicto con sus seis pruebas.</li>
<li><b>Qué copiar y qué evitar.</b> Jugadas concretas para aplicar.</li></ol>
<p class="muted" style="font-size:12.5px">Versión para imprimir: las pestañas de la página web aparecen una tras otra, y en las tablas semanales se omiten las semanas sin actividad.</p></div>
</header>`);
  a(
    `<section id="calendar"><h2>El calendario de ${esc(NAME)} en ${MESES}</h2><div class="card"><div class="calendar">`,
  );
  for (const c of N.calendar)
    a(
      `<div class="cal" data-ch="${calCh(c[1])}"><span class="mono">${esc(c[0])}</span><span>${c[1]}</span></div>`,
    );
  a(
    `</div><p class="note">${esc(N.calendar_note ?? "Fechas tomadas de las publicaciones de Instagram, los anuncios de Meta y la web.")}</p></div></section>`,
  );
  a(`<div class="part"><span class="lbl">Parte 1</span><h2>Lo que hizo ${esc(NAME)}</h2></div>`);
  const timelineBlock = (pre: string, title: string) => {
    const seg = pre
      ? ""
      : `<div class="seg"><div class="opts" role="tablist" aria-label="Temporada" id="seasonSeg"><button role="tab" aria-selected="true" data-s="2026">${cap1(TIT)}</button><button role="tab" aria-selected="false" data-s="2025">${cap1(MESES)} 2025</button></div></div>`;
    return `<div class="card ${pre ? "print-only" : ""}"><div class="pane-title">${title}</div>${seg}<p class="cap" id="${pre}seasonCap"></p><div class="readouts" id="${pre}readouts"></div><div class="chart" id="${pre}tlChart"></div><div class="legend" id="${pre}tlLegend"></div>
<h3 style="margin-top:6px">A dónde se fue probablemente la plata, en orden</h3><div id="${pre}moneyOrder" class="note" style="color:var(--fg)"></div><div class="lanes" id="${pre}lanes"></div></div>`;
  };
  a(
    `<section id="timeline"><h2>Semana a semana: cuándo empujó ${esc(NAME)}, por dónde y cuánto le costó</h2>`,
  );
  a(timelineBlock("", cap1(TIT)));
  a(timelineBlock("p25_", cap1(MESES) + " 2025"));
  a(`<div class="note"><span><b>Tarifas usadas (todas son estimaciones).</b> Anuncios en Meta y videos impulsados en TikTok: COP 92.000 por anuncio activo al día (COP 32.000 a COP 248.000), una tarifa ajustada al costo de la publicidad en Colombia. Contenido propio: COP 2 millones por publicación (COP 600.000 a 6 millones). Publicación con un creador o en coautoría: COP 6 millones (COP 3 a 10 millones) cuando no se sabe su tamaño; si se sabe, según sus seguidores (de COP 300.000 para cuentas de menos de 10k a COP 40 millones para más de un millón). Prenda regalada: unos COP 140.000.</span>
<span><b>Sin estimar:</b> Google Ads (no hay fuente de presupuesto para Colombia; sus anuncios activos se cuentan solo como unidades), descuentos, envíos, correo, SMS, WhatsApp y horas del equipo. <b>Sin datos:</b> anuncios de Meta de 2025 (fuera de la UE, la biblioteca solo guarda los activos) y creadores de 2025 en TikTok.</span></div></section>`);

  // ---------- canales ----------
  const ttv = M.tt_views,
    ttk = M.tt_kinds;
  const NA = N.channels ?? {};
  const panes: string[] = [];
  const mk = M.meta_kinds;
  const topStart = maxPor<[string, number]>(M.meta_starts, (x) => x[1]);
  let p = summary(
    "t-paid",
    usd(spv("Meta ads") + spv("TikTok ads")),
    `${usd(spv("Meta ads", 0) + spv("TikTok ads", 0))} a ${usd(spv("Meta ads", 2) + spv("TikTok ads", 2))} · ${M.meta_ads} anuncios de Meta` +
      (M.tt_ads ? ` y ${M.tt_ads} videos impulsados en TikTok` : "") +
      " × los días que lleva cada uno × COP 92.000. Google sin estimar.",
    [
      `${M.meta_ads} anuncios activos en Meta${M.meta_total && M.meta_total !== M.meta_ads ? ` (descargados ${M.meta_ads} de los ${M.meta_total} que reporta la biblioteca)` : ""}: ` +
        Object.entries(M.meta_formats)
          .map(([k, v]) => `${v} ${k}`)
          .join(", ") +
        ".",
      `Mensajes: ${mk.holiday ?? 0} de temporada (Black), ${mk.offer ?? 0} de oferta, ${mk.launch ?? 0} de lanzamiento y ${mk.brand ?? 0} de marca.`,
      ...(NA["Paid ads"] ?? []),
      `Google: ${M.google_ads} anuncios en su registro, ${M.google_live} vistos activos esta semana. ` +
        (M.tt_ads
          ? `TikTok: ${M.tt_ads} videos impulsados con ${n(M.tt_ads_views)} reproducciones.`
          : "No tiene videos impulsados en la biblioteca de anuncios de TikTok."),
    ],
    [
      M.meta_first
        ? `Primer anuncio activo hoy: ${fechaLarga(M.meta_first)}.`
        : "Sin anuncios activos.",
      topStart ? `Día con más anuncios nuevos: ${fechaLarga(topStart[0])} (${topStart[1]}).` : "—",
      "Siguen activos.",
    ],
  );
  p += chartDiv(0) + '<h3>Anuncios reales de la biblioteca de Meta</h3><div class="ad">';
  const seenTxt = new Set<string>();
  let shown = 0;
  for (const aid of PK.ads ?? []) {
    const e = ads.find((x) => String(x.id) === String(aid));
    if (!e || seenTxt.has(corte(e.text, 60)) || shown >= 3) continue;
    seenTxt.add(corte(e.text, 60));
    shown++;
    p += `<div class="adcard"><div class="hd"><span class="av">${esc(NAME[0])}</span><span><b>${esc(NAME)}</b><br><span class="muted">Publicidad · ${esc(e.format)} · ${KIND_ES[e.kind] ?? e.kind}</span></span></div><img src="${img(`img/ad_${aid}.jpg`)}" alt="Anuncio"><div class="bd"><span>«${esc(corte(e.text, 140))}»</span><span class="mono muted">Activo desde el ${fechaLarga(e.start)} · sigue activo</span><span class="mono muted">Lleva a ${esc(corte(String(e.landing).replace("https://", "").replace("http://", ""), 50) || "—")}</span><a href="${e.link}" target="_blank" rel="noopener">Abrir en la biblioteca de anuncios de Meta</a></div></div>`;
  }
  p += "</div>";
  if (PK.tt_ads?.length) {
    p += '<h3>Videos impulsados en TikTok</h3><div class="cards cards4">';
    for (const vid of PK.tt_ads.slice(0, 4)) {
      const r = tta.find((x) => String(x.id) === String(vid));
      if (r)
        p += postCard(
          img(`img/ttad_${vid}.jpg`),
          +r.views,
          "Impulsado",
          `@${CFG.tt}`,
          r.date,
          "TikTok",
          r.desc,
          r.url,
        );
    }
    p += "</div>";
  }
  p += weekTable("Paid ads") + "<h3>Movimientos fechados</h3>" + moveList("Paid ads");
  panes.push(p);
  p = summary(
    "t-collab",
    usd(spv("Paid collab posts") + spv("Gifted collab posts")),
    `${usd(spv("Paid collab posts", 0) + spv("Gifted collab posts", 0))} a ${usd(spv("Paid collab posts", 2) + spv("Gifted collab posts", 2))} · ${M.ig_collabs_26} publicaciones en coautoría en Instagram y ${ttk.creator ?? 0} videos de creadores en TikTok.`,
    [
      `${M.ig_collabs_26} publicaciones de Instagram hechas en coautoría con otras cuentas.`,
      ...(NA["Social media collabs"] ?? []),
      `En TikTok: ${ttk.creator ?? 0} videos de creadores (${n(ttv.creator ?? 0)} vistas), ${ttk.organic_mention ?? 0} menciones espontáneas, ${ttk.reseller ?? 0} de revendedores y ${ttk.replica_or_wholesale ?? 0} de réplicas o mayoristas.`,
    ],
    NA.collab_when ?? ["Ver los movimientos fechados."],
  );
  p += chartDiv(1) + '<h3>Publicaciones con creadores y de otras cuentas</h3><div class="cards">';
  for (const code of (PK.ig_collab ?? []).slice(0, 3)) {
    const r = igc.get(code);
    if (r)
      p += postCard(
        img(`img/ig_${code}.jpg`),
        +r.views || 0,
        "Coautoría",
        "@" + (r.coauthors ? String(r.coauthors).split("|")[0] : CFG.ig),
        r.date,
        "Instagram",
        r.caption,
        r.url,
      );
  }
  for (const vid of (PK.tt_others ?? []).slice(0, 6)) {
    const r = tt.find((x) => String(x.id) === String(vid));
    if (r)
      p += postCard(
        img(`img/tt_${vid}.jpg`),
        +r.views || 0,
        TT_ES[r.kind] ?? r.kind,
        `@${r.author} · ${n(r.followers)} seguidores`,
        r.date,
        "TikTok",
        r.desc,
        r.url,
        r.kind === "replica_or_wholesale",
      );
  }
  p +=
    '</div><p class="note">Las etiquetas de TikTok (creador, revendedor, mención) se deducen del texto de cada video y del tamaño de la cuenta; no son declaraciones de las marcas.</p>' +
    weekTable("Social media collabs") +
    "<h3>Movimientos fechados</h3>" +
    moveList("Social media collabs");
  panes.push(p);
  const t26 = M.ig_tags_26,
    t25 = M.ig_tags_25;
  p = summary(
    "t-owned",
    usd(spv("Making owned posts")),
    `${usd(spv("Making owned posts", 0))} a ${usd(spv("Making owned posts", 2))} · publicaciones propias en Instagram y TikTok × COP 2 millones.`,
    [
      `${M.ig_posts_26} publicaciones en Instagram entre el ${fecha(S26)} y el ${fecha(FIN)} 2026, frente a ${M.ig_posts_25} en los mismos días de 2025.`,
      `Por tema en 2026: ${t26.launch ?? 0} de lanzamiento, ${t26.offer ?? 0} de oferta, ${t26.holiday ?? 0} de temporada (Black) y ${t26.brand ?? 0} de marca. En 2025: ${t25.launch ?? 0}, ${t25.offer ?? 0}, ${t25.holiday ?? 0} y ${t25.brand ?? 0}.`,
      `Mediana de vistas por publicación: ${n(M.ig_median_26)}, frente a ${n(M.ig_median_25)} en 2025 (${M.ig_median_26 >= M.ig_median_25 ? "+" : ""}${pyRound((M.ig_median_26 / Math.max(M.ig_median_25, 1) - 1) * 100)}%). En TikTok, ${ttk.owned ?? 0} videos propios con ${n(ttv.owned ?? 0)} vistas.`,
      ...(NA["Owned social"] ?? []),
    ],
    [
      M.ig_first_holiday_26
        ? `Primera publicación de temporada en 2026: ${fechaLarga(M.ig_first_holiday_26)}.`
        : "Ninguna publicación de Black en 2026 hasta hoy.",
      M.ig_first_holiday_25
        ? `En 2025: ${fechaLarga(M.ig_first_holiday_25)}.`
        : "En 2025 tampoco publicó de Black en Instagram.",
      "Sigue publicando.",
    ],
  );
  p += chartDiv(2) + '<h3>Las publicaciones propias más vistas</h3><div class="cards cards4">';
  for (const code of (PK.ig_top ?? []).slice(0, 4)) {
    const r = igc.get(code);
    if (r)
      p += postCard(
        img(`img/ig_${code}.jpg`),
        +r.views || 0,
        KIND_ES[r.tag] ?? r.tag,
        "@" + CFG.ig,
        r.date,
        "Instagram",
        r.caption,
        r.url,
      );
  }
  p += "</div>";
  if (PK.ig_holiday?.length) {
    p += '<h3>Publicaciones de oferta y temporada, 2025 y 2026</h3><div class="cards cards4">';
    for (const code of PK.ig_holiday.slice(0, 4)) {
      const r = igc.get(code);
      if (r)
        p += postCard(
          img(`img/ig_${code}.jpg`),
          +r.views || 0,
          KIND_ES[r.tag] ?? r.tag,
          "@" + CFG.ig,
          r.date,
          "Instagram",
          r.caption,
          r.url,
        );
    }
    p += "</div>";
  }
  p += weekTable("Owned social") + "<h3>Movimientos fechados</h3>" + moveList("Owned social");
  panes.push(p);
  const catDid = C
    ? [
        `Catálogo revisado: ${CFG.catalog_note ?? ""}.`,
        `${n(C.discounted)} de ${n(C.products)} productos con precio rebajado (${pct(C.share)}); descuento típico de ${pct(C.median_depth)}, máximo ${pct(C.max_depth)}.`,
        `Precio típico: COP ${n(C.median_price / 1000)}k.`,
      ]
    : ["No hay catálogo público para contar."];
  p = summary(
    "t-grey",
    "Sin estimar",
    "El costo de los descuentos y del envío gratis no es público.",
    [...catDid, ...(NA["Site & offers"] ?? [])],
    NA.site_when ?? ["Ver el calendario."],
  );
  p +=
    chartDiv(3) +
    weekTable("Site & offers") +
    "<h3>Movimientos fechados</h3>" +
    moveList("Site & offers");
  panes.push(p);
  p = summary(
    "t-grey",
    "Sin estimar",
    "Los costos con tiendas y centros comerciales no son públicos.",
    [
      ...(NA["Retail & prices"] ?? ["Sin datos de tiendas para esta ventana."]),
      `En TikTok: ${ttk.reseller ?? 0} videos de revendedores y ${ttk.replica_or_wholesale ?? 0} de réplicas o mayoristas que usan el nombre de la marca.`,
    ],
    ["Ver los movimientos fechados."],
  );
  p +=
    chartDiv(4) +
    weekTable("Retail & prices") +
    "<h3>Movimientos fechados</h3>" +
    moveList("Retail & prices");
  panes.push(p);
  const aiN = Object.values(M.ai).filter(Boolean).length;
  p = summary(
    "t-grey",
    "Sin estimar",
    "No se encontró ninguna campaña de búsqueda pagada nueva.",
    [
      `Búsquedas de la marca en Colombia (1× = una semana normal ${LEG ? "de agosto y septiembre" : "antes del periodo"}): ${sw.map((w) => `${wl(w)} ${xf(s26[String(w)])}`).join(", ")} en 2026.`,
      `Mismas semanas de 2025: ${sw
        .filter((w) => s25[String(w)] != null)
        .map((w) => `${wl(w)} ${xf(s25[String(w)])}`)
        .join(", ")}` +
        (LEG
          ? `; y ${xf(s25["-1"])} la semana antes del Black Friday 2025 y ${xf(s25["0"])} la del Black Friday.`
          : "."),
      `ChatGPT la nombra en ${aiN} de 3 preguntas de compra de ropa en Colombia.`,
      ...(NA["Search & PR"] ?? []),
    ],
    LEG
      ? ["La semana del Black Friday 2026 aún no sale."]
      : !CERRADO
        ? ["Las semanas que aún no terminan no salen."]
        : ["Periodo completo."],
  );
  p +=
    chartDiv(5) +
    weekTable("Search & PR") +
    "<h3>Movimientos fechados</h3>" +
    moveList("Search & PR");
  panes.push(p);
  a(
    '<section id="channels"><h2>Cada canal, semana a semana</h2><div class="seg"><div class="opts" role="tablist" aria-label="Canal" id="chSeg">',
  );
  CH.forEach((c, i) =>
    a(
      `<button role="tab" aria-selected="${i === 0 ? "true" : "false"}" data-c="${i}">${esc(CH_ES[c])}</button>`,
    ),
  );
  a('</div></div><p class="cap" id="chCap"></p>');
  panes.forEach((pp, i) =>
    a(
      `<div class="pane card" data-pane="ch" data-i="${i}"${i ? " hidden" : ""}><div class="pane-title">${esc(CH_ES[CH[i]!])}</div>${pp}</div>`,
    ),
  );
  a("</section>");

  // ---------- precios y movimientos ----------
  a(`<section id="moves"><h2>Los descuentos de ${esc(NAME)} y cada movimiento fechado</h2>`);
  a(
    '<div class="seg"><div class="opts" role="tablist" aria-label="Vista" id="mvSeg"><button role="tab" aria-selected="true" data-c="0">Ofertas y precios</button><button role="tab" aria-selected="false" data-c="1">Patrones</button><button role="tab" aria-selected="false" data-c="2">Todos los movimientos</button></div></div><p class="cap" id="mvCap"></p>',
  );
  a(
    '<div class="pane card" data-pane="mv" data-i="0"><div class="pane-title">Ofertas y precios</div>',
  );
  if (PK.products?.length) {
    a('<h3>Productos de ejemplo, hoy</h3><div class="offers">');
    for (const o of PK.products.slice(0, 6)) {
      const off = o.list && o.price < o.list * 0.995 ? 1 - o.price / o.list : 0;
      const pill = off
        ? `<span class="pill" style="background:var(--accent);color:#fff;border-color:var(--accent)">-${pyRound(off * 100)}% · ahorras COP ${n((o.list - o.price) / 1000)}k</span>`
        : '<span class="pill">precio lleno, sin descuento</span>';
      a(
        `<a class="offer" href="${esc(o.link)}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><img src="${img(o.file)}" alt="${esc(o.name)}"><div class="bd"><b>${esc(corte(o.name, 60))}</b><span class="now">COP ${n(o.price / 1000)}k</span>${off ? "<s>COP " + n(o.list / 1000) + "k</s>" : ""}${pill}</div></a>`,
      );
    }
    a("</div>");
  }
  if (C) {
    a(
      `<h3>Qué tan profundos son los descuentos</h3><p class="muted" style="font-size:13px">${esc(CFG.catalog_note ?? "")}, leídos el ${LEIDO}.</p><div class="bars" id="depthBars"></div>`,
    );
    if (C.clusters?.length) {
      a('<h3>Colecciones de oferta en el catálogo</h3><div class="bars">');
      const mx = Math.max(...C.clusters.map((c: [string, number]) => c[1]));
      for (const [k, v] of C.clusters.slice(0, 8))
        a(
          `<div class="bar"><span>${esc(k)}</span><span class="tr"><span class="fill" style="display:block;width:${((v / mx) * 100).toFixed(0)}%;background:var(--paid)"></span></span><span class="mono">${n(v)} productos</span></div>`,
        );
      a("</div>");
    }
  }
  a(
    '<h3>Dónde aparece la oferta</h3><div class="tiles">' +
      N.offer_tiles
        .map(
          (t: string[]) =>
            `<div class="tile"><span class="lbl">${esc(t[0])}</span><b style="color:var(${({ Sí: "--accent", No: "--dupe" } as any)[t[1]!] ?? "--paid"})">${esc(t[1])}</b><span>${esc(t[2])}</span></div>`,
        )
        .join("") +
      "</div></div>",
  );
  a(
    `<div class="pane card" data-pane="mv" data-i="1" hidden><div class="pane-title">Patrones</div><div class="grid2"><div><h3>Anuncios de Meta lanzados por día</h3><p class="muted" style="font-size:13px">Anuncios activos hoy, por fecha de inicio desde el ${fecha(S26)}.</p><div id="adWaves" class="chart"></div></div><div><h3>Lo que se repite</h3>${bullets(N.patterns)}</div></div></div>`,
  );
  a(
    '<div class="pane card" data-pane="mv" data-i="2" hidden><div class="pane-title">Todos los movimientos</div><div class="tbl"><table><thead><tr><th>Fecha</th><th>Temporada</th><th>Semana</th><th>Canal</th><th>Movimiento</th><th>Evidencia</th></tr></thead><tbody>',
  );
  for (const m of timeline)
    a(
      `<tr data-season="${m.season}" data-ch="${esc(CH_ES[m.channel])}"><td class="mono">${fechaLarga(m.date)}</td><td>${m.season}</td><td>${+m.week === 0 ? "BF" : "S" + m.week}</td><td>${esc(CH_ES[m.channel])}</td><td>${esc(m.move)}</td><td><span class="pill seen">VISTO</span></td></tr>`,
    );
  a("</tbody></table></div></div></section>");

  // ---------- parte 2 ----------
  a('<div class="part"><span class="lbl">Parte 2</span><h2>¿Funcionó?</h2></div>');
  const catNote =
    (CFG.catalog_note ?? "").charAt(0).toUpperCase() +
    (CFG.catalog_note ?? "").slice(1).toLowerCase();
  a(`<section id="sales"><h2>Ventas hasta hoy: lo que se puede contar y lo que no</h2><div class="card"><div class="tiles" style="grid-template-columns:repeat(3,minmax(0,1fr))">
<div class="tile"><span class="lbl">Catálogo, ${fecha(TODAY)}</span><b>${C ? n(C.products) + " productos revisados" : "sin datos"}</b><span>${esc(catNote || "Sin catálogo")}.${C ? (LEG ? " Las unidades vendidas necesitan una segunda foto después del 30 nov." : " Las unidades vendidas necesitan una segunda foto del catálogo.") : ""}</span><span class="pill seen" style="justify-self:start">VISTO</span></div>
<div class="tile"><span class="lbl">Búsquedas de la marca, ${wl(REFW, "S-2")}</span><b>${xf(srchNow)} lo normal</b><span>Misma semana en 2025: ${xf(srchThen)}</span><span class="pill seen" style="justify-self:start">VISTO</span></div>
<div class="tile"><span class="lbl">ChatGPT</span><b>La nombra en ${aiN} de 3</b><span>Preguntas de compra de ropa en Colombia</span><span class="pill seen" style="justify-self:start">VISTO</span></div></div>
<p class="note">${NAME} no publica ventas. No hay unidades vendidas públicas en marketplaces ni datos de tráfico a su web o tiendas, así que no se dibuja ningún rango de ventas: solo mostraría suposiciones.</p></div></section>`);
  a(`<section id="verdict"><h2>Veredicto: ¿le funcionó a ${esc(NAME)} su estrategia de ${MESES}?</h2>
<div class="card"><div class="badges"><span class="pill verdict" style="font-size:14px">Todavía es pronto</span><span>${esc(N.verdict_line)}</span></div>
<div class="tbl"><table class="tests"><colgroup><col style="width:17%"><col style="width:30%"><col style="width:25%"><col style="width:17%"><col style="width:11%"></colgroup><thead><tr><th>Prueba</th><th>Número</th><th>Comparado con</th><th>Nota</th><th>Confianza</th></tr></thead><tbody>`);
  for (const t of N.tests)
    a(
      `<tr><td><b>${t[0]}</b></td><td>${esc(t[1])}</td><td>${esc(t[2])}</td><td><span class="grade g-${t[3]}">${esc(t[4])}</span></td><td>${t[5]}</td></tr>`,
    );
  const porMonto = Object.entries(sp26 as Record<string, number[]>)
    .map((e, i) => [e, i] as const)
    .sort((x, y) => -x[0][1][1]! + y[0][1][1]! || x[1] - y[1])
    .map(([e]) => e);
  a(
    `</tbody></table></div>
<div class="grid2"><div class="tile"><span class="lbl">Gasto estimado, ${RANGO_TXT}</span><b>${usd(tot[1])}</b><span>${usd(tot[0])} a ${usd(tot[2])} · ` +
      porMonto.map(([k, v]) => `${ST_ES[k]!.toLowerCase()} ${usd(v[1]!)}`).join(", ") +
      `</span></div>
<div class="tile"><span class="lbl">Ventas estimadas en la ventana</span><b>Aún sin estimar</b><span>` +
      (LEG
        ? "Hace falta una segunda foto del catálogo después del 30 nov"
        : !CERRADO
          ? "Hace falta una segunda foto del catálogo al cierre del periodo"
          : "Las ventas de la marca no son públicas") +
      `</span></div></div>
<div class="grid2"><div><h3>Lo que ha funcionado</h3>` +
      bullets(N.worked) +
      "</div><div><h3>Lo que no</h3>" +
      bullets(N.didnt) +
      "</div></div></div></section>",
  );
  const rich = N.plays.some((pl: any) => pl.pasos);
  a(
    `<section id="plays"><h2>${N.plays.length} jugadas de ${esc(NAME)} para copiar y ${N.skip.length} ${N.skip.length === 1 ? "cosa" : "cosas"} para evitar</h2>` +
      (rich
        ? '<p class="muted">Cada jugada sale de algo que la marca hizo de verdad en esta temporada. Abajo está lo que se vio, por qué funciona, cómo hacerlo y cuánto cuesta, con las mismas tarifas en pesos del informe.</p>'
        : "") +
      `<div class="plays${rich ? " rich" : ""}">`,
  );
  N.plays.forEach((pl: any, i0: number) => {
    const i = i0 + 1;
    if (!pl.pasos) {
      a(
        `<div class="play"><h3>${esc(pl.t)}</h3><p>${esc(pl.d)}</p><dl><dt>Evidencia</dt><dd>${esc(pl.e)}</dd><dt>Cuándo empezar</dt><dd>${esc(pl.w)}</dd><dt>Esfuerzo</dt><dd>${esc(pl.f)}</dd><dt>Qué medir</dt><dd>${esc(pl.m)}</dd></dl></div>`,
      );
      return;
    }
    const side = (
      [
        ["Evidencia", "e"],
        ["Costo de referencia", "costo"],
        ["Cuándo empezar", "w"],
        ["Esfuerzo", "f"],
        ["Qué medir", "m"],
      ] as const
    )
      .filter(([, f]) => pl[f])
      .map(([k, f]) => `<dt>${k}</dt><dd>${esc(pl[f])}</dd>`)
      .join("");
    a(`<article class="play rich"><div class="play-head"><span class="play-n">${i}</span><div><h3>${esc(pl.t)}</h3><p class="play-d">${esc(pl.d)}</p></div></div>
<div class="play-body"><div class="play-main">
${pl.que ? `<h4>Lo que hizo ${esc(NAME)} <span class="pill seen">VISTO</span></h4><p>${esc(pl.que)}</p>` : ""}
${pl.por ? `<h4>Por qué funciona <span class="pill inf">DEDUCIDO</span></h4><p>${esc(pl.por)}</p>` : ""}
<h4>Cómo aplicarlo</h4><ol>${pl.pasos.map((x: string) => `<li>${esc(x)}</li>`).join("")}</ol>
</div><aside class="play-side"><dl>${side}</dl>${pl.ojo ? `<p class="play-ojo"><b>Ojo:</b> ${esc(pl.ojo)}</p>` : ""}</aside></div></article>`);
  });
  a(
    '</div><h3>Cosas para evitar</h3><div class="plays plays3">' +
      N.skip
        .map(
          (s: string[]) =>
            `<div class="play" style="background:var(--grey-soft)"><h3>${esc(s[0])}</h3><p>${esc(s[1])}</p></div>`,
        )
        .join("") +
      "</div></section>",
  );
  a('</div><div class="tip" id="tip" hidden></div>');
  a("<script>const DATA=" + JSON.stringify(data).replace(/</g, "\\u003c") + ";</script>");
  const movesJs = Object.fromEntries(
    (["2025", "2026"] as const).map((y) => [
      y,
      timeline
        .filter((m) => m.season === y)
        .map((m) => ({
          date: fechaLarga(m.date),
          week: +m.week,
          channel: m.channel,
          move: m.move,
        })),
    ]),
  );
  a(js.replace("__MOVES__", JSON.stringify(movesJs).replace(/</g, "\\u003c")));
  a(IX_JS);
  return H.join("\n").replace(NOUSD, "");
}
