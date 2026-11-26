-- REA Marketing · esquema base para la app de Lovable
-- Tablas: profiles, reports. Almacenamiento: bucket privado "informes".
-- El worker usa la service role key (no pasa por RLS); el navegador solo lee y crea lo suyo.

create extension if not exists "pgcrypto";

-- ---------- perfiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  company text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "perfil propio: leer" on public.profiles
  for select using (auth.uid() = id);
create policy "perfil propio: editar" on public.profiles
  for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, company)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), coalesce(new.raw_user_meta_data ->> 'company', ''))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- informes ----------
create type public.report_status as enum ('queued', 'running', 'done', 'error');

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  brand_name text not null check (char_length(brand_name) between 1 and 80),
  domain text not null check (char_length(domain) between 3 and 120),
  period text not null default 'oct-nov-2026' check (period in ('oct-nov-2026')),
  meta_page_id text not null,
  meta_page_name text,
  ig_username text,
  ig_followers integer,
  status public.report_status not null default 'queued',
  -- pasos del motor: {"ads":"done","catalog":"running",...}
  steps jsonb not null default '{}'::jsonb,
  error text,
  cost_cop integer,                -- costo de datos en pesos
  pdf_path text,                   -- ruta dentro del bucket "informes"
  html_path text,
  worker_id text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists reports_user_created on public.reports (user_id, created_at desc);
create index if not exists reports_queue on public.reports (status, created_at) where status = 'queued';

alter table public.reports enable row level security;

-- El usuario ve solo sus informes.
create policy "informes propios: leer" on public.reports
  for select using (auth.uid() = user_id);

-- El usuario solo puede crear informes en cola y a su nombre; el resto lo llena el worker.
create policy "informes propios: crear en cola" on public.reports
  for insert with check (
    auth.uid() = user_id
    and status = 'queued'
    and steps = '{}'::jsonb
    and cost_cop is null and pdf_path is null and html_path is null and error is null
  );

-- Sin políticas de update/delete para usuarios: solo el worker (service role) cambia el estado.

-- Avance en vivo en la app.
alter publication supabase_realtime add table public.reports;

-- ---------- almacenamiento ----------
insert into storage.buckets (id, name, public)
values ('informes', 'informes', false)
on conflict (id) do nothing;

-- Los archivos se guardan en informes/<user_id>/<report_id>/<archivo>.
create policy "archivos propios: leer" on storage.objects
  for select using (
    bucket_id = 'informes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------- motor en la nube (26 nov 2026) ----------
-- Periodos por meses (de 1 a 3 meses de 2026) además del original 'oct-nov-2026'.
alter table public.reports drop constraint if exists reports_period_check;
alter table public.reports add constraint reports_period_check check (
  period = 'oct-nov-2026'
  or (period ~ '^2026-(0[1-9]|1[0-2])_2026-(0[1-9]|1[0-2])$'
      and substr(period, 14, 2)::int >= substr(period, 6, 2)::int
      and substr(period, 14, 2)::int - substr(period, 6, 2)::int <= 2)
);
alter table public.reports alter column period set default '2026-10_2026-11';

-- Estado del motor por informe (solo el servidor).
create table if not exists public.report_jobs (
  report_id uuid primary key references public.reports(id) on delete cascade,
  estado jsonb not null default '{}'::jsonb,
  fase int not null default 0,
  intentos int not null default 0,
  lock_until timestamptz,
  actualizado timestamptz not null default now()
);
alter table public.report_jobs enable row level security;

-- Disparador: pg_cron llama cada 30 s a /api/public/motor con el secreto WORKER_SECRET (ver docs/DESARROLLO.md).
