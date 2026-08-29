-- AGRYN — CREATE TABLE versionado das tabelas usadas em runtime que ainda não
-- tinham definição no repo (auditoria final). Mesma dívida que a Fase 0.4 fechou
-- para ndvi_results/fertility_recommendations: sem isto, um ambiente NOVO não
-- sobe. Fiel à produção (colunas/tipos/índices/RLS conferidos no banco).
-- Idempotente: create table/column/index if not exists + drop/create policy.

-- ============================================================================
-- 1) property_collaborators — colaboração (dono compartilha propriedade).
--    (as funções e as policies de LEITURA das demais tabelas ficam em
--     supabase-schema-colaboracao.sql; aqui a TABELA e as policies dela mesma.)
-- ============================================================================
create table if not exists public.property_collaborators (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  owner_id      uuid not null references auth.users on delete cascade,
  member_id     uuid references auth.users on delete set null,
  invited_email text not null,
  role          text not null default 'agronomist',
  status        text not null default 'pending',
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz
);
create unique index if not exists property_collaborators_property_email_idx
  on public.property_collaborators (property_id, lower(invited_email));
create unique index if not exists property_collaborators_property_member_idx
  on public.property_collaborators (property_id, member_id) where (member_id is not null);
create index if not exists property_collaborators_member_idx on public.property_collaborators (member_id);
create index if not exists property_collaborators_owner_idx on public.property_collaborators (owner_id);

alter table public.property_collaborators enable row level security;

drop policy if exists "property_collaborators_select" on public.property_collaborators;
create policy "property_collaborators_select" on public.property_collaborators
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or member_id = (select auth.uid())
    or lower(invited_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );

drop policy if exists "property_collaborators_insert" on public.property_collaborators;
create policy "property_collaborators_insert" on public.property_collaborators
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.properties p
                where p.id = property_collaborators.property_id and p.user_id = (select auth.uid()))
  );

-- UPDATE: o dono, OU o convidado aceitando (vincula member_id + status='active').
drop policy if exists "property_collaborators_update" on public.property_collaborators;
create policy "property_collaborators_update" on public.property_collaborators
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    or lower(invited_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
  with check (
    (owner_id = (select auth.uid())
     and exists (select 1 from public.properties p
                 where p.id = property_collaborators.property_id and p.user_id = (select auth.uid())))
    or (lower(invited_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
        and member_id = (select auth.uid()) and status = 'active')
  );

drop policy if exists "property_collaborators_delete" on public.property_collaborators;
create policy "property_collaborators_delete" on public.property_collaborators
  for delete to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (select 1 from public.properties p
                where p.id = property_collaborators.property_id and p.user_id = (select auth.uid()))
  );

-- ============================================================================
-- 2) technical_reviews — pareceres técnicos (§22).
--    RLS/policies/trigger: ver supabase-schema-pareceres.sql. Aqui só a TABELA.
-- ============================================================================
create table if not exists public.technical_reviews (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  plot_id       uuid references public.plots(id) on delete cascade,
  reviewer_id   uuid not null references auth.users on delete cascade,
  reviewer_name text not null default '',
  status        text not null,
  notes         text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists technical_reviews_property_idx on public.technical_reviews (property_id, created_at desc);
create index if not exists technical_reviews_plot_idx on public.technical_reviews (plot_id, created_at desc);
create index if not exists technical_reviews_reviewer_idx on public.technical_reviews (reviewer_id);
alter table public.technical_reviews enable row level security;

-- ============================================================================
-- 3) notification_preferences — nível/ativação dos alertas (app + push cron).
-- ============================================================================
create table if not exists public.notification_preferences (
  user_id      uuid primary key references auth.users on delete cascade,
  min_severity text not null default 'media',
  active       boolean not null default true,
  updated_at   timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
drop policy if exists "notif_pref_own" on public.notification_preferences;
create policy "notif_pref_own" on public.notification_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- 4) shared_reports — HTML do relatório para link compartilhável (expira 30d).
-- ============================================================================
create table if not exists public.shared_reports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  property_name text not null default '',
  html          text not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '30 days')
);
create index if not exists shared_reports_expires_idx on public.shared_reports (expires_at);
alter table public.shared_reports enable row level security;
drop policy if exists "shared_reports_own" on public.shared_reports;
create policy "shared_reports_own" on public.shared_reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- 5) client_events — telemetria first-party (write-only p/ o usuário).
-- ============================================================================
create table if not exists public.client_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid default auth.uid() references auth.users on delete set null,
  kind        text not null,
  message     text not null default '',
  context     jsonb not null default '{}'::jsonb,
  path        text not null default '',
  app_version text not null default '',
  user_agent  text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists client_events_created_idx on public.client_events (created_at desc);
create index if not exists client_events_kind_idx on public.client_events (kind, created_at desc);
alter table public.client_events enable row level security;
drop policy if exists "client_events_insert" on public.client_events;
create policy "client_events_insert" on public.client_events
  for insert to anon, authenticated with check (true);

-- ============================================================================
-- 6) profiles — colunas de WhatsApp (opt-in dos alertas), usadas pelo app e cron.
-- ============================================================================
alter table public.profiles add column if not exists whatsapp text;
alter table public.profiles add column if not exists whatsapp_opt_in boolean not null default false;
