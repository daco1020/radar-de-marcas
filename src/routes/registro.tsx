import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/AuthForm";

export const Route = createFileRoute("/registro")({
  head: () => ({
    meta: [
      { title: "Crear cuenta · REA Marketing" },
      { name: "description", content: "Crear cuenta en REA Marketing para pedir informes de marcas competidoras." },
      { property: "og:title", content: "Crear cuenta · REA Marketing" },
      { property: "og:description", content: "Informes de marketing de marcas competidoras." },
    ],
  }),
  component: () => <AuthForm mode="registro" />,
});
