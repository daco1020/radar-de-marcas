/* eslint-disable @typescript-eslint/no-explicit-any */
// Llamadas a treg por HTTP. Devuelven el cuerpo del proveedor y lo que costó (micro-dólares), si treg lo informa.

// Precio por llamada (micro-dólares) cuando la respuesta no trae el cobro; solo para el costo interno.
const PRECIO: Record<string, number> = {
  "anyapi.facebook.company_ads": 4400,
  "scrapecreators.instagram.user.posts": 1880,
  "scrapecreators.tiktok.search.videos": 1880,
  "adyntel.google.ads.transparency": 11000,
  "adyntel.tiktok-ads.library.search.company": 0,
  "dataforseo.x.keywords-data-dataforseo-trends-explore-live": 1250,
  "treg.web.extract": 1000,
};

export type Llamada = { ok: boolean; status: number; body: any; micro: number };

export async function treg(
  token: string,
  tool: string,
  opts: {
    query?: Record<string, string>;
    body?: unknown;
    headers?: Record<string, string>;
    timeoutMs?: number;
  } = {},
): Promise<Llamada> {
  const qs = opts.query ? "?" + new URLSearchParams(opts.query).toString() : "";
  const r = await fetch(`https://treg.to/call/${tool}${qs}`, {
    method: opts.body !== undefined ? "POST" : "GET",
    headers: { "X-Treg-Token": token, "Content-Type": "application/json", ...(opts.headers ?? {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : null,
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
  });
  let body: any = null;
  const txt = await r.text();
  try {
    body = JSON.parse(txt);
  } catch {
    body = { raw: txt.slice(0, 500) };
  }
  const h = r.headers.get("x-treg-charged-micro") ?? r.headers.get("x-treg-charged");
  const micro = h
    ? Number(h) || 0
    : (body?._treg?.charged_micro ?? (r.ok ? (PRECIO[tool] ?? 0) : 0));
  return { ok: r.ok, status: r.status, body, micro };
}
