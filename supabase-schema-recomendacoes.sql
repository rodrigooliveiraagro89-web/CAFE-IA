-- AGRYN — Snapshot IMUTÁVEL da recomendação de adubação (item 5b da robustez).
-- Cada emissão guarda uma cópia congelada do que gerou a dose + um hash SHA-256
-- do conteúdo canônico. Sem policy de UPDATE/DELETE: uma vez emitido, o registro
-- não muda (rastreabilidade/RT). Rodar no SQL Editor do Supabase.

create table if not exists public.recommendation_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  plot_id text not null,
  soil_analysis_id uuid,
  engine text not null,
  version text not null,
  params jsonb not null,
  npk jsonb not null,
  calagem_t_ha numeric not null default 0,
  programa jsonb not null,
  custo_ha numeric not null default 0,
  custo_saca numeric not null default 0,
  hash text not null,
  created_at timestamptz not null default now()
);

alter table public.recommendation_snapshots enable row level security;

-- Só o dono insere e lê. NÃO existe policy de update/delete -> imutável sob RLS.
drop policy if exists "rec_snap_insert_own" on public.recommendation_snapshots;
create policy "rec_snap_insert_own" on public.recommendation_snapshots
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "rec_snap_select_own" on public.recommendation_snapshots;
create policy "rec_snap_select_own" on public.recommendation_snapshots
  for select to authenticated using (auth.uid() = user_id);

create index if not exists rec_snap_plot_idx
  on public.recommendation_snapshots (plot_id, created_at desc);
