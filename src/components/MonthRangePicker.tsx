import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ANIO,
  MAX_MESES,
  MESES,
  MESES_CORTOS,
  aPeriodo,
  incluyeMesActual,
  leerPeriodo,
  nombrePeriodo,
  ultimoMes,
  ultimosMeses,
} from "@/lib/periodo";

/**
 * Selector de meses: un clic marca el primer mes y otro el último (hasta 3 meses de 2026).
 * Los meses que todavía no empiezan quedan deshabilitados.
 */
export function MonthRangePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (p: string) => void;
}) {
  const tope = ultimoMes();
  const sel = leerPeriodo(value);
  const [ancla, setAncla] = useState<number | null>(null); // primer clic, esperando el segundo
  const [hover, setHover] = useState<number | null>(null);

  function pulsar(m: number) {
    if (m > tope) return;
    if (ancla == null) {
      setAncla(m);
      onChange(aPeriodo(m, m));
      return;
    }
    const desde = Math.min(ancla, m),
      hasta = Math.max(ancla, m);
    const recortado =
      hasta - desde >= MAX_MESES
        ? m > ancla
          ? ancla + MAX_MESES - 1
          : ancla - MAX_MESES + 1
        : null;
    onChange(
      recortado == null
        ? aPeriodo(desde, hasta)
        : aPeriodo(Math.min(ancla, recortado), Math.max(ancla, recortado)),
    );
    setAncla(null);
    setHover(null);
  }

  // Rango que se ve resaltado: el elegido o, mientras se elige, el que quedaría con el mouse encima.
  let vista = sel;
  if (ancla != null && hover != null) {
    let a = Math.min(ancla, hover),
      b = Math.max(ancla, hover);
    if (b - a >= MAX_MESES) {
      if (hover > ancla) b = ancla + MAX_MESES - 1;
      else a = ancla - MAX_MESES + 1;
    }
    vista = { desde: a, hasta: b };
  }

  const atajos = [
    { t: "Último mes", p: ultimosMeses(1) },
    { t: "Últimos 2 meses", p: ultimosMeses(2) },
    { t: "Últimos 3 meses", p: ultimosMeses(3) },
  ].filter((x) => x.p);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Atajos de periodo">
        {atajos.map((x) => (
          <button
            key={x.t}
            type="button"
            onClick={() => {
              setAncla(null);
              onChange(x.p!);
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              value === x.p
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
          >
            {x.t}
          </button>
        ))}
      </div>
      <div
        className="grid grid-cols-4 gap-1.5 sm:grid-cols-6"
        role="group"
        aria-label={`Meses de ${ANIO}`}
        onMouseLeave={() => setHover(null)}
      >
        {MESES_CORTOS.map((corto, i) => {
          const m = i + 1;
          const futuro = m > tope;
          const dentro = !!vista && m >= vista.desde && m <= vista.hasta;
          const borde = !!vista && (m === vista.desde || m === vista.hasta);
          return (
            <button
              key={m}
              type="button"
              disabled={futuro}
              onClick={() => pulsar(m)}
              onMouseEnter={() => setHover(m)}
              aria-pressed={dentro}
              aria-label={`${MESES[i]} ${ANIO}${futuro ? " (todavía no empieza)" : ""}`}
              className={cn(
                "rounded-lg border px-2 py-2 text-sm capitalize transition-colors",
                futuro && "cursor-not-allowed border-dashed text-muted-foreground/50",
                !futuro && !dentro && "bg-background hover:border-primary/60",
                dentro && !borde && "border-primary/30 bg-primary/15 text-foreground",
                borde && "border-primary bg-primary font-semibold text-primary-foreground",
                ancla === m && "ring-2 ring-primary/40 ring-offset-1",
              )}
            >
              {corto}
            </button>
          );
        })}
      </div>
      <div className="rounded-lg bg-background px-3 py-2 text-sm" aria-live="polite">
        {ancla != null ? (
          <span className="text-muted-foreground">
            Ahora elige el último mes (máximo {MAX_MESES}), o deja solo{" "}
            <b className="text-foreground capitalize">{MESES[ancla - 1]}</b>.
          </span>
        ) : sel ? (
          <span>
            <b>{nombrePeriodo(value)}</b>
            <span className="text-muted-foreground">
              {" "}
              · comparado con los mismos meses de {ANIO - 1}.
            </span>
            {incluyeMesActual(value) && (
              <span className="text-progress">
                {" "}
                El mes en curso sale parcial: las semanas que no han terminado quedan marcadas.
              </span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">
            Elige de 1 a {MAX_MESES} meses de {ANIO}.
          </span>
        )}
      </div>
    </div>
  );
}
