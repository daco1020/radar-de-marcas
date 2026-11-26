import { createFileRoute } from "@tanstack/react-router";

// Door for the external worker. Protected by WORKER_SECRET (header x-worker-secret).
const ALLOWED = new Set(["steps", "status", "error", "cost_cop", "pdf_path", "html_path", "started_at", "finished_at", "worker_id"]);
const STATUS = new Set(["running", "done", "error"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export const Route = createFileRoute("/api/public/worker-api")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["WORKER_SECRET"] ?? "";
        if (secret.length < 24 || !safeEqual(request.headers.get("x-worker-secret") ?? "", secret))
          return json({ error: "No autorizado" }, 401);
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        let body: any;
        try { body = await request.json(); } catch { return json({ error: "JSON inválido" }, 400); }

        if (body.action === "claim") {
          const { data: rows, error } = await db.from("reports").select("id").eq("status", "queued")
            .order("created_at", { ascending: true }).limit(1);
          if (error) return json({ error: error.message }, 500);
          if (!rows?.length) return json({ report: null });
          const { data: got, error: e2 } = await db.from("reports")
            .update({ status: "running", worker_id: String(body.worker_id ?? "worker").slice(0, 60), started_at: new Date().toISOString() })
            .eq("id", rows[0]!.id).eq("status", "queued").select("*");
          if (e2) return json({ error: e2.message }, 500);
          return json({ report: got?.[0] ?? null });
        }

        if (body.action === "update") {
          const fields: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(body.fields ?? {})) if (ALLOWED.has(k)) fields[k] = v;
          if ("status" in fields && !STATUS.has(String(fields["status"]))) return json({ error: "Estado inválido" }, 400);
          if (!body.id || !Object.keys(fields).length) return json({ error: "Faltan id o campos" }, 400);
          const { error } = await db.from("reports").update(fields as any).eq("id", body.id);
          if (error) return json({ error: error.message }, 500);
          return json({ ok: true });
        }

        if (body.action === "upload_url") {
          const name = String(body.filename ?? "").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
          if (!body.id || !body.user_id || !name) return json({ error: "Faltan id, user_id o filename" }, 400);
          const { data: r } = await db.from("reports").select("user_id").eq("id", body.id).maybeSingle();
          if (!r || r.user_id !== body.user_id) return json({ error: "Informe no encontrado" }, 404);
          const path = `${body.user_id}/${body.id}/${name}`;
          const { data, error } = await db.storage.from("informes").createSignedUploadUrl(path, { upsert: true });
          if (error) return json({ error: error.message }, 500);
          return json({ path, signed_url: data.signedUrl, token: data.token });
        }
        return json({ error: "Acción desconocida" }, 400);
      },
    },
  },
});
