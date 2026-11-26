import { createFileRoute } from "@tanstack/react-router";
import { tick } from "@/motor/motor";

// Motor de informes en la nube. Lo llama pg_cron cada 30 segundos.
// Autenticación: x-motor-secret (secreto guardado en el Vault de la base; lo comprueba la base)
// o x-worker-secret (el secreto WORKER_SECRET de la app, para pruebas manuales).
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export const Route = createFileRoute("/api/public/motor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const worker = (process.env["WORKER_SECRET"] ?? "").trim();
        const hdrWorker = (request.headers.get("x-worker-secret") ?? "").trim();
        const hdrMotor = (request.headers.get("x-motor-secret") ?? "").trim();
        let ok = worker.length >= 24 && safeEqual(hdrWorker, worker);
        if (!ok && hdrMotor.length >= 32) {
          const { data } = await supabaseAdmin.rpc(
            "motor_secret_ok" as never,
            { p: hdrMotor } as never,
          );
          ok = data === true;
        }
        if (!ok) return json({ error: "No autorizado" }, 401);
        const token = process.env["TREG"] ?? process.env["TREG_TOKEN"];
        if (!token) return json({ error: "Falta el secreto TREG" }, 500);
        const hecho = await tick(supabaseAdmin as never, token);
        return json({ ok: true, hecho });
      },
    },
  },
});
