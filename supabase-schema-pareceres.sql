-- AGRYN — Pareceres técnicos (technical_reviews) do consultor↔produtor (§22).
-- A tabela já existia mas suas policies tinham o furo cross-tenant
-- (c.property_id = c.property_id, sempre verdadeiro). Aqui está o estado FINAL,
-- endurecido após revisão de segurança adversarial. Rodar no SQL Editor.

alter table public.technical_reviews enable row level security;

-- LEITURA: dono OU colaborador ativo DESTA propriedade (can_view_property correlaciona certo).
drop policy if exists "technical_reviews_select" on public.technical_reviews;
create policy "technical_reviews_select" on public.technical_reviews
  for select to authenticated
  using (public.can_view_property(property_id));

-- ESCRITA (insert): só o próprio autor, e só se for DONO ou colaborador
-- 'agronomist' ATIVO DESTA propriedade; se houver plot, ele pertence à propriedade.
drop policy if exists "technical_reviews_insert" on public.technical_reviews;
create policy "technical_reviews_insert" on public.technical_reviews
  for insert to authenticated
  with check (
    reviewer_id = (select auth.uid())
    and (
      exists (select 1 from public.properties p
              where p.id = technical_reviews.property_id and p.user_id = (select auth.uid()))
      or exists (select 1 from public.property_collaborators c
                 where c.property_id = technical_reviews.property_id
                   and c.member_id = (select auth.uid())
                   and c.role = 'agronomist' and c.status = 'active')
    )
    and (
      plot_id is null
      or exists (select 1 from public.plots p
                 where p.id = technical_reviews.plot_id
                   and p.property_id = technical_reviews.property_id)
    )
  );

-- APPEND-ONLY: pareceres não se editam (correção = novo parecer). Sem UPDATE, o
-- RLS nega qualquer update — fecha o furo de repontar property_id via PATCH.
drop policy if exists "technical_reviews_update" on public.technical_reviews;

-- DELETE: o AUTOR que ainda tem acesso, OU o dono da propriedade (moderação).
drop policy if exists "technical_reviews_delete" on public.technical_reviews;
create policy "technical_reviews_delete" on public.technical_reviews
  for delete to authenticated
  using (
    (reviewer_id = (select auth.uid()) and public.can_view_property(property_id))
    or exists (select 1 from public.properties p
               where p.id = technical_reviews.property_id and p.user_id = (select auth.uid()))
  );

-- Autoria server-side: o cliente NÃO define reviewer_name (senão poderia forjar
-- a autoria do parecer). Um trigger preenche a partir do perfil do autenticado.
create or replace function public.set_review_reviewer_name()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select coalesce(nullif(p.nome, ''), u.email, 'Técnico')
    into new.reviewer_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = auth.uid();
  return new;
end;
$$;
drop trigger if exists technical_reviews_set_name on public.technical_reviews;
create trigger technical_reviews_set_name
  before insert on public.technical_reviews
  for each row execute function public.set_review_reviewer_name();

-- RPC p/ a UI só oferecer o formulário a quem pode escrever (espelha o INSERT).
create or replace function public.can_review_property(prop uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.properties p where p.id = prop and p.user_id = auth.uid())
      or exists (select 1 from public.property_collaborators c
                 where c.property_id = prop and c.member_id = auth.uid()
                   and c.role = 'agronomist' and c.status = 'active');
$$;
revoke all on function public.can_review_property(uuid) from public;
grant execute on function public.can_review_property(uuid) to authenticated;

create index if not exists technical_reviews_property_idx
  on public.technical_reviews (property_id, created_at desc);

-- Hardening compartilhado (colaboração): o acesso por invited_email exige e-mail
-- VERIFICADO no JWT; sem isso, cai no vínculo por member_id. Reforça o furo do
-- e-mail não verificado. (Reforça supabase-schema-colaboracao.sql.)
create or replace function public.can_view_property(prop uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.properties p where p.id = prop and p.user_id = auth.uid()
  ) or exists (
    select 1 from public.property_collaborators c
    where c.property_id = prop and c.status = 'active'
      and (
        c.member_id = auth.uid()
        or (
          coalesce((auth.jwt() ->> 'email_verified')::boolean, false)
          and lower(c.invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
      )
  );
$$;
