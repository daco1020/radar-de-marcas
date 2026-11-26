import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extraerRedes, enlaceFacebook, ordenar, type Candidato, type Redes } from "@/lib/redes";

export type { Candidato, Redes };

const BUSCAR = "scrapecreators.x.v1-facebook-adlibrary-search-companies";
const PERFIL = "scrapecreators.x.v1-facebook-profile";

type Resultado = {
  page_id?: string | number;
  name?: string;
  category?: string | null;
  ig_username?: string | null;
  ig_followers?: number | null;
  likes?: number | null;
};
type Respuesta = {
  result?: Respuesta;
  searchResults?: Resultado[];
  adLibrary?: { pageId?: string | number };
  pageId?: string | number;
  name?: string;
  category?: string | null;
  likeCount?: number;
  followerCount?: number;
};

function token() {
  return process.env["TREG"] ?? process.env["TREG_TOKEN"];
}

async function treg(tool: string, params: Record<string, string>): Promise<Respuesta | null> {
  const t = token();
  if (!t) throw new Error("Falta configurar el secreto TREG.");
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`https://treg.to/call/${tool}?${qs}`, {
    headers: { "X-Treg-Token": t, "X-Treg-Route-Max-Cost": "0.01" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!r.ok) return null;
  const body = (await r.json()) as Respuesta;
  return body?.result ?? body;
}

/** Lee la portada de la web de la marca y saca sus redes. Nunca falla: si no se puede leer, devuelve todo en null. */
async function redesDeLaWeb(domain: string): Promise<Redes> {
  const vacio: Redes = { facebook: null, instagram: null, tiktok: null };
  if (
    !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) ||
    /(^|\.)(local|localhost|internal|lan|home|corp)$/i.test(domain)
  )
    return vacio;
  for (const url of [`https://${domain}/`, `https://www.${domain}/`]) {
    try {
      const r = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/131 Safari/537.36",
          Accept: "text/html",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(8_000),
      });
      if (!r.ok) continue;
      const html = (await r.text()).slice(0, 3_000_000);
      const redes = extraerRedes(html);
      if (redes.facebook || redes.instagram) return redes;
    } catch {
      /* web caída o lenta: se sigue con la búsqueda por nombre */
    }
  }
  return vacio;
}

/** Convierte un enlace de Facebook en la página que usa la biblioteca de anuncios de Meta. */
async function paginaDesdeFacebook(url: string, ig: string | null): Promise<Candidato | null> {
  const p = await treg(PERFIL, { url }).catch(() => null);
  const pageId = p?.adLibrary?.pageId ?? p?.pageId ?? null;
  if (!pageId) return null;
  return {
    page_id: String(pageId),
    name: String(p?.name ?? url),
    category: p?.category ?? null,
    ig_username: ig,
    ig_followers: 0,
    likes: Number(p?.likeCount ?? p?.followerCount ?? 0),
    origen: "web",
    coincide: true,
  };
}

export const buscarCuentas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; domain?: string }) => ({
    name: String(d?.name ?? "").trim(),
    domain: String(d?.domain ?? "")
      .trim()
      .toLowerCase(),
  }))
  .handler(async ({ data }): Promise<{ candidates: Candidato[]; redes: Redes; error?: string }> => {
    const vacio: Redes = { facebook: null, instagram: null, tiktok: null };
    const name = data.name;
    if (name.length < 2 || name.length > 80)
      return {
        candidates: [],
        redes: vacio,
        error: "Escribe el nombre de la marca (2 a 80 caracteres).",
      };
    if (!token())
      return { candidates: [], redes: vacio, error: "Falta configurar el secreto TREG." };

    // La web y la búsqueda por nombre van en paralelo.
    const [redes, busqueda] = await Promise.all([
      data.domain ? redesDeLaWeb(data.domain) : Promise.resolve(vacio),
      treg(BUSCAR, { query: name }).catch(() => null),
    ]);
    const web = redes.facebook ? await paginaDesdeFacebook(redes.facebook, redes.instagram) : null;
    if (!busqueda && !web)
      return { candidates: [], redes, error: "La búsqueda falló. Intenta de nuevo." };

    const results: Resultado[] = busqueda?.searchResults ?? [];
    const lista = results.map((p) => ({
      page_id: String(p.page_id ?? ""),
      name: p.name ?? "",
      category: p.category ?? null,
      ig_username: p.ig_username ?? null,
      ig_followers: Number(p.ig_followers ?? 0),
      likes: Number(p.likes ?? 0),
    }));
    // Si la página de la web también salió en la búsqueda, se completan sus datos de Instagram.
    if (web) {
      const igual = lista.find((c) => c.page_id === web.page_id);
      if (igual) {
        web.ig_username = igual.ig_username ?? web.ig_username;
        web.ig_followers = igual.ig_followers;
      }
    }
    return { candidates: ordenar(web, lista, redes.instagram), redes };
  });

/** Busca una página pegada a mano (enlace o usuario de Facebook). */
export const resolverPagina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url: string }) => ({ url: String(d?.url ?? "").slice(0, 300) }))
  .handler(async ({ data }): Promise<{ candidate: Candidato | null; error?: string }> => {
    const url = enlaceFacebook(data.url);
    if (!url)
      return {
        candidate: null,
        error: "Pega el enlace de la página de Facebook (ej. facebook.com/marca).",
      };
    if (!token()) return { candidate: null, error: "Falta configurar el secreto TREG." };
    const c = await paginaDesdeFacebook(url, null);
    return c
      ? { candidate: { ...c, origen: "busqueda", coincide: false } }
      : { candidate: null, error: "No encontré esa página o no tiene biblioteca de anuncios." };
  });
