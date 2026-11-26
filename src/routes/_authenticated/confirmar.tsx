import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { buscarCuentas } from "@/lib/cuentas.functions";
import { miles } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/confirmar")({
  validateSearch: (s: Record<string, unknown>) => ({ name: String(s["name"] ?? ""), domain: String(s["domain"] ?? "") }),
  head: () => ({
    meta: [
      { title: "Confirmar cuentas · REA Marketing" },
      { name: "description", content: "Elige la página de Meta de la marca para generar su informe." },
      { property: "og:title", content: "Confirmar cuentas · REA Marketing" },
      { property: "og:description", content: "Elige la página de Meta de la marca." },
    ],
  }),
  component: Confirmar,
});

function Confirmar() {
  const { name, domain } = Route.useSearch();
  const navigate = useNavigate();
  const [sel, setSel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const q = useQuery({
    queryKey: ["cuentas", name],
    queryFn: () => buscarCuentas({ data: { name } }),
    staleTime: Infinity,
    retry: false,
  });
  const cands = q.data?.candidates ?? [];
  useEffect(() => { if (!sel && cands[0]) setSel(cands[0].page_id); }, [cands, sel]);

  async function generar() {
    const c = cands.find((x) => x.page_id === sel);
    if (!c) return;
    setSaving(true);
    const { data, error } = await supabase.from("reports").insert({
      brand_name: name, domain, period: "oct-nov-2026",
      meta_page_id: c.page_id, meta_page_name: c.name, ig_username: c.ig_username, ig_followers: c.ig_followers,
    }).select("id").single();
    setSaving(false);
    if (error || !data) { toast.error("No se pudo crear el informe."); return; }
    navigate({ to: "/informe/$id", params: { id: data.id } });
  }

  const err = q.data?.error ?? (q.error ? "La búsqueda falló. Intenta de nuevo." : null);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Paso 2 de 3</p>
        <h1 className="mt-1 text-3xl">¿Cuál es la página de {name}?</h1>
      </div>
      {q.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : err ? (
        <p className="rounded-xl border bg-card p-6 text-destructive">{err}</p>
      ) : !cands.length ? (
        <p className="rounded-xl border bg-card p-6 text-muted-foreground">No encontré páginas de Meta para '{name}'. Prueba con el nombre de su Instagram.</p>
      ) : (
        <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
          {cands.map((c) => (
            <button key={c.page_id} type="button" role="radio" aria-checked={sel === c.page_id} onClick={() => setSel(c.page_id)}
              className={cn("flex gap-3 rounded-xl border bg-card p-4 text-left transition-colors", sel === c.page_id ? "border-primary ring-1 ring-primary" : "hover:border-muted-foreground/40")}>
              <span className={cn("mt-1 size-4 shrink-0 rounded-full border-2", sel === c.page_id ? "border-primary bg-primary shadow-[inset_0_0_0_2px_var(--color-card)]" : "border-muted-foreground/50")} />
              <span className="min-w-0 space-y-1">
                <span className="block font-medium">{c.name}</span>
                {c.category && <span className="eyebrow block">{c.category}</span>}
                <span className="block text-sm text-muted-foreground">{c.ig_username ? `@${c.ig_username}` : "sin cuenta vinculada"}</span>
                <span className="block text-sm">{miles(c.ig_followers)} seguidores · {miles(c.likes)} me gusta</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={generar} disabled={!sel || saving}>{saving ? "Creando…" : "Generar informe"}</Button>
        <Button variant="outline" onClick={() => navigate({ to: "/" })}>Cancelar</Button>
      </div>
      <p className="text-xs text-muted-foreground">Buscar las cuentas cuesta unos COP 8.</p>
    </div>
  );
}
