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

/**
 * PDF de un informe hecho en la nube: abre la versión web en modo impresión y lanza el cuadro de
 * imprimir del navegador (ahí se elige «Guardar como PDF»). Si el informe ya trae un PDF, lo abre.
 */
export async function abrirPdf(pdfPath: string | null, htmlPath: string | null) {
  if (pdfPath) return abrirArchivo(pdfPath);
  if (!htmlPath) {
    toast.error("El informe todavía no está disponible.");
    return;
  }
  const w = window.open("", "_blank");
  const { data, error } = await supabase.storage.from("informes").download(htmlPath);
  if (error || !data) {
    w?.close();
    toast.error("No se pudo abrir el informe.");
    return;
  }
  const html = await data.text();
  const extra =
    '<script>window.__PRINT=1;window.addEventListener("load",function(){setTimeout(function(){window.print()},900)});</script>';
  const url = URL.createObjectURL(new Blob([extra + html], { type: "text/html;charset=utf-8" }));
  if (w) w.location.href = url;
  else window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
  toast.message("En el cuadro de imprimir, elige «Guardar como PDF».");
}
