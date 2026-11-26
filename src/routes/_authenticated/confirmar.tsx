import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { buscarCuentas, resolverPagina, type Candidato } from "@/lib/cuentas.functions";
import { miles } from "@/lib/format";
import { nombrePeriodo, periodoValido } from "@/lib/periodo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/confirmar")({
  validateSearch: (s: Record<string, unknown>) => ({
    name: String(s["name"] ?? ""),
    domain: String(s["domain"] ?? ""),
    period: String(s["period"] ?? "2026-10_2026-11"),
  }),
  head: () => ({
    meta: [
      { title: "Confirmar cuentas · REA Marketing" },
      {
        name: "description",
        content: "Elige la página de Meta de la marca para generar su informe.",
      },
      { property: "og:title", content: "Confirmar cuentas · REA Marketing" },
      { property: "og:description", content: "Elige la página de Meta de la marca." },
    ],
  }),
  component: Confirmar,
});

function Confirmar() {
  const { name, domain, period } = Route.useSearch();
  const navigate = useNavigate();
  const [elegida, setElegida] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [manual, setManual] = useState<Candidato[]>([]);
  const [enlace, setEnlace] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [errManual, setErrManual] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["cuentas", name, domain],
    queryFn: () => buscarCuentas({ data: { name, domain } }),
    staleTime: Infinity,
    retry: false,
  });
  const cands = useMemo(() => {
    const base = q.data?.candidates ?? [];
    return [...manual, ...base.filter((c) => !manual.some((m) => m.page_id === c.page_id))];
  }, [q.data, manual]);
  const redes = q.data?.redes;
  const sel = elegida ?? cands[0]?.page_id ?? null;

  async function generar() {
    const c = cands.find((x) => x.page_id === sel);
    if (!c) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("reports")
      .insert({
        brand_name: name,
        domain,
        period,
        meta_page_id: c.page_id,
        meta_page_name: c.name,
        ig_username: c.ig_username ?? redes?.instagram ?? null,
        ig_followers: c.ig_followers,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error("No se pudo crear el informe.");
      return;
    }
    navigate({ to: "/informe/$id", params: { id: data.id } });
  }

  async function agregar(e: FormEvent) {
    e.preventDefault();
    setBuscando(true);
    setErrManual(null);
    try {
      const r = await resolverPagina({ data: { url: enlace } });
      if (r.candidate) {
        const c = {
          ...r.candidate,
          ig_username: r.candidate.ig_username ?? redes?.instagram ?? null,
        };
        setManual((m) => [c, ...m.filter((x) => x.page_id !== c.page_id)]);
        setElegida(c.page_id);
        setEnlace("");
      } else setErrManual(r.error ?? "No encontré esa página.");
    } catch {
      setErrManual("No se pudo buscar esa página. Intenta de nuevo.");
    } finally {
      setBuscando(false);
    }
  }

  const err = q.data?.error ?? (q.error ? "La búsqueda falló. Intenta de nuevo." : null);
  const hayWeb = !!(redes?.facebook || redes?.instagram || redes?.tiktok);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Paso 2 de 3</p>
        <h1 className="mt-1 text-3xl">¿Cuál es la página de {name}?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe de <b className="text-foreground">{nombrePeriodo(period)}</b> · {domain} · elige
          su página de Meta para seguir.
        </p>
        {!periodoValido(period) && (
          <p className="mt-2 text-sm text-destructive">
            Esos meses no son válidos. Vuelve y elige de 1 a 3 meses de 2026.
          </p>
        )}
      </div>

      {!q.isLoading && hayWeb && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <b>{domain}</b> enlaza a{" "}
          {[
            redes?.facebook &&
              `Facebook ${redes.facebook.replace(/^https:\/\/www\.facebook\.com\//, "")}`,
            redes?.instagram && `Instagram @${redes.instagram}`,
            redes?.tiktok && `TikTok @${redes.tiktok}`,
          ]
            .filter(Boolean)
            .join(" · ")}
          . Las páginas que coinciden van primero.
        </div>
      )}

      {q.isLoading ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Leyendo {domain || "la web"} y buscando en la biblioteca de anuncios de Meta…
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        </div>
      ) : err && !cands.length ? (
        <p className="rounded-xl border bg-card p-6 text-destructive">{err}</p>
      ) : !cands.length ? (
        <p className="rounded-xl border bg-card p-6 text-muted-foreground">
          No encontré páginas de Meta para '{name}'. Pega abajo el enlace de su página de Facebook.
        </p>
      ) : (
        <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
          {cands.map((c) => (
            <button
              key={c.page_id}
              type="button"
              role="radio"
              aria-checked={sel === c.page_id}
              onClick={() => setElegida(c.page_id)}
              className={cn(
                "flex gap-3 rounded-xl border bg-card p-4 text-left transition-colors",
                sel === c.page_id
                  ? "border-primary ring-1 ring-primary"
                  : "hover:border-muted-foreground/40",
                c.coincide && sel !== c.page_id && "border-primary/40",
              )}
            >
              <span
                className={cn(
                  "mt-1 size-4 shrink-0 rounded-full border-2",
                  sel === c.page_id
                    ? "border-primary bg-primary shadow-[inset_0_0_0_2px_var(--color-card)]"
                    : "border-muted-foreground/50",
                )}
              />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  {c.origen === "web" ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[0.7rem] font-medium text-primary-foreground">
                      Encontrada en {domain}
                    </span>
                  ) : c.coincide ? (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[0.7rem] font-medium text-primary">
                      Mismo Instagram que la web
                    </span>
                  ) : null}
                </span>
                {c.category && <span className="eyebrow block">{c.category}</span>}
                <span className="block text-sm text-muted-foreground">
                  {c.ig_username ? `@${c.ig_username}` : "sin cuenta vinculada"}
                </span>
                <span className="block text-sm">
                  {c.ig_followers ? `${miles(c.ig_followers)} seguidores · ` : ""}
                  {miles(c.likes)}{" "}
                  {c.origen === "web" && !c.ig_followers ? "seguidores en Facebook" : "me gusta"}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {!q.isLoading && (
        <form onSubmit={agregar} className="space-y-2 rounded-xl border border-dashed p-4">
          <label htmlFor="fb" className="text-sm font-medium">
            ¿No está la página? Pega el enlace de su página de Facebook
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="fb"
              placeholder="facebook.com/marca"
              value={enlace}
              onChange={(e) => setEnlace(e.target.value)}
              className="bg-background"
            />
            <Button type="submit" variant="outline" disabled={buscando || enlace.trim().length < 2}>
              {buscando ? "Buscando…" : "Buscar esta página"}
            </Button>
          </div>
          {errManual && <p className="text-sm text-destructive">{errManual}</p>}
        </form>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={generar} disabled={!sel || saving || !periodoValido(period)}>
          {saving ? "Creando…" : "Generar informe"}
        </Button>
        <Button variant="outline" onClick={() => navigate({ to: "/" })}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
