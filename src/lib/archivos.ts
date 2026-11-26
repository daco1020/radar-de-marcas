import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Supabase Storage entrega los .html como texto plano (para evitar scripts ajenos en su dominio),
// así que el informe web se descarga y se abre como documento HTML desde una copia local (blob).
// El informe es autocontenido: las imágenes van embebidas en base64.
export async function abrirArchivo(path: string | null) {
  if (!path) {
    toast.error("El archivo todavía no está disponible.");
    return;
  }
  const w = window.open("", "_blank");
  const go = (url: string) => {
    if (w) w.location.href = url;
    else window.location.href = url;
  };

  if (path.toLowerCase().endsWith(".html")) {
    const { data, error } = await supabase.storage.from("informes").download(path);
    if (error || !data) {
      w?.close();
      toast.error("No se pudo abrir el informe.");
      return;
    }
    const url = URL.createObjectURL(
      new Blob([await data.arrayBuffer()], { type: "text/html;charset=utf-8" }),
    );
    go(url);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  const { data, error } = await supabase.storage.from("informes").createSignedUrl(path, 3600);
  if (error || !data) {
    w?.close();
    toast.error("No se pudo abrir el archivo.");
    return;
  }
  go(data.signedUrl);
}
