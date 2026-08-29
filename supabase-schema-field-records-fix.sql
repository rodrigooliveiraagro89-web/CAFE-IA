-- AGRYN — Correção da correlação talhão↔propriedade nas policies de field_records.
-- As policies de INSERT/UPDATE tinham `t.property_id = t.property_id` (sempre
-- verdadeiro), então o talhão do registro não era exigido pertencer à MESMA
-- propriedade do registro. NÃO era furo cross-tenant (tudo exige auth.uid() dono
-- do registro, da propriedade E do talhão), mas permitia inconsistência
-- referencial nos dados do próprio usuário. Aplicado no Supabase em 2026-08.

drop policy if exists "field_records_insert" on public.field_records;
create policy "field_records_insert" on public.field_records
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.properties p
                where p.id = field_records.property_id and p.user_id = (select auth.uid()))
    and exists (select 1 from public.plots t
                where t.id = field_records.plot_id
                  and t.property_id = field_records.property_id
                  and t.user_id = (select auth.uid()))
  );

drop policy if exists "field_records_update" on public.field_records;
create policy "field_records_update" on public.field_records
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.properties p
                where p.id = field_records.property_id and p.user_id = (select auth.uid()))
    and exists (select 1 from public.plots t
                where t.id = field_records.plot_id
                  and t.property_id = field_records.property_id
                  and t.user_id = (select auth.uid()))
  );
