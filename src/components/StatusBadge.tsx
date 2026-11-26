import { STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

const STYLE: Record<string, string> = {
  queued: "bg-muted text-muted-foreground border",
  running: "bg-progress/15 text-progress",
  done: "bg-success/15 text-success",
  error: "bg-destructive/15 text-destructive",
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 font-mono text-[0.7rem] uppercase tracking-wider", STYLE[status])}>{STATUS_LABEL[status] ?? status}</span>;
}
