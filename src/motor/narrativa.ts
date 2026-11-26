/* eslint-disable @typescript-eslint/no-explicit-any */
// Narrativa automática a partir de los datos calculados (sin texto inventado). Copia de informes/scripts/narr_auto.py.
import { tierRate } from "./constantes";
import { MES3, difDias, min, type Fecha } from "./fechas";
import { cita, cop, copr, corte, fecha, masComunes, n, pct, pyRound, ws, xf } from "./formato";
import type { Ventana } from "./periodo";

export type Entradas = {
  name: string;
  catalog_note?: string;
  m: any;
  ig: any[];
  tl: any[];
  ads: any[];
  ttl: any[];
  PER: Ventana;
};

export function narrativa({ name: NAME, catalog_note, m, ig, tl, ads, ttl, PER }: Entradas): any {
  const LEG = PER.legacy,
    TODAY = PER.TODAY,
    WL = PER.wl,
    MESES = PER.meses;
  const W26 = [PER.start["2026"], PER.end["2026"]],
    W25 = [PER.start["2025"], PER.end["2025"]];
  const ig26 = ig.filter((r) => W26[0]! <= r.date && r.date <= W26[1]!),
    ig25 = ig.filter((r) => W25[0]! <= r.date && r.date <= W25[1]!);
  const fin = min(PER.end["2026"], TODAY);
  const RANGO = `entre el ${fecha(PER.start["2026"])} y el ${fecha(fin)}`;
  const BFD: Fecha | null = PER.bf["2026"] != null ? "2026-11-27" : null;
  const EV = BFD ? "del Black Friday" : "de tu fecha comercial más fuerte";
  const SEM = BFD ? "la semana del Black Friday" : "las semanas de mayor venta";
  const CERRADO = (PER.month_end ?? PER.end["2026"]) < TODAY;
  const C = m.catalog ?? null;
  const s26 = m.search["2026"],
    s25 = m.search["2025"];
  const rango = LEG
    ? Array.from({ length: 8 }, (_, i) => -9 + i)
    : Array.from({ length: PER.WMAX - PER.WMIN + 1 }, (_, i) => PER.WMIN + i);
  const w = rango.map(String).filter((i) => s26[i] != null && s25[i] != null);
  const WREF = w.length ? w[w.length - 1]! : "-2";
  const av26 = w.length ? w.reduce((s, i) => s + s26[i], 0) / w.length : null;
  const av25 = w.length ? w.reduce((s, i) => s + s25[i], 0) / w.length : null;
  const med26 = m.ig_median_26,
    med25 = m.ig_median_25;
  const chg = med25 ? pyRound((med26 / med25 - 1) * 100) : null;
  const nv26 = ig26.filter((r) => +r.views).length,
    nv25 = ig25.filter((r) => +r.views).length;
  const small = nv26 < 15 || nv25 < 15;
  const sample = small
    ? ` (muestra chica: ${nv26} publicaciones con vistas en 2026 y ${nv25} en 2025)`
    : "";
  const sp = m.spend_2026;
  const tt_owned = m.tt_views.owned ?? 0,
    tt_cre = m.tt_views.creator ?? 0;
  const dupe_v = (m.tt_views.replica_or_wholesale ?? 0) + (m.tt_views.reseller ?? 0);
  const starts: [string, number][] = m.meta_starts.filter(([d]: [string, number]) => d >= W26[0]!);
  const top_day = starts.length ? starts.reduce((a, b) => (b[1] > a[1] ? b : a)) : null;
  const wl = (k: string, def: string) => WL[+k] ?? def;

  // ---------- calendario ----------
  let cal: [string, string][] = [];
  for (const r of [...ig26.filter((r) => r.tag === "holiday" || r.tag === "offer")].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  )) {
    const cap = corte(ws(r.caption), 150);
    if (!cal.some((c) => c[0] === fecha(r.date) || c[1].includes(corte(cap, 50))))
      cal.push([fecha(r.date), `Instagram: «${cap}»`]);
  }
  for (const t of tl) if (t.season === "2026") cal.push([fecha(t.date), t.move]);
  cal = cal
    .map((c, i) => [c, i] as const)
    .sort((a, b) => {
      const ka = MES3.indexOf(a[0][0].split(" ")[1]!),
        kb = MES3.indexOf(b[0][0].split(" ")[1]!);
      return ka - kb || +a[0][0].split(" ")[0]! - +b[0][0].split(" ")[0]! || a[1] - b[1];
    })
    .map(([c]) => c)
    .slice(0, 12);
  if (!cal.length) cal = [["—", "No se encontraron ofertas ni campañas fechadas en la ventana."]];
  const porFecha = (rows: any[]) =>
    [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const f26 =
    porFecha(ig26).find((r) => r.tag === "offer") ??
    porFecha(ig26).find((r) => r.tag === "holiday") ??
    null;
  const f25 =
    porFecha(ig25).find((r) => r.tag === "offer") ??
    porFecha(ig25).find((r) => r.tag === "holiday") ??
    null;

  // ---------- pruebas ----------
  const g_dem =
    av26 != null && av26 > av25! + 0.1
      ? ["pass", "sí, por encima"]
      : av26 != null && av26 < av25! - 0.15
        ? ["fail", "va abajo, por ahora"]
        : ["mixed", "parecido al año pasado"];
  const owned_cost = (sp["Making owned posts"] ?? [0, 1, 0])[1] || 1;
  const vpd = (med26 * m.ig_posts_26 + tt_owned) / owned_cost / 4;
  const ttv = m.tt_ads
    ? m.tt_ads_views / Math.max((sp["TikTok ads"] ?? [0, 1, 0])[1], 1) / 4
    : null;
  let price_g: [string, string], price_t: string;
  if (C) {
    price_g =
      C.share > 0.6 && C.median_depth >= 0.4
        ? ["fail", "no: descuento profundo"]
        : C.share > 0.3
          ? ["mixed", "mixto"]
          : ["pass", "sí"];
    price_t = `${pct(C.share)} de ${catalog_note ?? "el catálogo"} con precio rebajado; descuento típico ${pct(C.median_depth)}`;
  } else {
    price_g = ["wait", "sin datos"];
    price_t = "no hay catálogo público legible";
  }
  const kept_g =
    dupe_v < 0.1 * Math.max(tt_owned + tt_cre, 1) ? ["pass", "sí"] : ["mixed", "mixto"];
  const barato = vpd >= 15 || (ttv ?? 0) >= 25;
  const tests = [
    [
      "Subió la demanda",
      `búsquedas de la marca, promedio de ${w.length ? wl(w[0]!, "S-9") : "S-9"} a ${wl(WREF, "S-2")}: ${xf(av26)} lo normal (${wl(WREF, "S-2")}: ${xf(s26[WREF])})` +
        (LEG
          ? "; la semana del Black Friday aún no sale"
          : !CERRADO
            ? "; las semanas que aún no terminan no cuentan"
            : ""),
      `mismas semanas de 2025: ${xf(av25)} (${wl(WREF, "S-2")}: ${xf(s25[WREF])})`,
      g_dem[0],
      g_dem[1],
      "media",
    ],
    [
      "El alcance fue barato",
      `contenido propio: unas ${pyRound(vpd)} vistas por cada COP 1.000` +
        (ttv ? `; TikTok impulsado: ${pyRound(ttv)}` : ""),
      "anuncios de Meta: las impresiones no son públicas",
      barato ? "pass" : "mixed",
      barato ? "sí" : "mixto",
      "baja",
    ],
    [
      "Subieron las ventas",
      "catálogo revisado hoy (foto 1)",
      LEG
        ? "una segunda foto después del 30 nov"
        : !CERRADO
          ? "una segunda foto del catálogo al cierre del periodo"
          : "el catálogo de hoy no muestra lo vendido en esos meses",
      "wait",
      "todavía no se sabe",
      "baja",
    ],
    [
      "El gasto se pagó",
      `gasto de ${cop(m.spend_2026_total[0])} a ${cop(m.spend_2026_total[2])}; ventas sin estimar`,
      "1×",
      "wait",
      "todavía no se sabe",
      "baja",
    ],
    ["Se sostuvo el precio", price_t, "precio de lista", price_g[0], price_g[1], "alta"],
    [
      "La demanda se quedó en la marca",
      `TikTok: ${n(tt_owned)} vistas de la cuenta oficial, ${n(tt_cre)} de creadores y ${n(dupe_v)} de revendedores o réplicas`,
      "las unidades no son públicas",
      kept_g[0],
      kept_g[1],
      "baja",
    ],
  ];

  // ---------- lo que funcionó / lo que no ----------
  let worked: string[] = [],
    didnt: string[] = [];
  if (chg != null)
    (chg >= 0 ? worked : didnt).push(
      `Mediana de vistas por publicación en Instagram: ${n(med26)}, frente a ${n(med25)} en 2025 (${chg >= 0 ? "+" : ""}${chg}%)${sample}.`,
    );
  if (av26 != null)
    (g_dem[0] === "pass" ? worked : g_dem[0] === "fail" ? didnt : worked).push(
      `Búsquedas de la marca en ${MESES}: ${xf(av26)} lo normal, frente a ${xf(av25)} en 2025.`,
    );
  if (m.tt_ads)
    worked.push(`${m.tt_ads} videos impulsados en TikTok con ${n(m.tt_ads_views)} reproducciones.`);
  if (tt_cre)
    worked.push(`Creadores en TikTok: ${m.tt_kinds.creator ?? 0} videos con ${n(tt_cre)} vistas.`);
  if (C && price_g[0] === "fail")
    didnt.push(
      `Descuento profundo: ${pct(C.share)} del catálogo rebajado, típico ${pct(C.median_depth)}.`,
    );
  else if (C && price_g[0] === "pass")
    worked.push(`Precio sostenido: solo ${pct(C.share)} del catálogo con descuento.`);
  const ai_n = Object.values(m.ai).filter(Boolean).length;
  (ai_n ? worked : didnt).push(
    `ChatGPT la nombra en ${ai_n} de 3 preguntas de compra de ropa en Colombia.`,
  );
  if (m.ig_posts_26 < m.ig_posts_25 * 0.85)
    didnt.push(
      `Publicó menos en Instagram: ${m.ig_posts_26} contra ${m.ig_posts_25} en los mismos días de 2025.`,
    );
  if (m.meta_total && m.meta_total !== m.meta_ads)
    didnt.push(
      `Solo se pudieron descargar ${m.meta_ads} de los ${m.meta_total} anuncios que reporta la biblioteca de Meta.`,
    );
  worked = worked.slice(0, 3);
  didnt = didnt.slice(0, 3);
  if (!worked.length) worked = ["Todavía no hay una señal medible a favor."];
  if (!didnt.length) didnt = ["Todavía no hay una señal medible en contra."];

  // ---------- jugadas ----------
  const KIND_ES: Record<string, string> = {
    holiday: "de temporada",
    offer: "de oferta",
    launch: "de lanzamiento",
    brand: "de marca",
  };
  const FMT_ES: Record<string, string> = {
    DCO: "dinámicos (varias piezas que Meta combina)",
    IMAGE: "de imagen",
    VIDEO: "de video",
    CAROUSEL: "en carrusel",
  };
  const cuenta = (xs: string[], nombres: Record<string, string>) =>
    masComunes(xs)
      .filter(([, v]) => v)
      .map(([k, v]) => `${v} ${nombres[k] ?? String(k).toLowerCase()}`)
      .join(", ");
  let plays: any[] = [];
  if (top_day && top_day[1] >= 10) {
    const dia = ads.filter((a) => String(a.start).startsWith(top_day[0]));
    const land = masComunes(
      dia
        .filter((a) => a.landing)
        .map(
          (a) =>
            String(a.landing)
              .replace(/^https?:\/\/(www\.)?/, "")
              .split("?")[0]!,
        ),
    ).slice(0, 2);
    const ej = [
      ...new Set(dia.filter((a) => String(a.text ?? "").trim()).map((a) => cita(a.text, 110))),
    ].slice(0, 2);
    const faltan = BFD && top_day[0] <= BFD ? difDias(BFD, top_day[0]) : null;
    const nn = top_day[1];
    plays.push({
      t: "Una tanda grande de anuncios en un solo día",
      d:
        `${NAME} no fue soltando anuncios de a poco: el ${fecha(top_day[0])}` +
        (faltan != null ? `, ${faltan} días antes del Black Friday,` : "") +
        ` publicó ${nn} anuncios nuevos en Meta el mismo día.`,
      que:
        `De esos ${nn} anuncios, ${cuenta(
          dia.map((a) => a.kind),
          KIND_ES,
        )}. Por formato: ${cuenta(
          dia.map((a) => a.format),
          FMT_ES,
        )}. ` +
        (land.length
          ? `La mayoría lleva a ${land
              .map((l) => l[0])
              .filter(Boolean)
              .join(" y ")}. `
          : "") +
        (ej.length ? `Ejemplos de texto: ${ej.join(" / ")}.` : ""),
      por: `Lanzar muchas variantes a la vez le da a Meta material para probar en paralelo y mostrar la que mejor responde a cada persona, justo cuando la gente empieza a comparar precios antes ${EV}. Al concentrar el lanzamiento, la marca aparece de golpe en todos los formatos y no a cuentagotas.`,
      pasos: [
        "Prepara de 10 a 20 piezas alrededor de la misma oferta: cambia la imagen, el titular y el formato (imagen, video corto y anuncio dinámico), no la promesa.",
        `Lánzalas el mismo día, entre 7 y 10 días antes ${EV}` +
          (faltan != null ? `; ${NAME} lo hizo ${faltan} días antes.` : "."),
        "Agrúpalas en pocas campañas para que el presupuesto no quede repartido en exceso y cada una alcance a acumular resultados.",
        "A los 3 días apaga las piezas que no consiguen clics ni compras y pasa ese presupuesto a las 3 o 4 mejores.",
      ],
      costo: `Con las tarifas del informe, ${nn} anuncios activos cuestan unos ${copr(8 * nn, 62 * nn)} por día (valor medio ${cop(23 * nn)}). Una prueba más pequeña, con 10 anuncios durante 10 días, ronda ${copr(8 * 10 * 10, 62 * 10 * 10)}.`,
      e: `${nn} anuncios nuevos el ${fecha(top_day[0])} (biblioteca de anuncios de Meta)`,
      w: `Entre 7 y 10 días antes ${EV}`,
      f: "Medio: diseño de 10 a 20 piezas y seguimiento diario",
      m: "Costo por compra y por clic de cada pieza; cuántas piezas concentran el 80% de las ventas",
      ojo: "Con poco presupuesto, muchas piezas reparten tan poco dinero que ninguna junta datos suficientes. Si el presupuesto es corto, mejor 5 piezas bien hechas que 40.",
    });
  }
  if (m.tt_ads && m.tt_ads_views)
    plays.push({
      t: "Impulsar en TikTok los videos propios",
      d: `${NAME} pagó para empujar ${m.tt_ads} de sus propios videos en TikTok, que sumaron ${n(m.tt_ads_views)} reproducciones.`,
      que: `En lugar de producir anuncios aparte, tomó videos que ya había publicado y les puso pauta. Son ${m.tt_ads} videos impulsados con ${n(m.tt_ads_views)} reproducciones en total, unas ${n(m.tt_ads_views / m.tt_ads)} por video.`,
      por: "Un video que ya funcionó sin pauta tiene el gancho probado: impulsarlo es más barato y más seguro que producir una pieza nueva y apostar a que funcione.",
      pasos: [
        "Revisa tus videos de los últimos 60 días y elige los 3 a 5 con más vistas o comentarios.",
        "Impúlsalos como anuncio (en TikTok, con la opción de promocionar o con anuncios Spark) hacia la página de la oferta.",
        "Deja correr cada uno 4 o 5 días con un presupuesto diario igual y compara el costo por cada 1.000 reproducciones.",
        `Repite con los ganadores durante ${SEM}.`,
      ],
      costo: `Con las tarifas del informe, cada video impulsado cuesta unos ${copr(8, 62)} por día; ${m.tt_ads} videos durante una semana: ${copr(8 * 7 * m.tt_ads, 62 * 7 * m.tt_ads)}.`,
      e: `${m.tt_ads} videos impulsados, ${n(m.tt_ads_views)} reproducciones`,
      w: BFD
        ? "Toda la temporada, y más fuerte la semana del Black Friday"
        : "Todo el periodo, y más fuerte en las semanas de mayor venta",
      f: "Bajo: los videos ya existen",
      m: "Reproducciones y clics por cada COP 1.000",
      ojo: "Impulsar un video flojo solo compra vistas caras. Si en 3 días no supera tu promedio, cámbialo.",
    });
  const cre = ttl
    .filter((r) => r.kind === "creator")
    .sort((a, b) => (+b.views || 0) - (+a.views || 0));
  if (tt_cre && cre.length) {
    const top = cre.slice(0, 3);
    const fol = new Map<string, number>(cre.map((r) => [r.author, +r.followers || 0]));
    const chicos = [...fol.values()].filter((f) => f < 100_000).length;
    const lo = top.reduce((s, r) => s + tierRate(+r.followers || 0)[0], 0),
      hi = top.reduce((s, r) => s + tierRate(+r.followers || 0)[2], 0);
    const lista = top
      .map(
        (r) =>
          `@${r.author} (${n(r.followers)} seguidores): ${n(r.views)} vistas, ${cita(r.desc, 70)}`,
      )
      .join("; ");
    plays.push({
      t: "Creadores que muestren la marca en primera persona",
      d: `En TikTok, ${cre.length} videos de creadores que nombran o etiquetan a ${NAME} sumaron ${n(tt_cre)} vistas, frente a ${n(tt_owned)} de la cuenta oficial.`,
      que: `Los videos con más vistas: ${lista}. ${chicos} de los ${fol.size} creadores tienen menos de 100.000 seguidores: no hace falta una celebridad para mover la marca.`,
      por: "La gente confía más en alguien que cuenta su propia compra que en un anuncio. El video de creador además se ve como contenido normal de TikTok, así que se ve completo y no se salta.",
      pasos: [
        "Busca de 5 a 10 creadores de tu categoría con 5.000 a 100.000 seguidores y buena conversación en comentarios.",
        "Dales un guion corto, no un libreto: la oferta, un código de descuento propio de cada uno y la consigna de mostrar la compra o el producto en uso.",
        "Pide permiso para usar el video como anuncio (código de anuncio Spark) y así impulsar los que mejor funcionen.",
        "Escalona las publicaciones en las 2 o 3 semanas antes del Black Friday para no gastar todo en un mismo día.",
      ],
      costo: `Con las tarifas del informe por tamaño de cuenta, contratar a los 3 creadores de arriba costaría unos ${copr(lo, hi)}. Un creador de 10.000 a 100.000 seguidores cobra unos ${copr(125, 750)} por video.`,
      e: `${cre.length} videos, ${n(tt_cre)} vistas (búsquedas en TikTok)`,
      w: `De 2 a 3 semanas antes ${EV}`,
      f: "Medio: buscar, negociar y revisar cada video",
      m: "Vistas y ventas con el código de cada creador por cada COP 1.000 pagados, frente a los anuncios",
      ojo: "Sin código propio por creador no sabrás quién vendió. Y si el video se siente como anuncio leído, pierde la ventaja.",
    });
  }
  if (m.meta_whatsapp) {
    const ejw = ads
      .filter((a) => (a.whatsapp === true || a.whatsapp === "True") && String(a.text ?? "").trim())
      .map((a) => cita(a.text, 100))
      .slice(0, 2);
    plays.push({
      t: "Anuncios que abren un chat de WhatsApp",
      d: `${m.meta_whatsapp} de los ${m.meta_ads} anuncios de ${NAME} en Meta llevan directo a una conversación de WhatsApp.`,
      que:
        "En vez de mandar a la web, el botón abre un chat con la marca." +
        (ejw.length ? ` Ejemplos: ${ejw.join(" / ")}.` : ""),
      por: "En Colombia mucha gente prefiere preguntar antes de comprar. El chat resuelve dudas de talla, stock o envío en el momento y evita que la persona abandone la compra en la web.",
      pasos: [
        "Activa WhatsApp Business con respuestas rápidas para precio, tallas, envío y medios de pago.",
        "Crea anuncios con el botón «Enviar mensaje» hacia WhatsApp para las ofertas de mayor valor.",
        "Define quién responde y en cuánto tiempo: menos de 10 minutos en horario de oferta.",
        "Anota en cada chat si terminó en pedido para medir la tasa de cierre.",
      ],
      costo: `El anuncio cuesta lo mismo que cualquier otro (unos ${copr(8, 62)} por día con las tarifas del informe); el costo extra es la persona que atiende los chats.`,
      e: `${m.meta_whatsapp} de ${m.meta_ads} anuncios`,
      w: "Con los anuncios de oferta",
      f: "Bajo en pauta, medio en atención",
      m: "Chats abiertos, pedidos cerrados por chat y tiempo de respuesta",
      ojo: "Si nadie contesta rápido, el anuncio paga conversaciones que se enfrían. Mejor no activarlo que atender tarde.",
    });
  }
  if (m.ig_collabs_26) {
    const col = ig26.filter((r) => r.coauthors).sort((a, b) => (+b.views || 0) - (+a.views || 0));
    const vis = col.map((r) => +r.views || 0).sort((a, b) => a - b);
    const medc = vis.length ? vis[Math.floor(vis.length / 2)]! : 0;
    const socios = masComunes(
      col.flatMap((r) =>
        String(r.coauthors)
          .split(/[;,|]/)
          .map((c) => c.trim())
          .filter(Boolean),
      ),
    );
    const lista = col
      .slice(0, 3)
      .map(
        (r) =>
          `con @${String(r.coauthors).split(/[;,|]/)[0]!.trim()} el ${fecha(r.date)}: ${n(r.views || 0)} vistas, ${cita(r.caption, 70)}`,
      )
      .join("; ");
    plays.push({
      t: "Publicaciones en coautoría",
      d: `${NAME} hizo ${m.ig_collabs_26} publicaciones de Instagram en coautoría con otras cuentas ${RANGO}.`,
      que:
        `Sus socios más frecuentes: ${socios
          .slice(0, 4)
          .map(([k]) => "@" + k)
          .join(", ")}. Las de más vistas: ${lista}. ` +
        `La mediana de estas publicaciones es ${n(medc)} vistas, frente a ${n(med26)} de todas sus publicaciones.`,
      por: "Una coautoría aparece en el perfil y en el feed de las dos cuentas a la vez, así que la marca llega a la audiencia del socio sin pagar pauta. Funciona mejor con socios que ya hablan con tu mismo cliente: un programa de puntos, una marca aliada o un creador.",
      pasos: [
        "Haz una lista de 5 a 10 cuentas que le hablan a tu cliente pero no compiten contigo: marcas aliadas, medios de pago, programas de puntos o creadores.",
        "Propón un contenido que sirva a los dos: una receta, un lanzamiento conjunto o un beneficio exclusivo para sus seguidores.",
        "Publica con la función de colaboración de Instagram (invitar como coautor) para que salga en ambos perfiles.",
        "Programa 1 o 2 coautorías por semana durante la temporada y compara sus vistas con tu mediana.",
      ],
      costo:
        "Con marcas aliadas suele ser un intercambio sin pago. Con creadores, las tarifas del informe van de COP 3 millones a COP 10 millones por publicación conjunta, según el tamaño de la cuenta.",
      e: `${m.ig_collabs_26} publicaciones en coautoría; mediana de ${n(medc)} vistas`,
      w: "Durante toda la temporada, 1 o 2 por semana",
      f: "Medio: coordinar con otra cuenta",
      m: "Vistas y seguidores nuevos frente a tu mediana de publicaciones",
      ojo:
        (medc < med26
          ? `En ${NAME}, la mediana de las coautorías (${n(medc)}) quedó por debajo de la de todas sus publicaciones (${n(med26)}): no todo socio suma. `
          : "") +
        "Una coautoría con una cuenta que no comparte tu público suma vistas, pero no compradores. Elige al socio por afinidad, no solo por tamaño.",
    });
  }
  plays = plays.slice(0, 4);
  if (!plays.length)
    plays = LEG
      ? [
          {
            t: "Medir de nuevo después del 30 nov",
            d: "Repetir la foto del catálogo para ver qué se vendió.",
            e: "Foto 1 del 24 nov",
            w: "1 dic",
            f: "Bajo",
            m: "Productos agotados",
          },
        ]
      : [
          {
            t: "Medir de nuevo en unas semanas",
            d: "Repetir la lectura de anuncios, redes y catálogo para ver qué cambió.",
            e: `Lectura del ${fecha(TODAY)}`,
            w: "En 3 o 4 semanas",
            f: "Bajo",
            m: "Anuncios nuevos, vistas y productos agotados",
          },
        ];
  let skip: [string, string][] = [];
  if (C && price_g[0] === "fail")
    skip.push([
      "Descuentos profundos en casi todo",
      "Enseñan a esperar la temporada para comprar.",
    ]);
  if (chg != null && chg < -20 && !small)
    skip.push(["Bajar el ritmo en Instagram", `La mediana de vistas cayó ${Math.abs(chg)}%.`]);
  if (!m.ig_first_holiday_26)
    skip.push(["Dejar Instagram sin la campaña", "No hay publicaciones de temporada en 2026."]);
  skip = skip.slice(0, 2);
  if (!skip.length)
    skip = LEG
      ? [
          [
            "Sacar conclusiones antes del 11 dic",
            "Las ventas solo se pueden leer con la segunda foto del catálogo.",
          ],
        ]
      : !CERRADO
        ? [
            [
              "Sacar conclusiones antes de cerrar el periodo",
              "Las ventas solo se pueden leer con una segunda foto del catálogo.",
            ],
          ]
        : [
            [
              "Leer las ventas con el catálogo de hoy",
              "El catálogo actual no muestra lo que se vendió en esos meses.",
            ],
          ];

  const kinds = m.meta_kinds;
  const k = (x: string) => kinds[x] ?? 0,
    t26 = (x: string) => m.ig_tags_26[x] ?? 0;
  const hero =
    `${NAME} tiene ${m.meta_ads} anuncios activos en Meta` +
    (m.meta_total && m.meta_total !== m.meta_ads
      ? ` (de los ${m.meta_total} que reporta la biblioteca)`
      : "") +
    `: ${k("holiday")} de temporada, ${k("offer")} de oferta y ${k("launch")} de lanzamiento. ` +
    (top_day
      ? `El día con más anuncios nuevos fue el ${fecha(top_day[0])} (${top_day[1]}). `
      : "") +
    `En Instagram publicó ${m.ig_posts_26} veces ${RANGO} (${m.ig_posts_25} en 2025), con una mediana de ${n(med26)} vistas. ` +
    (C
      ? `${pct(C.share)} de su catálogo revisado tiene precio rebajado, con un descuento típico de ${pct(C.median_depth)}.`
      : "No tiene un catálogo público legible.");
  const bf25 = PER.bf["2025"];
  const s25vals = Object.values(s25).filter((v) => v != null) as number[];
  const res25v =
    bf25 != null
      ? s25[String(bf25)]
      : s25vals.length
        ? s25vals.reduce((a, b) => (b > a ? b : a))
        : null;
  return {
    hero,
    verdict_line:
      "Informe generado automáticamente a partir de los datos." +
      (LEG
        ? " Lectura final después del 30 nov."
        : !CERRADO
          ? ` Lectura final después del ${fecha(PER.month_end!)}.`
          : ""),
    kpi_ads_note: top_day ? `${top_day[1]} lanzados el ${fecha(top_day[0])}` : "",
    kpi_cat_note: C ? `${n(C.discounted)} de ${n(C.products)}; típico ${pct(C.median_depth)}` : "",
    prep26: f26 ? fecha(f26.date) : "no visto",
    prep26_note: f26 ? corte(ws(f26.caption), 90) : "Sin publicaciones de oferta en Instagram",
    prep25: f25 ? fecha(f25.date) : "no visto",
    prep25_note: f25 ? corte(ws(f25.caption), 90) : "Sin publicaciones de oferta en Instagram",
    res25: `Búsquedas a ${xf(res25v)}`,
    res25_note:
      bf25 != null ? "la semana del Black Friday 2025" : `su mejor semana de ${MESES} 2025`,
    calendar: cal,
    calendar_note:
      "Fechas tomadas de las publicaciones de Instagram, los anuncios de Meta y la web. Las citas de Instagram van tal como las publicó la marca.",
    channels: {},
    offer_tiles: [
      [
        "Web propia",
        C && C.share > 0.2 ? "Sí" : C ? "No" : "Sin datos",
        C ? `${pct(C.share)} rebajado` : "sin catálogo",
      ],
      [
        "Anuncios en Meta",
        k("holiday") + k("offer") ? "Sí" : "No",
        `${k("holiday") + k("offer")} de ${m.meta_ads}`,
      ],
      [
        "Instagram",
        t26("holiday") + t26("offer") ? "Sí" : "No",
        `${t26("holiday") + t26("offer")} publicaciones`,
      ],
      ["TikTok", m.tt_ads ? "Sí" : "No", `${m.tt_ads} videos impulsados`],
      ["WhatsApp", m.meta_whatsapp ? "Sí" : "No", `${m.meta_whatsapp} anuncios`],
      ["Google", m.google_live ? "Sí" : "No", `${m.google_live} anuncios activos`],
    ],
    patterns: [
      `Mensajes en Meta: ${k("holiday")} de temporada, ${k("offer")} de oferta, ${k("launch")} de lanzamiento y ${k("brand")} de marca.`,
      `Instagram 2026: ${t26("launch")} lanzamientos, ${t26("offer")} ofertas y ${t26("holiday")} de temporada.`,
      `Primera publicación de temporada: ${m.ig_first_holiday_26 ? fecha(m.ig_first_holiday_26) : "ninguna en 2026"}; en 2025: ${m.ig_first_holiday_25 ? fecha(m.ig_first_holiday_25) : "ninguna"}.`,
    ],
    tests,
    worked,
    didnt,
    plays,
    skip,
    method_extra:
      "Texto generado automáticamente: cada frase sale de los datos descargados, sin interpretación manual.",
  };
}
