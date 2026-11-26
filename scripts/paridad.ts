// Compara el motor TypeScript con el de Python sobre un informe ya generado en local.
// Uso: bun scripts/paridad.ts <carpeta del informe> <clave>
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import type { Almacen } from "../src/motor/almacen";
import { calcular } from "../src/motor/calculo";
import { ventana } from "../src/motor/periodo";

const [dir, key] = process.argv.slice(2) as [string, string];
const brands = JSON.parse(readFileSync(join(dir, "..", "_multi", "brands.json"), "utf8"));
const cfg = brands[key];
class Disco implements Almacen {
  async leer(n: string) {
    const p = join(dir, n);
    return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
  }
  async escribir() {}
  async listar(pref: string) {
    const [d, f] = pref.split("/");
    return readdirSync(join(dir, d!))
      .filter((x) => x.startsWith(f!) && x.endsWith(".json"))
      .sort()
      .map((x) => `${d}/${x}`);
  }
}
function csv(p: string) {
  if (!existsSync(p)) return null;
  const [h, ...ls] = readFileSync(p, "utf8").trim().split(/\r?\n/);
  const ks = h!.split(",");
  return ls.map((l) => Object.fromEntries(l.split(",").map((v, i) => [ks[i], v])));
}
const PER = ventana(cfg.period ?? "oct-nov-2026", cfg.read_date ?? "2026-11-24");
const r = await calcular(
  new Disco(),
  { key, name: cfg.name, domain: cfg.domain, ig: cfg.ig, tt: cfg.tt, name_rx: cfg.name_rx },
  PER,
  csv(join(dir, "data/search_weekly.csv")),
);
const py = JSON.parse(readFileSync(join(dir, "data/metrics.json"), "utf8"));
let dif = 0;
for (const k of new Set([...Object.keys(py), ...Object.keys(r.metrics)])) {
  const a = JSON.stringify(py[k]),
    b = JSON.stringify(r.metrics[k]);
  if (a !== b) {
    dif++;
    console.log("DIF", k, "\n  py:", a?.slice(0, 300), "\n  ts:", b?.slice(0, 300));
  }
}
const pyVol = csv(join(dir, "data/volume_weekly.csv"))!,
  pySp = csv(join(dir, "data/spend_weekly.csv"))!;
const same = (x: any[], y: any[], f: (o: any) => string) =>
  JSON.stringify(x.map(f)) === JSON.stringify(y.map(f));
console.log(
  "volume_weekly",
  same(pyVol, r.volume_weekly, (o) => [o.season, o.week, o.channel, o.units, o.views].join("|"))
    ? "igual"
    : "DISTINTO",
  pyVol.length,
  r.volume_weekly.length,
);
console.log(
  "spend_weekly",
  same(pySp, r.spend_weekly, (o) => [o.season, o.week, o.type, o.low, o.mid, o.high].join("|"))
    ? "igual"
    : "DISTINTO",
  pySp.length,
  r.spend_weekly.length,
);
const pyTl = csv(join(dir, "data/timeline.csv"))!;
console.log(
  "timeline",
  pyTl.length,
  r.timeline.length,
  same(pyTl, r.timeline, (o) => [o.date, o.season, o.week, o.channel].join("|"))
    ? "igual"
    : "DISTINTO",
);
console.log(dif ? `${dif} métricas distintas` : "métricas iguales");
for (let i = 0; i < pySp.length; i++) {
  const a = pySp[i],
    b = r.spend_weekly[i];
  const ka = [a.season, a.week, a.type, a.low, a.mid, a.high].join("|"),
    kb = [b.season, b.week, b.type, b.low, b.mid, b.high].join("|");
  if (ka !== kb) {
    console.log("py", ka, "\nts", kb);
    break;
  }
}
import { narrativa } from "../src/motor/narrativa";
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
const pyN = JSON.parse(readFileSync(join(dir, "data/narrative.json"), "utf8"));
let nd = 0;
for (const k of new Set([...Object.keys(pyN), ...Object.keys(N)])) {
  const a = JSON.stringify(pyN[k]),
    b = JSON.stringify(N[k]);
  if (a !== b) {
    nd++;
    let i = 0;
    while (i < Math.min(a?.length ?? 0, b?.length ?? 0) && a![i] === b![i]) i++;
    console.log(
      "NARR DIF",
      k,
      "\n  py:",
      a?.slice(Math.max(0, i - 80), i + 120),
      "\n  ts:",
      b?.slice(Math.max(0, i - 80), i + 120),
    );
  }
}
console.log(nd ? `${nd} campos de narrativa distintos` : "narrativa igual");
import { elegirImagenes } from "../src/motor/imagenes";
import { armarInforme } from "../src/motor/informe";
const imgs = new Map<string, string>();
const dl = async (_url: string, nombre: string) => {
  const p = join(dir, nombre);
  if (!existsSync(p)) return false;
  imgs.set(nombre, "data:image/jpeg;base64," + readFileSync(p).toString("base64"));
  return true;
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
const pyPK = JSON.parse(readFileSync(join(dir, "data/img_picks.json"), "utf8"));
console.log(
  "picks",
  JSON.stringify(
    Object.fromEntries(
      Object.entries(PK).map(([k, v]: any) => [
        k,
        k === "products" ? v.map((x: any) => x.name) : v,
      ]),
    ),
  ) ===
    JSON.stringify(
      Object.fromEntries(
        Object.entries(pyPK).map(([k, v]: any) => [
          k,
          k === "products" ? v.map((x: any) => x.name) : v,
        ]),
      ),
    )
    ? "iguales"
    : "DISTINTOS",
);
const html = armarInforme({
  CFG: { name: cfg.name, ig: cfg.ig, tt: cfg.tt, catalog_note: cfg.catalog_note },
  PER,
  M: r.metrics,
  N,
  PK: pyPK,
  vol: r.volume_weekly,
  spend: r.spend_weekly,
  timeline: r.timeline,
  ads: r.meta_ads,
  tta: r.tiktok_ads,
  tt: r.tiktok_labeled,
  ig: r.ig_owned,
  img: (n) => imgs.get(n) ?? "",
});
const pyH = readFileSync(join(dir, "report.html"), "utf8");
const texto = (h: string) =>
  h
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
const ta = texto(pyH),
  tb = texto(html);
if (ta === tb) console.log("texto del informe igual", ta.length);
else {
  let i = 0;
  while (i < Math.min(ta.length, tb.length) && ta[i] === tb[i]) i++;
  console.log(
    "TEXTO DISTINTO en",
    i,
    "\n  py:",
    ta.slice(i - 100, i + 150),
    "\n  ts:",
    tb.slice(i - 100, i + 150),
  );
}
const dPy = JSON.parse(/const DATA=(\{.*?\});<\/script>/s.exec(pyH)![1]!),
  dTs = JSON.parse(/const DATA=(\{.*?\});<\/script>/s.exec(html)![1]!.replace(/\\u003c/g, "<"));
const dd = Object.keys(dPy).filter((k) => JSON.stringify(dPy[k]) !== JSON.stringify(dTs[k]));
console.log(dd.length ? "DATA distinto en " + dd.join(", ") : "DATA igual");
const imgsPy = (pyH.match(/<img src="data:/g) ?? []).length,
  imgsTs = (html.match(/<img src="data:/g) ?? []).length;
console.log("imágenes embebidas", imgsPy, imgsTs);
