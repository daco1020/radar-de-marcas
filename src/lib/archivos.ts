import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export async function abrirArchivo(path: string | null) {
  if (!path) { toast.error("El archivo todavía no está disponible."); return; }
  const w = window.open("", "_blank");
  const { data, error } = await supabase.storage.from("informes").createSignedUrl(path, 3600);
  if (error || !data) { w?.close(); toast.error("No se pudo abrir el archivo."); return; }
  if (w) w.location.href = data.signedUrl; else window.location.href = data.signedUrl;
}
