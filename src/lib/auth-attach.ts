import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

// Client-side: sends the user's session token so requireSupabaseAuth server functions can verify it.
export const attachAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});
