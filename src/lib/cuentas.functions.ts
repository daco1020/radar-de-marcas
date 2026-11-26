import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Candidato = {
  page_id: string;
  name: string;
  category: string | null;
  ig_username: string | null;
  ig_followers: number;
  likes: number;
};

const TREG_TOOL = "scrapecreators.x.v1-facebook-adlibrary-search-companies";

export const buscarCuentas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) => ({ name: String(d?.name ?? "").trim() }))
  .handler(async ({ data }): Promise<{ candidates: Candidato[]; error?: string }> => {
    const name = data.name;
    if (name.length < 2 || name.length > 80)
      return { candidates: [], error: "Escribe el nombre de la marca (2 a 80 caracteres)." };
    const token = process.env["TREG_TOKEN"];
    if (!token) return { candidates: [], error: "Falta configurar TREG_TOKEN en los secretos." };
    const r = await fetch(`https://treg.to/call/${TREG_TOOL}?query=${encodeURIComponent(name)}`, {
      headers: { "X-Treg-Token": token, "X-Treg-Route-Max-Cost": "0.01" },
    });
    if (!r.ok) return { candidates: [], error: `La búsqueda falló (${r.status}). Intenta de nuevo.` };
    const body = (await r.json()) as any;
    const results = (body?.searchResults ?? body?.result?.searchResults ?? []) as any[];
    const candidates = results
      .map((p) => ({
        page_id: String(p.page_id ?? ""),
        name: p.name ?? "",
        category: p.category ?? null,
        ig_username: p.ig_username ?? null,
        ig_followers: Number(p.ig_followers ?? 0),
        likes: Number(p.likes ?? 0),
      }))
      .filter((c) => c.page_id)
      .sort((a, b) => b.ig_followers - a.ig_followers)
      .slice(0, 10);
    return { candidates };
  });
