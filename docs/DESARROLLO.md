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

## Motor de informes (en la nube)

Los informes se generan dentro de la app, sin ningún computador encendido:

- `src/motor/` es el motor en TypeScript (copia del de Python en `informes/scripts/`):
  `datos.ts` (descargas por pasos), `calculo.ts`, `narrativa.ts`, `imagenes.ts`, `informe.ts` y `motor.ts` (orquestador).
- `src/routes/api/public/motor.ts` avanza **un informe por llamada** durante ~35 s y guarda dónde quedó
  (tabla `report_jobs`; archivos intermedios en Storage, `informes/motor/<informe>/`).
- El disparador es `pg_cron` en la base: el trabajo `motor-informes` llama a esa ruta cada 30 segundos con el
  secreto `motor_secret` del Vault (el secreto no sale de la base; la app lo valida con `motor_secret_ok()`).
- El PDF se genera en el navegador: el botón «PDF» abre el informe en modo impresión y el usuario elige
  «Guardar como PDF». Los informes viejos hechos con Python conservan su PDF.
- `src/motor/plantilla.ts` (CSS y JS del informe) se genera desde `informes/scripts/build_generic_es.py`;
  no se edita a mano.
- Para comparar con el motor de Python: `bun scripts/paridad.ts <carpeta del informe> <clave>`.
  Para correr un informe completo en local con el CLI de treg: `bun scripts/motor_local.ts …`.

Ver qué está haciendo el motor (SQL en la base):

```sql
select status_code, left(content, 200), created from net._http_response order by created desc limit 10;
select r.brand_name, r.status, j.fase, j.intentos, j.actualizado from report_jobs j join reports r on r.id = j.report_id order by j.actualizado desc;
```
