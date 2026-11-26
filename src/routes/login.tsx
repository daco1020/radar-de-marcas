import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/AuthForm";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión · REA Marketing" },
      { name: "description", content: "Iniciar sesión en REA Marketing para pedir informes de marcas competidoras." },
      { property: "og:title", content: "Iniciar sesión · REA Marketing" },
      { property: "og:description", content: "Informes de marketing de marcas competidoras." },
    ],
  }),
  component: () => <AuthForm mode="login" />,
});
