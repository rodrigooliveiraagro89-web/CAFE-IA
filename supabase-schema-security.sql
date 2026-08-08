-- AGRYN — endurecimento de autorização, anexos do caderno e cobrança.
-- Reexecutável. Aplicado em produção como migration `cafe_focus_security_and_attachments`.

alter table public.field_records
  add column if not exists attachments jsonb not null default '[]'::jsonb;

create table if not exists public.billing_events (
  event_id text primary key,
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;
revoke all on public.billing_events from anon, authenticated;
drop policy if exists billing_events_no_client_access on public.billing_events;
create policy billing_events_no_client_access on public.billing_events for all to authenticated
  using (false) with check (false);

-- O cliente lê o perfil e só pode alterar nome/tipo. Plano e trial são
-- atributos de autorização e ficam exclusivamente no backend service_role.
drop policy if exists perfil_proprio_all on public.profiles;
drop policy if exists perfil_proprio_select on public.profiles;
drop policy if exists perfil_proprio_update on public.profiles;
create policy perfil_proprio_select on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy perfil_proprio_update on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke all on public.profiles from anon;
revoke insert, delete, truncate, references, trigger on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (nome, tipo) on public.profiles to authenticated;

-- Dados operacionais: autenticado + dono da linha e relação pai do mesmo dono.
revoke all on public.properties, public.plots, public.field_records from anon;
grant select, insert, update, delete on public.properties, public.plots, public.field_records to authenticated;

drop policy if exists properties_own on public.properties;
drop policy if exists properties_select on public.properties;
drop policy if exists properties_insert on public.properties;
drop policy if exists properties_update on public.properties;
drop policy if exists properties_delete on public.properties;
create policy properties_select on public.properties for select to authenticated using ((select auth.uid()) = user_id);
create policy properties_insert on public.properties for insert to authenticated with check ((select auth.uid()) = user_id);
create policy properties_update on public.properties for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy properties_delete on public.properties for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists plots_own on public.plots;
drop policy if exists plots_select on public.plots;
drop policy if exists plots_insert on public.plots;
drop policy if exists plots_update on public.plots;
drop policy if exists plots_delete on public.plots;
create policy plots_select on public.plots for select to authenticated using ((select auth.uid()) = user_id);
create policy plots_insert on public.plots for insert to authenticated with check (
  (select auth.uid()) = user_id and exists (
    select 1 from public.properties p where p.id = property_id and p.user_id = (select auth.uid())
  )
);
create policy plots_update on public.plots for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id and exists (
    select 1 from public.properties p where p.id = property_id and p.user_id = (select auth.uid())
  )
);
create policy plots_delete on public.plots for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists field_records_own on public.field_records;
drop policy if exists field_records_select on public.field_records;
drop policy if exists field_records_insert on public.field_records;
drop policy if exists field_records_update on public.field_records;
drop policy if exists field_records_delete on public.field_records;
create policy field_records_select on public.field_records for select to authenticated using ((select auth.uid()) = user_id);
create policy field_records_insert on public.field_records for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.properties p where p.id = property_id and p.user_id = (select auth.uid()))
  and exists (select 1 from public.plots t where t.id = plot_id and t.property_id = property_id and t.user_id = (select auth.uid()))
);
create policy field_records_update on public.field_records for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.properties p where p.id = property_id and p.user_id = (select auth.uid()))
  and exists (select 1 from public.plots t where t.id = plot_id and t.property_id = property_id and t.user_id = (select auth.uid()))
);
create policy field_records_delete on public.field_records for delete to authenticated using ((select auth.uid()) = user_id);

-- Bucket privado: até 8 MiB por arquivo, fotos e áudio. A primeira pasta é o UUID do usuário.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'field-attachments', 'field-attachments', false, 8388608,
  array['image/jpeg','image/png','image/webp','audio/webm','audio/mp4','audio/mpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists field_attachments_select on storage.objects;
drop policy if exists field_attachments_insert on storage.objects;
drop policy if exists field_attachments_delete on storage.objects;
create policy field_attachments_select on storage.objects for select to authenticated
  using (bucket_id = 'field-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy field_attachments_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'field-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy field_attachments_delete on storage.objects for delete to authenticated
  using (bucket_id = 'field-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Funções de cota: search_path fixo e execução apenas autenticada.
alter function public.check_and_increment_ndvi_usage(text, integer) set search_path = public, pg_temp;
alter function public.check_and_increment_chat_usage(text, integer) set search_path = public, pg_temp;
alter function public.check_and_increment_soil_usage(text, integer) set search_path = public, pg_temp;
alter function public.check_and_increment_vision_usage(text, integer) set search_path = public, pg_temp;
revoke execute on function public.check_and_increment_ndvi_usage(text, integer) from public, anon;
revoke execute on function public.check_and_increment_chat_usage(text, integer) from public, anon;
revoke execute on function public.check_and_increment_soil_usage(text, integer) from public, anon;
revoke execute on function public.check_and_increment_vision_usage(text, integer) from public, anon;
grant execute on function public.check_and_increment_ndvi_usage(text, integer) to authenticated;
grant execute on function public.check_and_increment_chat_usage(text, integer) to authenticated;
grant execute on function public.check_and_increment_soil_usage(text, integer) to authenticated;
grant execute on function public.check_and_increment_vision_usage(text, integer) to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Cotação pública é leitura; escrita fica restrita ao backend/administrador.
drop policy if exists cotacoes_cafe_write_consultor on public.cotacoes_cafe;
revoke insert, update, delete, truncate on public.cotacoes_cafe from anon, authenticated;

create index if not exists properties_user_id_idx on public.properties(user_id);
create index if not exists plots_user_id_idx on public.plots(user_id);
create index if not exists field_records_user_id_idx on public.field_records(user_id);
create index if not exists field_records_plot_id_idx on public.field_records(plot_id);
create index if not exists billing_events_user_id_idx on public.billing_events(user_id);
create index if not exists ndvi_results_user_id_idx on public.ndvi_results(user_id);
create index if not exists soil_analyses_user_id_idx on public.soil_analyses(user_id);

-- Evita reavaliar auth.uid() para cada linha nas tabelas operacionais antigas.
alter policy estado_proprio_all on public.farm_state
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy ndvi_usage_own on public.ndvi_usage
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy ndvi_results_own on public.ndvi_results
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy chat_usage_own on public.chat_usage
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy vision_usage_own on public.vision_usage
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy soil_analyses_own on public.soil_analyses
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy soil_usage_own on public.soil_usage
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
