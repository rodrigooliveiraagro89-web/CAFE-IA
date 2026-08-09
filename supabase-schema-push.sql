-- AGRYN — Entrega de alertas por Web Push (item 6 do plano de robustez).
-- Aplicado no Supabase em 2026-08 (migração push_notifications).
--
-- Fluxo: o app assina o navegador (push_subscriptions); a Edge Function
-- push-alerts roda agendada, calcula os alertas no servidor a partir das
-- tabelas de dados e dispara a notificação; alert_deliveries evita reenvio
-- em spam do mesmo alerta.

-- Assinaturas Web Push por dispositivo do usuário.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
create policy "push_subscriptions_own" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Registro de entrega para não reenviar o mesmo alerta em spam.
create table if not exists public.alert_deliveries (
  user_id uuid not null references auth.users on delete cascade,
  alert_key text not null,
  title text not null default '',
  sent_at timestamptz not null default now(),
  primary key (user_id, alert_key)
);
alter table public.alert_deliveries enable row level security;
-- Só leitura pelo dono; a escrita é exclusiva da Edge Function (service role).
drop policy if exists "alert_deliveries_own_read" on public.alert_deliveries;
create policy "alert_deliveries_own_read" on public.alert_deliveries
  for select using (auth.uid() = user_id);

-- Segredo do cron gerado DENTRO do banco (ninguém digita/coloca segredo). A
-- Edge Function push-alerts lê o mesmo valor via service role e compara com o
-- header x-cron-secret — a trava de acesso continua ativa, sem segredo humano
-- em env. Tabela sem policies de RLS: anon/authenticated não leem.
create table if not exists public.function_secrets (
  name text primary key,
  value text not null default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
);
alter table public.function_secrets enable row level security;
insert into public.function_secrets (name) values ('push_cron') on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- AGENDAMENTO — dispara todo dia às 11:00 UTC (~08:00 BRT). O segredo vem da
-- tabela acima (nenhum literal na query).
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'agryn-push-alerts',
  '0 11 * * *',
  $$
  select net.http_post(
    url := 'https://eqtacmanqmdcjvxezuah.supabase.co/functions/v1/push-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.function_secrets where name = 'push_cron')
    ),
    body := '{}'::jsonb
  )
  $$
);

-- Disparo manual para testar na hora (mesma query do cron):
-- select net.http_post(
--   url := 'https://eqtacmanqmdcjvxezuah.supabase.co/functions/v1/push-alerts',
--   headers := jsonb_build_object('Content-Type','application/json',
--     'x-cron-secret', (select value from public.function_secrets where name = 'push_cron')),
--   body := '{}'::jsonb
-- );  -- depois: select status_code, content from net._http_response order by id desc limit 1;
