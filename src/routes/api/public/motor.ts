import { createFileRoute } from "@tanstack/react-router";
import { tick } from "@/motor/motor";

// Motor de informes en la nube. Lo llama pg_cron cada 30 segundos con el secreto WORKER_SECRET.
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
        const secret = (process.env["WORKER_SECRET"] ?? "").trim();
        if (
          secret.length < 24 ||
          !safeEqual((request.headers.get("x-worker-secret") ?? "").trim(), secret)
        )
          return json({ error: "No autorizado" }, 401);
        const token = process.env["TREG"] ?? process.env["TREG_TOKEN"];
        if (!token) return json({ error: "Falta el secreto TREG" }, 500);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const hecho = await tick(supabaseAdmin as never, token);
        return json({ ok: true, hecho });
      },
    },
  },
});
