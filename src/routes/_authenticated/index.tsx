import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { fecha, limpiarDominio } from "@/lib/format";
import { abrirArchivo } from "@/lib/archivos";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Panel · REA Marketing" },
      { name: "description", content: "Pide informes de marketing de marcas competidoras y revisa tu historial." },
      { property: "og:title", content: "Panel · REA Marketing" },
      { property: "og:description", content: "Pide informes de marketing de marcas competidoras." },
    ],
  }),
  component: Panel,
});

const PERIODOS: Record<string, string> = { "oct-nov-2026": "Octubre y noviembre 2026" };

function Panel() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [period, setPeriod] = useState("oct-nov-2026");
  const { data: reports, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reports").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    navigate({ to: "/confirmar", search: { name: name.trim(), domain: limpiarDominio(domain) } });
  }

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl">Informes REA Marketing</h1>
        <p className="max-w-2xl text-muted-foreground">Escribe una marca y su web. El sistema encuentra sus cuentas, descarga sus anuncios, redes, catálogo y búsquedas, y entrega un informe en PDF en español y en pesos.</p>
      </div>

      <form onSubmit={onSubmit} className="rounded-xl border bg-card p-6">
        <p className="eyebrow mb-4">Nuevo informe</p>
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <div className="space-y-1.5"><Label htmlFor="m">Marca</Label><Input id="m" required minLength={2} placeholder="Koaj" value={name} onChange={(e) => setName(e.target.value)} className="bg-background" /></div>
          <div className="space-y-1.5"><Label htmlFor="w">Web de la tienda</Label><Input id="w" required placeholder="koaj.co" value={domain} onChange={(e) => setDomain(e.target.value)} onBlur={() => setDomain(limpiarDominio(domain))} className="bg-background" /></div>
          <div className="space-y-1.5"><Label>Periodo</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="oct-nov-2026">Octubre y noviembre 2026</SelectItem></SelectContent>
            </Select>
          </div>
          <Button type="submit">Buscar cuentas</Button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="text-xl">Historial</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-card text-left">
              <tr>{["Marca", "Periodo", "Estado", "Fecha", ""].map((h) => <th key={h} className="eyebrow px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>
              ) : !reports?.length ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Todavía no hay informes. Crea el primero arriba.</td></tr>
              ) : reports.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3"><div className="font-medium">{r.brand_name}</div><div className="text-xs text-muted-foreground">{r.domain}</div></td>
                  <td className="px-4 py-3">{PERIODOS[r.period] ?? r.period}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{fecha(r.created_at)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {r.status === "done" ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => abrirArchivo(r.pdf_path)}>PDF</Button>
                        <Button size="sm" variant="outline" onClick={() => abrirArchivo(r.html_path)}>Ver en la web</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" asChild><Link to="/informe/$id" params={{ id: r.id }}>Ver avance</Link></Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
