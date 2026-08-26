-- ============================================================================
-- AGRYN Café — Histórico por talhão (NDVI + recomendação 5ª Aproximação)
-- Fase 0.4: versiona no repositório as duas tabelas que eram usadas em runtime
-- mas NÃO tinham CREATE TABLE versionado. Assim um ambiente novo provisionado
-- só pelos scripts sobe completo (antes, quebrava ao salvar NDVI/recomendação).
--
-- Idempotente: pode rodar em ambiente novo OU sobre a produção existente sem
-- efeito colateral (CREATE ... IF NOT EXISTS + DROP/CREATE POLICY).
-- Depende de: supabase-schema-colaboracao.sql (função can_view_plot), que deve
-- ser aplicado ANTES num ambiente novo.
-- ============================================================================

-- ---------------------------------------------------------------- NDVI -------
create table if not exists public.ndvi_results (
  id           text primary key,
  user_id      uuid not null,
  plot_id      text not null,
  acquired_at  timestamptz not null,
  processed_at timestamptz not null,
  result       jsonb not null,
  created_at   timestamptz not null default now()
);

alter table public.ndvi_results enable row level security;

drop policy if exists ndvi_results_own on public.ndvi_results;
create policy ndvi_results_own on public.ndvi_results
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Colaborador com acesso ao talhão pode LER (não escreve). Requer can_view_plot.
drop policy if exists ndvi_results_collaborator_select on public.ndvi_results;
create policy ndvi_results_collaborator_select on public.ndvi_results
  for select
  to authenticated
  using (can_view_plot(plot_id));

create index if not exists ndvi_results_plot_idx
  on public.ndvi_results (plot_id, acquired_at desc);
create index if not exists ndvi_results_user_id_idx
  on public.ndvi_results (user_id);

-- ------------------------------------------ recomendação 5ª Aproximação ------
create table if not exists public.fertility_recommendations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  plot_id          text not null,
  fase             text,
  produtividade_sc numeric,
  payload          jsonb not null, -- Recomendacao5a completa (carimba regra.versao)
  created_at       timestamptz not null default now()
);

alter table public.fertility_recommendations enable row level security;

drop policy if exists fert_rec_own on public.fertility_recommendations;
create policy fert_rec_own on public.fertility_recommendations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists fert_rec_plot_idx
  on public.fertility_recommendations (plot_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Nota de auditoria (Fase 0.3): a coluna payload guarda a Recomendacao5a
-- completa, que agora inclui regra.versao / regra.fonte / regra.catalogo — o
-- histórico salvo carrega a versão de regra que o gerou, sem coluna extra.
-- ----------------------------------------------------------------------------
