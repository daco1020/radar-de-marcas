// Corre el motor TypeScript completo en este computador, usando el CLI de treg en vez de HTTP.
// Uso: bun scripts/motor_local.ts <carpeta salida> <marca> <dominio> <page_id> <ig> <periodo>
import { execFileSync } from "child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { dirname, join } from "path";
import type { Almacen } from "../src/motor/almacen";
import { calcular } from "../src/motor/calculo";
import { PASOS_DATOS, type Ctx } from "../src/motor/datos";
import { elegirImagenes } from "../src/motor/imagenes";
import { armarInforme } from "../src/motor/informe";
import { narrativa } from "../src/motor/narrativa";
import { ventana } from "../src/motor/periodo";

const [dir, name, domain, page, ig, period] = process.argv.slice(2) as string[];
class Disco implements Almacen {
  async leer(n: string) {
    const p = join(dir!, n);
    return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
  }
  async escribir(n: string, d: unknown) {
    const p = join(dir!, n);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(d));
  }
  async listar(pref: string) {
    const [d, f] = pref.split("/");
    const p = join(dir!, d!);
    return existsSync(p)
      ? readdirSync(p)
          .filter((x) => x.startsWith(f!))
          .sort()
          .map((x) => `${d}/${x}`)
      : [];
  }
}
const cli = async (_t: string, tool: string, o: any = {}) => {
  const args = ["--json", "call", tool];
  for (const [k, v] of Object.entries(o.query ?? {})) args.push("--query", `${k}=${v}`);
  if (o.body !== undefined) args.push("--method", "POST", "--data", JSON.stringify(o.body));
  for (const [k, v] of Object.entries(o.headers ?? {})) args.push("--header", `${k}: ${v}`);
  const out = execFileSync(`${process.env.HOME}/.local/bin/treg`, args, {
    encoding: "utf8",
    maxBuffer: 64e6,
  });
  const j = JSON.parse(out);
  return {
    ok: (j._treg?.http_status ?? 200) < 400,
    status: j._treg?.http_status ?? 200,
    body: j.result,
    micro: j._treg?.charged_micro ?? 0,
  };
};
const A = new Disco();
const today = new Date().toISOString().slice(0, 10);
const PER = ventana(period!, today);
const nl = name!.toLowerCase();
const st: any = {};
const cfg = {
  key: "prueba",
  name: name!,
  domain: domain!,
  page: page!,
  ig: ig!,
  tt: ig!,
  q: [nl, `${nl} colombia`, `${nl} promoción`, `${nl} haul`, `${nl} outfit`, `${nl} descuento`],
} as any;
let micro = 0;
const ctx: Ctx = {
  A,
  token: "",
  PER,
  today,
  cfg,
  st,
  gasto: (m) => {
    micro += m;
  },
  llamar: cli as any,
};
for (const f of [
  "meta",
  "google",
  "tiktokAds",
  "tiktok",
  "instagram",
  "catalogo",
  "busquedas",
  "web",
]) {
  let n = 0;
  const t = Date.now();
  while (!(await PASOS_DATOS[f]!(ctx))) n++;
  console.log(f, "listo,", n + 1, "llamadas,", ((Date.now() - t) / 1000).toFixed(1), "s");
}
const r = await calcular(A, cfg, PER, await A.leer("data/search_weekly.json"));
const imgs = new Map<string, string>();
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
  async (url, nombre) => {
    try {
      const x = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!x.ok) return false;
      const b = Buffer.from(await x.arrayBuffer());
      if (b.length < 500) return false;
      imgs.set(
        nombre,
        `data:${x.headers.get("content-type") || "image/jpeg"};base64,` + b.toString("base64"),
      );
      return true;
    } catch {
      return false;
    }
  },
);
const N = narrativa({
  name: cfg.name,
  catalog_note: cfg.catalog_note,
  m: r.metrics,
  ig: r.ig_owned,
  tl: r.timeline,
  ads: r.meta_ads,
  ttl: r.tiktok_labeled,
  PER,
});
const html = armarInforme({
  CFG: cfg,
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
writeFileSync(join(dir!, "report.html"), html);
console.log(
  "informe",
  Math.round(html.length / 1024),
  "KB · imágenes",
  imgs.size,
  "· costo COP",
  Math.round((micro / 1e6) * 4000),
);
console.log(
  JSON.stringify({
    meta_ads: r.metrics.meta_ads,
    ig_26: r.metrics.ig_posts_26,
    ig_25: r.metrics.ig_posts_25,
    tt: r.metrics.tt_kinds,
    cat: r.metrics.catalog?.products ?? null,
    search: Object.values(r.metrics.search["2026"]).filter((v) => v != null).length,
  }),
);
