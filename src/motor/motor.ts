/* eslint-disable @typescript-eslint/no-explicit-any */
// Motor de informes en la nube: avanza los informes por pasos cortos. Lo llama pg_cron cada 30 segundos
// (ruta /api/public/motor). Cada llamada toma un informe, trabaja hasta ~35 s y guarda dónde quedó.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Almacen } from "./almacen";
import { calcular } from "./calculo";
import { PASOS_DATOS, type Ctx } from "./datos";
import { hoy } from "./fechas";
import { elegirImagenes } from "./imagenes";
import { armarInforme } from "./informe";
import { narrativa } from "./narrativa";
import { ventana } from "./periodo";

const PRESUPUESTO_MS = 35_000;
const BLOQUEO_S = 90;

// Fases en orden y el paso que ven los usuarios en la app.
const FASES: [string, string][] = [
  ["meta", "ads"],
  ["google", "ads"],
  ["tiktokAds", "ads"],
  ["tiktok", "ads"],
  ["instagram", "ads"],
  ["catalogo", "catalog"],
  ["busquedas", "search"],
  ["web", "site"],
  ["calculo", "compute"],
  ["imagenes", "images"],
  ["narrativa", "narrative"],
  ["informe", "report"],
  ["pdf", "pdf"],
];
const PASOS_APP = [
  "ads",
  "catalog",
  "search",
  "site",
  "compute",
  "images",
  "narrative",
  "report",
  "pdf",
];

function slug(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24) || "marca"
  );
}

/** Archivos del motor en el bucket "informes", carpeta motor/<informe>/ (solo el servidor los ve). */
export class AlmacenStorage implements Almacen {
  constructor(
    private db: SupabaseClient,
    private base: string,
  ) {}
  private cache = new Map<string, unknown>();
  async leer(n: string) {
    if (this.cache.has(n)) return this.cache.get(n) as any;
    const { data } = await this.db.storage.from("informes").download(`${this.base}/${n}`);
    if (!data) return null;
    try {
      const v = JSON.parse(await data.text());
      this.cache.set(n, v);
      return v;
    } catch {
      return null;
    }
  }
  async escribir(n: string, d: unknown) {
    this.cache.set(n, d);
    const { error } = await this.db.storage
      .from("informes")
      .upload(`${this.base}/${n}`, JSON.stringify(d), {
        upsert: true,
        contentType: "application/json",
      });
    if (error) throw new Error(`No se pudo guardar ${n}: ${error.message}`);
  }
  async listar(p: string) {
    const i = p.lastIndexOf("/");
    const carpeta = i >= 0 ? p.slice(0, i) : "";
    const pre = p.slice(i + 1);
    const { data } = await this.db.storage
      .from("informes")
      .list(`${this.base}/${carpeta}`, { limit: 1000, search: pre });
    return (data ?? [])
      .map((f) => `${carpeta}/${f.name}`)
      .filter((n) => n.slice(i + 1).startsWith(pre))
      .sort();
  }
}

function aBase64(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Toma un informe pendiente y lo avanza. Devuelve qué hizo (para registro). */
export async function tick(db: SupabaseClient, token: string): Promise<string> {
  const t0 = Date.now();
  const ahora = new Date().toISOString();
  // Informes en cola o en proceso sin bloqueo vigente.
  const { data: cand } = await db
    .from("reports")
    .select("id")
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true })
    .limit(5);
  let job: any = null,
    rep: any = null;
  for (const c of cand ?? []) {
    await db
      .from("report_jobs")
      .upsert({ report_id: c.id }, { onConflict: "report_id", ignoreDuplicates: true });
    const hasta = new Date(Date.now() + BLOQUEO_S * 1000).toISOString();
    const { data: got } = await db
      .from("report_jobs")
      .update({ lock_until: hasta, actualizado: ahora })
      .eq("report_id", c.id)
      .or(`lock_until.is.null,lock_until.lt.${ahora}`)
      .select("*");
    if (got?.length) {
      job = got[0];
      rep = (await db.from("reports").select("*").eq("id", c.id).single()).data;
      break;
    }
  }
  if (!job || !rep) return "sin trabajo";
  const st = job.estado ?? {};
  const steps: Record<string, string> = {
    ...Object.fromEntries(PASOS_APP.map((k) => [k, "pending"])),
    ...(rep.steps ?? {}),
  };
  const guardarEstado = async (extra: Record<string, unknown> = {}) => {
    await db
      .from("report_jobs")
      .update({ estado: st, fase: st.fase ?? 0, actualizado: new Date().toISOString(), ...extra })
      .eq("report_id", rep.id);
    await db
      .from("reports")
      .update({
        steps,
        ...(st.costo != null ? { cost_cop: Math.round(((st.micro ?? 0) / 1e6) * 4000) } : {}),
      })
      .eq("id", rep.id);
  };
  try {
    if (rep.status === "queued")
      await db
        .from("reports")
        .update({ status: "running", worker_id: "nube", started_at: ahora })
        .eq("id", rep.id);
    st.read_date ??= hoy();
    st.fase ??= 0;
    st.micro ??= 0;
    st.costo = true;
    st.cfg ??= (() => {
      const name: string = rep.brand_name;
      const ig = rep.ig_username || slug(name);
      const nl = name.toLowerCase();
      const bf = /oct-nov|_2026-1[12]/.test(rep.period ?? "");
      return {
        key: slug(name) + rep.id.replace(/-/g, "").slice(0, 6),
        name,
        domain: String(rep.domain)
          .replace(/^https?:\/\/(www\.)?/, "")
          .replace(/\/+$/, ""),
        page: String(rep.meta_page_id),
        ig,
        tt: ig,
        q: [
          nl,
          `${nl} colombia`,
          bf ? `${nl} black friday` : `${nl} promoción`,
          `${nl} haul`,
          `${nl} outfit`,
          `${nl} descuento`,
        ],
      };
    })();
    const PER = ventana(rep.period ?? "oct-nov-2026", st.read_date);
    const A = new AlmacenStorage(db, `motor/${rep.id}`);
    const ctx: Ctx = {
      A,
      token,
      PER,
      today: st.read_date,
      cfg: st.cfg,
      st,
      gasto: (m) => {
        st.micro += m;
      },
    };
    while (st.fase < FASES.length && Date.now() - t0 < PRESUPUESTO_MS) {
      const [fase, paso] = FASES[st.fase]!;
      steps[paso] = "running";
      let listo = false;
      if (PASOS_DATOS[fase]) listo = await PASOS_DATOS[fase]!(ctx);
      else if (fase === "calculo") {
        const r = await calcular(
          A,
          {
            key: st.cfg.key,
            name: st.cfg.name,
            domain: st.cfg.domain,
            ig: st.cfg.ig,
            tt: st.cfg.tt,
          },
          PER,
          await A.leer("data/search_weekly.json"),
        );
        await A.escribir("data/calculo.json", r);
        listo = true;
      } else if (fase === "imagenes") {
        const r = await A.leer("data/calculo.json");
        const ya = new Set(await A.listar("img/"));
        const dl = async (url: string, nombre: string) => {
          if (ya.has(nombre + ".json")) return (await A.leer(nombre + ".json")) !== "";
          let uri = "";
          try {
            const resp = await fetch(url, {
              headers: { "User-Agent": "Mozilla/5.0" },
              signal: AbortSignal.timeout(12_000),
            });
            if (resp.ok) {
              const b = await resp.arrayBuffer();
              if (b.byteLength >= 500 && b.byteLength < 1_500_000)
                uri = `data:${resp.headers.get("content-type")?.split(";")[0] || "image/jpeg"};base64,${aBase64(b)}`;
            }
          } catch {
            uri = "";
          }
          await A.escribir(nombre + ".json", uri);
          ya.add(nombre + ".json");
          return uri !== "";
        };
        const PK = await elegirImagenes(
          {
            ads: r.meta_ads,
            tta: r.tiktok_ads,
            ig: r.ig_owned,
            tt: r.tiktok_labeled,
            cat: r.catalog_norm,
            W26: [PER.start["2026"], PER.end["2026"]],
            W25: [PER.start["2025"], PER.end["2025"]],
          },
          dl,
        );
        await A.escribir("data/img_picks.json", PK);
        listo = true;
      } else if (fase === "narrativa") {
        const r = await A.leer("data/calculo.json");
        await A.escribir(
          "data/narrative.json",
          narrativa({
            name: st.cfg.name,
            catalog_note: st.cfg.catalog_note,
            m: r.metrics,
            ig: r.ig_owned,
            tl: r.timeline,
            ads: r.meta_ads,
            ttl: r.tiktok_labeled,
            PER,
          }),
        );
        listo = true;
      } else if (fase === "informe") {
        const r = await A.leer("data/calculo.json"),
          N = await A.leer("data/narrative.json"),
          PK = await A.leer("data/img_picks.json");
        const imgs = new Map<string, string>();
        for (const n of await A.listar("img/"))
          imgs.set(n.replace(/\.json$/, ""), (await A.leer(n)) ?? "");
        const html = armarInforme({
          CFG: {
            name: st.cfg.name,
            ig: st.cfg.ig,
            tt: st.cfg.tt,
            catalog_note: st.cfg.catalog_note,
          },
          PER,
          M: r.metrics,
          N,
          PK,
          vol: r.volume_weekly,
          spend: r.spend_weekly,
          timeline: r.timeline,
          ads: r.meta_ads,
          tta: r.tiktok_ads,
          tt: r.tiktok_labeled,
          ig: r.ig_owned,
          img: (n) => imgs.get(n) ?? "",
        });
        const path = `${rep.user_id}/${rep.id}/report.html`;
        const { error } = await db.storage
          .from("informes")
          .upload(path, html, { upsert: true, contentType: "text/html; charset=utf-8" });
        if (error) throw new Error(`No se pudo subir el informe: ${error.message}`);
        st.html_path = path;
        listo = true;
      } else if (fase === "pdf") {
        listo = true; // el PDF se genera en el navegador desde el informe web (modo impresión)
      }
      if (listo) {
        st.fase++;
        const siguiente = FASES[st.fase]?.[1];
        if (siguiente !== paso) steps[paso] = "done";
      }
      await guardarEstado({ intentos: 0 });
    }
    if (st.fase >= FASES.length) {
      await db
        .from("reports")
        .update({
          status: "done",
          steps,
          html_path: st.html_path,
          pdf_path: null,
          error: null,
          finished_at: new Date().toISOString(),
          cost_cop: Math.round(((st.micro ?? 0) / 1e6) * 4000),
        })
        .eq("id", rep.id);
      await db.from("report_jobs").update({ lock_until: null }).eq("report_id", rep.id);
      return `listo ${rep.id}`;
    }
    await db.from("report_jobs").update({ lock_until: null }).eq("report_id", rep.id);
    return `avanzó ${rep.id} a ${FASES[st.fase]![0]}`;
  } catch (e: any) {
    const intentos = (job.intentos ?? 0) + 1;
    const msg = String(e?.message ?? e).slice(0, 400);
    if (intentos >= 3) {
      const paso = FASES[st.fase ?? 0]?.[1];
      if (paso) steps[paso] = "error";
      await db
        .from("reports")
        .update({
          status: "error",
          steps,
          error: `El motor falló en el paso «${paso}»: ${msg}`,
          finished_at: new Date().toISOString(),
        })
        .eq("id", rep.id);
      await db
        .from("report_jobs")
        .update({ estado: st, intentos, lock_until: null })
        .eq("report_id", rep.id);
      return `error ${rep.id}: ${msg}`;
    }
    await db
      .from("report_jobs")
      .update({ estado: st, intentos, lock_until: null })
      .eq("report_id", rep.id);
    return `reintento ${intentos} ${rep.id}: ${msg}`;
  }
}
