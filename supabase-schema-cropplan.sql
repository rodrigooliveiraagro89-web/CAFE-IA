-- AGRYN — Plano de safra do talhão (§8 "CropPlan" do plano de evolução).
-- Um registro por (talhão × safra). Os itens do plano ficam em `items` (jsonb),
-- no mesmo padrão offline-first do resto do app (uma linha = um plano, upsert
-- idempotente pela outbox). O REALIZADO não mora aqui: cada item aponta para o
-- registro do caderno (field_records) que virou verdade. Rodar no SQL Editor.

create table if not exists public.crop_plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  plot_id     uuid not null references public.plots(id) on delete cascade,
  safra       text not null default '',
  title       text not null default '',
  status      text not null default 'ativo' check (status in ('rascunho','ativo','encerrado')),
  items       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.crop_plans enable row level security;

drop policy if exists "crop_plans_own" on public.crop_plans;
create policy "crop_plans_own" on public.crop_plans
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists crop_plans_plot_idx on public.crop_plans(plot_id, safra);
