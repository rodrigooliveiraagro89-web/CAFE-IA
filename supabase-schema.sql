-- =====================================================================
-- Café Real IA — schema de contas + nuvem (Supabase)
-- Cole TODO este conteúdo no Supabase → SQL Editor → New query → Run.
-- Seguro rodar mais de uma vez (usa IF NOT EXISTS / OR REPLACE).
-- =====================================================================

-- 1) Perfil do usuário (1:1 com auth.users), com papel consultor/produtor
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  nome       text,
  tipo       text not null default 'produtor' check (tipo in ('consultor','produtor')),
  criado_em  timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "perfil_proprio_select" on public.profiles;
drop policy if exists "perfil_proprio_all"    on public.profiles;
create policy "perfil_proprio_all" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- 2) Estado do app por usuário (blob JSON = os mesmos dados que hoje ficam
--    no navegador: propriedade, análises de solo, histórico, clima, etc.)
create table if not exists public.farm_state (
  user_id       uuid primary key references auth.users on delete cascade,
  data          jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);
alter table public.farm_state enable row level security;

drop policy if exists "estado_proprio_all" on public.farm_state;
create policy "estado_proprio_all" on public.farm_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) Cria o perfil automaticamente quando o usuário se cadastra,
--    lendo nome/tipo enviados no signup (raw_user_meta_data).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nome, tipo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', ''),
    coalesce(new.raw_user_meta_data->>'tipo', 'produtor')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Pronto. Depois disso, em Authentication → Providers, deixe "Email" ativo.
-- Para testar sem confirmar e-mail: Authentication → Providers → Email →
-- desligue "Confirm email" (só para testes).
