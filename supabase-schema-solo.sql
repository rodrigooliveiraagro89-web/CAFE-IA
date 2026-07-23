-- ============================================================
-- AGRYN — Análise de Solo por IA
-- Rodar no Supabase Studio → SQL Editor → New query → Run
-- Idempotente: pode rodar mais de uma vez sem quebrar.
-- ============================================================

-- 1) Laudos de solo, vinculados ao talhão e ao dono (RLS)
create table if not exists public.soil_analyses (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  plot_id text not null,
  analysis_date date,
  laboratory text,
  source text not null,            -- 'foto' | 'pdf' | 'manual'
  values jsonb not null,           -- macros, fertilidade, micros
  created_at timestamptz not null default now()
);

alter table public.soil_analyses enable row level security;

drop policy if exists "soil_analyses_own" on public.soil_analyses;
create policy "soil_analyses_own" on public.soil_analyses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists soil_analyses_plot_idx
  on public.soil_analyses (plot_id, analysis_date desc);

-- 2) Contador de cota mensal (só a extração por IA consome; manual é livre)
create table if not exists public.soil_usage (
  user_id uuid not null references auth.users on delete cascade,
  period text not null,            -- 'YYYY-MM'
  count int not null default 0,
  primary key (user_id, period)
);

alter table public.soil_usage enable row level security;

drop policy if exists "soil_usage_own" on public.soil_usage;
create policy "soil_usage_own" on public.soil_usage
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) Checagem atômica: incrementa se ainda houver cota, senão nega.
--    security invoker → roda como o usuário, RLS aplica; lock 'for update'
--    evita corrida entre duas requisições simultâneas.
create or replace function public.check_and_increment_soil_usage(
  p_period text,
  p_limit int
)
returns json
language plpgsql
security invoker
as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into public.soil_usage (user_id, period, count)
  values (v_uid, p_period, 0)
  on conflict (user_id, period) do nothing;

  select count into v_count
  from public.soil_usage
  where user_id = v_uid and period = p_period
  for update;

  if v_count >= p_limit then
    return json_build_object('allowed', false, 'count', v_count, 'limit', p_limit);
  end if;

  update public.soil_usage
  set count = count + 1
  where user_id = v_uid and period = p_period
  returning count into v_count;

  return json_build_object('allowed', true, 'count', v_count, 'limit', p_limit);
end;
$$;
