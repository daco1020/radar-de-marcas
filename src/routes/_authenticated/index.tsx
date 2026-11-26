import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { MonthRangePicker } from "@/components/MonthRangePicker";
import { fecha, limpiarDominio, STATUS_LABEL } from "@/lib/format";
import { nombreCorto, nombrePeriodo, periodoValido, ultimosMeses } from "@/lib/periodo";
import { PASOS } from "@/lib/pasos";
import { abrirArchivo } from "@/lib/archivos";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Panel · REA Marketing" },
      {
        name: "description",
        content: "Pide informes de marketing de marcas competidoras y revisa tu historial.",
      },
      { property: "og:title", content: "Panel · REA Marketing" },
      { property: "og:description", content: "Pide informes de marketing de marcas competidoras." },
    ],
  }),
  component: Panel,
});

type Report = {
  id: string;
  brand_name: string;
  domain: string;
  period: string;
  status: string;
  steps: unknown;
  created_at: string;
  pdf_path: string | null;
  html_path: string | null;
};

function avance(r: Report): number {
  const s = (r.steps ?? {}) as Record<string, string>;
  return PASOS.filter(([k]) => s[k] === "done").length;
}

const FILTROS = [
  ["", "Todos"],
  ["done", "Listos"],
  ["running", "En proceso"],
  ["queued", "En cola"],
  ["error", "Con error"],
] as const;

function Panel() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [period, setPeriod] = useState(() => ultimosMeses(2) ?? "2026-10_2026-11");
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const { data: reports, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Report[];
    },
  });

  // Avance en vivo de los informes en proceso, sin recargar.
  useEffect(() => {
    const ch = supabase
      .channel(`reports-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () =>
        qc.invalidateQueries({ queryKey: ["reports"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const valido =
    name.trim().length >= 2 && limpiarDominio(domain).includes(".") && periodoValido(period);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valido) return;
    navigate({
      to: "/confirmar",
      search: { name: name.trim(), domain: limpiarDominio(domain), period },
    });
  }

  const cuenta = useMemo(() => {
    const c: Record<string, number> = {};
    (reports ?? []).forEach((r) => {
      c[r.status] = (c[r.status] ?? 0) + 1;
    });
    return c;
  }, [reports]);

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (reports ?? []).filter(
      (r) =>
        (!estado || r.status === estado) &&
        (!t ||
          r.brand_name.toLowerCase().includes(t) ||
          r.domain.toLowerCase().includes(t) ||
          nombrePeriodo(r.period).toLowerCase().includes(t)),
    );
  }, [reports, q, estado]);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl">Informes REA Marketing</h1>
          <p className="max-w-2xl text-muted-foreground">
            Escribe una marca y su web y elige los meses. El sistema encuentra sus cuentas, descarga
            sus anuncios, redes, catálogo y búsquedas, y entrega un informe en PDF en español y en
            pesos.
          </p>
        </div>
        {!!reports?.length && (
          <dl className="grid grid-cols-3 gap-2 text-center">
            {(
              [
                ["Informes", reports.length],
                ["Listos", cuenta["done"] ?? 0],
                ["En proceso", (cuenta["running"] ?? 0) + (cuenta["queued"] ?? 0)],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="min-w-[88px] rounded-xl border bg-card px-3 py-2">
                <dt className="eyebrow">{k}</dt>
                <dd className="font-display text-2xl font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-6 rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">Nuevo informe · paso 1 de 3</p>
          <ol className="flex items-center gap-2 text-xs text-muted-foreground" aria-label="Pasos">
            <li className="font-medium text-foreground">1 Marca y meses</li>
            <li aria-hidden>→</li>
            <li>2 Cuentas</li>
            <li aria-hidden>→</li>
            <li>3 Informe</li>
          </ol>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="m">Marca</Label>
            <Input
              id="m"
              required
              minLength={2}
              placeholder="Koaj"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-background"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="w">Web de la tienda</Label>
            <Input
              id="w"
              required
              placeholder="koaj.co"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onBlur={() => setDomain(limpiarDominio(domain))}
              className="bg-background"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Meses del informe</Label>
          <MonthRangePicker value={period} onChange={setPeriod} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {valido ? (
              <>
                Listo para buscar las cuentas de <b className="text-foreground">{name.trim()}</b>.
              </>
            ) : (
              "Escribe la marca y su web para seguir."
            )}
          </p>
          <Button type="submit" disabled={!valido}>
            Buscar cuentas →
          </Button>
        </div>
      </form>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">Historial</h2>
          {!!reports?.length && (
            <Input
              type="search"
              placeholder="Buscar marca, web o mes"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 w-full bg-background sm:w-64"
              aria-label="Buscar en el historial"
            />
          )}
        </div>
        {!!reports?.length && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
            {FILTROS.map(([v, t]) => {
              const n = v ? (cuenta[v] ?? 0) : reports.length;
              if (v && !n) return null;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setEstado(v)}
                  aria-pressed={estado === v}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    estado === v
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t} <span className="font-mono opacity-80">{n}</span>
                </button>
              );
            })}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-xl border px-4 py-8 text-center text-muted-foreground">
            Cargando…
          </div>
        ) : !reports?.length ? (
          <div className="rounded-xl border border-dashed px-4 py-12 text-center text-muted-foreground">
            Todavía no hay informes. Crea el primero arriba.
          </div>
        ) : !lista.length ? (
          <div className="rounded-xl border px-4 py-8 text-center text-muted-foreground">
            Ningún informe coincide con la búsqueda.
          </div>
        ) : (
          <>
            {/* Escritorio: tabla */}
            <div className="hidden overflow-hidden rounded-xl border md:block">
              <table className="w-full text-sm">
                <thead className="bg-card text-left">
                  <tr>
                    {["Marca", "Meses", "Estado", "Fecha", ""].map((h) => (
                      <th key={h} className="eyebrow px-4 py-3 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lista.map((r) => (
                    <tr key={r.id} className="border-t transition-colors hover:bg-card/60">
                      <td className="px-4 py-3">
                        <Marca r={r} />
                      </td>
                      <td className="px-4 py-3">{nombreCorto(r.period)}</td>
                      <td className="px-4 py-3">
                        <Estado r={r} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{fecha(r.created_at)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Acciones r={r} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Celular: tarjetas */}
            <ul className="space-y-3 md:hidden">
              {lista.map((r) => (
                <li key={r.id} className="space-y-3 rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Marca r={r} />
                    <Estado r={r} />
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{nombreCorto(r.period)}</span>
                    <span>{fecha(r.created_at)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Acciones r={r} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function Marca({ r }: { r: Report }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 font-display font-semibold text-primary"
        aria-hidden
      >
        {r.brand_name.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0">
        <div className="truncate font-medium">{r.brand_name}</div>
        <div className="truncate text-xs text-muted-foreground">{r.domain}</div>
      </div>
    </div>
  );
}

function Estado({ r }: { r: Report }) {
  if (r.status !== "running") return <StatusBadge status={r.status} />;
  const n = avance(r);
  return (
    <div
      className="min-w-[120px] space-y-1"
      title={`${STATUS_LABEL["running"]}: ${n} de ${PASOS.length} pasos`}
    >
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status="running" />
        <span className="font-mono text-xs text-muted-foreground">
          {n}/{PASOS.length}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-progress transition-all"
          style={{ width: `${(n / PASOS.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

function Acciones({ r }: { r: Report }) {
  if (r.status === "done")
    return (
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => abrirArchivo(r.pdf_path)}>
          PDF
        </Button>
        <Button size="sm" onClick={() => abrirArchivo(r.html_path)}>
          Ver en la web
        </Button>
      </div>
    );
  return (
    <Button size="sm" variant="ghost" asChild>
      <Link to="/informe/$id" params={{ id: r.id }}>
        Ver avance →
      </Link>
    </Button>
  );
}
