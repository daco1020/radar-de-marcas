# Desarrollo sin gastar créditos de Lovable

Este repo está conectado a Lovable en las dos direcciones: lo que se sube a `main` aparece en el editor
de Lovable, y lo que cambia Lovable llega aquí como commit. Editar por GitHub no gasta créditos.

## Flujo

```bash
git pull                     # traer lo último (incluidos cambios hechos en Lovable)
bun install                  # dependencias (el lockfile es bun.lock; no uses npm install)
bun run dev                  # app local en http://localhost:8080 contra la misma base de Lovable Cloud
bun run build && bun run test
git commit -am "…" && git push   # Lovable lo toma en segundos
```

- Trabaja siempre sobre `main`: es la rama que Lovable sincroniza.
- No edites `src/routeTree.gen.ts` ni `src/integrations/supabase/types.ts` a mano: se generan solos.
- `.env` solo trae la URL y la clave pública de Lovable Cloud. Los secretos (`TREG`, `WORKER_SECRET`)
  viven en Lovable → Cloud → Secrets y nunca van al repo.

## Base de datos

El esquema vigente está en `docs/esquema.sql` (ya aplicado). No va en `supabase/migrations/` para que no se
vuelva a ejecutar. Para cambiar la base sin créditos, corre el SQL en Lovable → Cloud → Database y guarda aquí el cambio.

## Piezas del servidor

| Archivo                               | Qué hace                                                                            | Secreto         |
| ------------------------------------- | ----------------------------------------------------------------------------------- | --------------- |
| `src/lib/cuentas.functions.ts`        | Busca las páginas de Meta de una marca (paso 2)                                     | `TREG`          |
| `src/routes/api/public/worker-api.ts` | Puerta del worker externo: reclamar informe, avanzar pasos, URL para subir archivos | `WORKER_SECRET` |

El worker (Python) vive fuera de este repo, en `REA Marketing/lovable/worker/`, junto al motor de informes.
Se conecta a `<url publicada>/api/public/worker-api`.
