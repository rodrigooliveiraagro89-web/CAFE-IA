-- =====================================================================
-- AGRYN — propriedades, talhões e caderno de campo multi-tenant
-- Cole TODO este conteúdo no Supabase → SQL Editor → New query → Run.
-- Seguro rodar mais de uma vez (usa IF NOT EXISTS / OR REPLACE).
-- Não altera nem substitui `profiles`/`farm_state` de supabase-schema.sql —
-- essas tabelas continuam servindo a página legada `agryn.html`.
-- =====================================================================

-- 1) Propriedades (uma fazenda/área cadastrada por um usuário)
create table if not exists public.properties (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  name        text not null,
  producer    text not null default '',
  responsible text not null default '',
  city        text not null default '',
  state       text not null default '',
  created_at  timestamptz not null default now()
);
alter table public.properties enable row level security;
drop policy if exists "properties_own" on public.properties;
create policy "properties_own" on public.properties
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) Talhões (um recorte de cultura dentro de uma propriedade)
create table if not exists public.plots (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users on delete cascade,
  property_id         uuid not null references public.properties(id) on delete cascade,
  name                text not null,
  crop                text not null default '',
  variety             text not null default '',
  season              text not null default '',
  planting_date       text not null default '',
  phenological_stage  text not null default '',
  row_spacing         text not null default '',
  plant_spacing       text not null default '',
  population          text not null default '',
  area_hectares       numeric not null default 0,
  geometry            jsonb,
  created_at          timestamptz not null default now()
);
alter table public.plots enable row level security;
drop policy if exists "plots_own" on public.plots;
create policy "plots_own" on public.plots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists plots_property_id_idx on public.plots(property_id);

-- 3) Caderno de campo (atividades/registros por talhão)
create table if not exists public.field_records (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  plot_id     uuid not null references public.plots(id) on delete cascade,
  type        text not null,
  title       text not null,
  date        text not null default '',
  notes       text not null default '',
  status      text not null default 'planejada' check (status in ('planejada','concluida')),
  cost        numeric not null default 0,
  quantity    text not null default '',
  unit        text not null default '',
  created_at  timestamptz not null default now()
);
alter table public.field_records enable row level security;
drop policy if exists "field_records_own" on public.field_records;
create policy "field_records_own" on public.field_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists field_records_property_plot_idx on public.field_records(property_id, plot_id);

-- Pronto. As tabelas ficam vazias até o app criar linhas via login real.
