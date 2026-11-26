import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  component: Layout,
});

function Layout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((ev) => {
      if (ev === "SIGNED_OUT") navigate({ to: "/login", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function salir() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-[1040px] items-center justify-between gap-4 px-4 py-4">
          <a href="/"><Logo /></a>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
            <button onClick={salir} className="font-medium hover:text-primary">Salir</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1040px] px-4 py-10"><Outlet /></main>
    </div>
  );
}
