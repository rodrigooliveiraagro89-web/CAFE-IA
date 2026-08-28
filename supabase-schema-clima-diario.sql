-- AGRYN — Diário climático do talhão (§9 "AgrynMemory" da Fase 2).
-- Um registro por (usuário × talhão) com os dias OBSERVADOS em `days` (jsonb),
-- acumulados a partir da previsão pública (Open-Meteo) toda vez que o clima do
-- talhão é carregado. Vira a memória climática permanente, além da janela da API.
-- Offline-first: upsert idempotente por (user_id, plot_id) via outbox. SQL Editor.

create table if not exists public.climate_diaries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  plot_id     uuid not null references public.plots(id) on delete cascade,
  days        jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now(),
  unique (user_id, plot_id)
);

alter table public.climate_diaries enable row level security;

drop policy if exists "climate_diaries_own" on public.climate_diaries;
create policy "climate_diaries_own" on public.climate_diaries
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
