export function miles(n: number | null | undefined): string {
  if (n == null) return "—";
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function cop(n: number | null | undefined): string {
  return n == null ? "—" : `COP ${miles(n)}`;
}

export function fecha(iso: string): string {
  const d = new Date(iso);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function limpiarDominio(v: string): string {
  return v.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
}

export const STATUS_LABEL: Record<string, string> = {
  queued: "En cola",
  running: "En proceso",
  done: "Listo",
  error: "Error",
};
