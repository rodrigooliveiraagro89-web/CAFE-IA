-- =====================================================================
-- AGRYN — teste grátis do Pro (14 dias)
-- Cole no Supabase → SQL Editor → Run. Seguro rodar mais de uma vez.
-- trial_ate = fim do período de teste; null = nunca ativou.
-- =====================================================================

alter table public.profiles
  add column if not exists trial_ate timestamptz;
