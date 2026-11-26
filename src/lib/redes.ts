// Lectura de las redes que enlaza la web de una marca y orden de las páginas de Meta candidatas.

export type Redes = { facebook: string | null; instagram: string | null; tiktok: string | null };

export type Candidato = {
  page_id: string;
  name: string;
  category: string | null;
  ig_username: string | null;
  ig_followers: number;
  likes: number;
  /** "web": la página enlazada desde la web de la marca; "busqueda": salió buscando el nombre. */
  origen: "web" | "busqueda";
  /** Coincide con lo que enlaza la web (misma página o mismo Instagram). */
  coincide: boolean;
};

const FB_NO = new Set([
  "sharer",
  "sharer.php",
  "share",
  "dialog",
  "plugins",
  "tr",
  "groups",
  "events",
  "login",
  "watch",
  "photo",
  "photo.php",
  "permalink.php",
  "story.php",
  "profile.php",
  "pages",
  "hashtag",
  "help",
  "policies",
  "privacy",
]);
const IG_NO = new Set([
  "p",
  "reel",
  "reels",
  "explore",
  "accounts",
  "stories",
  "tv",
  "direct",
  "about",
  "legal",
  "developer",
]);

function masFrecuente(xs: string[]): string | null {
  const c = new Map<string, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  let best: string | null = null,
    n = 0;
  for (const [k, v] of c)
    if (v > n) {
      best = k;
      n = v;
    }
  return best;
}

/** Saca de un HTML los perfiles de Facebook, Instagram y TikTok que enlaza (el más repetido de cada uno). */
export function extraerRedes(html: string): Redes {
  const fb: string[] = [],
    ig: string[] = [],
    tt: string[] = [];
  for (const m of html.matchAll(
    /https?:\/\/(?:www\.|m\.|web\.)?(?:facebook|fb)\.com\/([A-Za-z0-9.\-_]{2,80})/gi,
  )) {
    const s = m[1]!.replace(/\.$/, "");
    if (!FB_NO.has(s.toLowerCase())) fb.push(s.toLowerCase());
  }
  for (const m of html.matchAll(/https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{2,30})/gi)) {
    const s = m[1]!.replace(/\.$/, "").toLowerCase();
    if (!IG_NO.has(s)) ig.push(s);
  }
  for (const m of html.matchAll(/https?:\/\/(?:www\.)?tiktok\.com\/@([A-Za-z0-9._]{2,30})/gi))
    tt.push(m[1]!.replace(/\.$/, "").toLowerCase());
  const f = masFrecuente(fb);
  return {
    facebook: f ? `https://www.facebook.com/${f}` : null,
    instagram: masFrecuente(ig),
    tiktok: masFrecuente(tt),
  };
}

/** Limpia un enlace o usuario de Facebook pegado a mano. */
export function enlaceFacebook(v: string): string | null {
  const t = v.trim();
  const m =
    /^(?:https?:\/\/)?(?:www\.|m\.|web\.)?(?:facebook|fb)\.com\/([A-Za-z0-9.\-_]{2,80})/i.exec(t);
  if (m) return FB_NO.has(m[1]!.toLowerCase()) ? null : `https://www.facebook.com/${m[1]}`;
  if (/^[A-Za-z0-9.\-_]{2,80}$/.test(t)) return `https://www.facebook.com/${t}`;
  return null;
}

/**
 * Junta la página encontrada desde la web (si hay) con las de la búsqueda por nombre:
 * primero la de la web, luego las que tienen el mismo Instagram que la web, luego el resto por seguidores.
 */
export function ordenar(
  web: Candidato | null,
  busqueda: Omit<Candidato, "origen" | "coincide">[],
  igWeb: string | null,
  max = 10,
): Candidato[] {
  const ig = igWeb?.toLowerCase() ?? null;
  const out: Candidato[] = [];
  if (web) out.push(web);
  const resto = busqueda
    .filter((c) => c.page_id && c.page_id !== web?.page_id)
    .map((c) => ({
      ...c,
      origen: "busqueda" as const,
      coincide: !!ig && c.ig_username?.toLowerCase() === ig,
    }))
    .sort((a, b) => Number(b.coincide) - Number(a.coincide) || b.ig_followers - a.ig_followers);
  return out.concat(resto).slice(0, max);
}
