import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { abrirArchivo, abrirPdf } from "@/lib/archivos";
import { PASOS } from "@/lib/pasos";
import { nombrePeriodo } from "@/lib/periodo";
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

const DOT: Record<string, string> = {
  pending: "bg-pending",
  running: "bg-progress pulse-soft",
  done: "bg-success",
  error: "bg-destructive",
};
const TXT: Record<string, string> = {
  pending: "pendiente",
  running: "en curso",
  done: "listo",
  error: "error",
};

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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reports", filter: `id=eq.${id}` },
        (p) => {
          qc.setQueryData(["report", id], p.new);
          qc.invalidateQueries({ queryKey: ["reports"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  if (isLoading) return <p className="text-muted-foreground">Cargando…</p>;
  if (!r)
    return (
      <p className="text-muted-foreground">
        No encontramos este informe.{" "}
        <Link to="/" className="text-primary underline">
          Volver
        </Link>
      </p>
    );
  const steps = (r.steps ?? {}) as Record<string, string>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Paso 3 de 3</p>
          <h1 className="mt-1 text-3xl">Informe de {r.brand_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {nombrePeriodo(r.period)} · {r.domain}
          </p>
        </div>
        <StatusBadge status={r.status} />
      </div>
      {(() => {
        const hechos = PASOS.filter(([k]) => steps[k] === "done").length;
        const pct = Math.round((hechos / PASOS.length) * 100);
        const min = r.started_at
          ? Math.max(
              0,
              Math.round(
                ((r.finished_at ? new Date(r.finished_at) : new Date()).getTime() -
                  new Date(r.started_at).getTime()) /
                  60000,
              ),
            )
          : null;
        return (
          <div className="space-y-2 rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-display text-2xl font-semibold">{pct}%</span>
              <span className="text-sm text-muted-foreground">
                {hechos} de {PASOS.length} pasos{min != null ? ` · ${min} min` : ""}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  r.status === "error"
                    ? "bg-destructive"
                    : r.status === "done"
                      ? "bg-success"
                      : "bg-progress",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })()}
      <ol className="divide-y rounded-xl border bg-card">
        {PASOS.map(([k, label]) => {
          const s = DOT[steps[k] ?? ""] ? steps[k]! : "pending";
          return (
            <li key={k} className="flex items-center gap-3 px-5 py-3.5">
              <span className={cn("size-2.5 rounded-full", DOT[s])} />
              <span className="flex-1">{label}</span>
              <span
                className={cn(
                  "eyebrow",
                  s === "done" && "text-success",
                  s === "running" && "text-progress",
                  s === "error" && "text-destructive",
                )}
              >
                {TXT[s]}
              </span>
            </li>
          );
        })}
      </ol>
      {r.status === "queued" && (
        <p className="text-muted-foreground">En cola: empezará en cuanto el motor esté libre.</p>
      )}
      {r.status === "running" && (
        <p className="text-muted-foreground">
          En proceso. Puedes cerrar esta página y volver desde el historial.
        </p>
      )}
      {r.status === "done" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => abrirPdf(r.pdf_path, r.html_path)}>Descargar PDF</Button>
            <Button variant="outline" onClick={() => abrirArchivo(r.html_path)}>
              Ver en la web
            </Button>
          </div>
        </div>
      )}
      {r.status === "error" && (
        <div className="space-y-3">
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">
            {r.error ?? "Ocurrió un error."}
          </p>
          <Button variant="outline" asChild>
            <Link to="/">Volver</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
