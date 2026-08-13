-- AGRYN — Colaboração consultor↔produtor (item 7). Compartilhar propriedade em
-- LEITURA. A tabela property_collaborators já existia; aqui ficam as funções e
-- as políticas de leitura CORRIGIDAS (as originais tinham bugs: properties usava
-- c.property_id=c.id e plots/field_records usavam c.property_id=c.property_id,
-- sempre verdadeiro = furo). Aplicado no Supabase em 2026-08.

-- Funções SECURITY DEFINER evitam recursão de RLS e casam o colaborador por
-- member_id OU e-mail do convite.
create or replace function public.can_view_property(prop uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.properties p
    where p.id = prop and p.user_id = auth.uid()
  ) or exists (
    select 1 from public.property_collaborators c
    where c.property_id = prop
      and c.status = 'active'
      and (c.member_id = auth.uid()
           or lower(c.invited_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;

create or replace function public.can_view_plot(plot_key text)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.plots p
    where p.id::text = plot_key and public.can_view_property(p.property_id)
  );
$$;

revoke all on function public.can_view_property(uuid) from public;
revoke all on function public.can_view_plot(text) from public;
grant execute on function public.can_view_property(uuid) to authenticated;
grant execute on function public.can_view_plot(text) to authenticated;

-- Políticas de leitura para o colaborador (dono continua com as suas próprias).
drop policy if exists "properties_collaborator_select" on public.properties;
create policy "properties_collaborator_select" on public.properties
  for select to authenticated using (public.can_view_property(id));

drop policy if exists "plots_collaborator_select" on public.plots;
create policy "plots_collaborator_select" on public.plots
  for select to authenticated using (public.can_view_property(property_id));

drop policy if exists "field_records_collaborator_select" on public.field_records;
create policy "field_records_collaborator_select" on public.field_records
  for select to authenticated using (public.can_view_property(property_id));

drop policy if exists "soil_analyses_collaborator_select" on public.soil_analyses;
create policy "soil_analyses_collaborator_select" on public.soil_analyses
  for select to authenticated using (public.can_view_plot(plot_id));

drop policy if exists "ndvi_results_collaborator_select" on public.ndvi_results;
create policy "ndvi_results_collaborator_select" on public.ndvi_results
  for select to authenticated using (public.can_view_plot(plot_id));

-- Escrita continua exclusiva do dono (políticas *_insert/update/delete por
-- user_id, inalteradas). Convite/revogação em property_collaborators só pelo
-- dono da propriedade (política property_collaborators_insert/delete).
