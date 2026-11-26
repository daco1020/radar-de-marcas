import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { cop } from "@/lib/format";
import { abrirArchivo } from "@/lib/archivos";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/informe/$id")({
  head: () => ({
    meta: [
      { title: "Avance del informe · REA Marketing" },
      { name: "description", content: "Sigue en vivo el avance de tu informe de marketing." },
      { property: "og:title", content: "Avance del informe · REA Marketing" },
      { property: "og:description", content: "Sigue en vivo el avance de tu informe." },
    ],
  }),
  component: Informe,
});

const PASOS: [string, string][] = [
  ["ads", "Anuncios, TikTok e Instagram"], ["catalog", "Catálogo de la tienda"], ["search", "Búsquedas en Google"],
  ["site", "Página de inicio"], ["compute", "Cálculo semana a semana"], ["images", "Imágenes"],
  ["narrative", "Hallazgos y veredicto"], ["report", "Informe HTML"], ["pdf", "PDF"],
];
const DOT: Record<string, string> = { pending: "bg-pending", running: "bg-progress pulse-soft", done: "bg-success", error: "bg-destructive" };
const TXT: Record<string, string> = { pending: "pendiente", running: "en curso", done: "listo", error: "error" };

function Informe() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: r, isLoading } = useQuery({
    queryKey: ["report", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("reports").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`report-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "reports", filter: `id=eq.${id}` }, (p) => {
        qc.setQueryData(["report", id], p.new);
        qc.invalidateQueries({ queryKey: ["reports"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  if (isLoading) return <p className="text-muted-foreground">Cargando…</p>;
  if (!r) return <p className="text-muted-foreground">No encontramos este informe. <Link to="/" className="text-primary underline">Volver</Link></p>;
  const steps = (r.steps ?? {}) as Record<string, string>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Paso 3 de 3</p>
          <h1 className="mt-1 text-3xl">Informe de {r.brand_name}</h1>
        </div>
        <StatusBadge status={r.status} />
      </div>
      <ol className="divide-y rounded-xl border bg-card">
        {PASOS.map(([k, label]) => {
          const s = DOT[steps[k] ?? ""] ? steps[k]! : "pending";
          return (
            <li key={k} className="flex items-center gap-3 px-5 py-3.5">
              <span className={cn("size-2.5 rounded-full", DOT[s])} />
              <span className="flex-1">{label}</span>
              <span className={cn("eyebrow", s === "done" && "text-success", s === "running" && "text-progress", s === "error" && "text-destructive")}>{TXT[s]}</span>
            </li>
          );
        })}
      </ol>
      {r.status === "queued" && <p className="text-muted-foreground">En cola: empezará en cuanto el motor esté libre.</p>}
      {r.status === "running" && <p className="text-muted-foreground">En proceso. Puedes cerrar esta página y volver desde el historial.</p>}
      {r.status === "done" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => abrirArchivo(r.pdf_path)}>Descargar PDF</Button>
            <Button variant="outline" onClick={() => abrirArchivo(r.html_path)}>Ver en la web</Button>
          </div>
          <p className="text-sm text-muted-foreground">Costo de datos: {cop(r.cost_cop)}</p>
        </div>
      )}
      {r.status === "error" && (
        <div className="space-y-3">
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">{r.error ?? "Ocurrió un error."}</p>
          <Button variant="outline" asChild><Link to="/">Volver</Link></Button>
        </div>
      )}
    </div>
  );
}
