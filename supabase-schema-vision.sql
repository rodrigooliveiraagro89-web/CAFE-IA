-- ============================================================
-- AGRYN — Diagnóstico por foto (IA): cota mensal
-- Rodar no Supabase Studio → SQL Editor → New query → Run
-- Idempotente. Espelha o par soil_usage / check_and_increment_soil_usage.
-- ============================================================

create table if not exists public.vision_usage (
  user_id uuid not null references auth.users on delete cascade,
  period text not null,            -- 'YYYY-MM'
  count int not null default 0,
  primary key (user_id, period)
);

alter table public.vision_usage enable row level security;

drop policy if exists "vision_usage_own" on public.vision_usage;
create policy "vision_usage_own" on public.vision_usage
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.check_and_increment_vision_usage(
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

  insert into public.vision_usage (user_id, period, count)
  values (v_uid, p_period, 0)
  on conflict (user_id, period) do nothing;

  select count into v_count
  from public.vision_usage
  where user_id = v_uid and period = p_period
  for update;

  if v_count >= p_limit then
    return json_build_object('allowed', false, 'count', v_count, 'limit', p_limit);
  end if;

  update public.vision_usage
  set count = count + 1
  where user_id = v_uid and period = p_period
  returning count into v_count;

  return json_build_object('allowed', true, 'count', v_count, 'limit', p_limit);
end;
$$;
