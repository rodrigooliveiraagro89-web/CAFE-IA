-- =====================================================================
-- AGRYN — coluna de plano comercial no perfil
-- Cole no Supabase → SQL Editor → Run. Seguro rodar mais de uma vez.
-- 'gratis' é o padrão; 'pro' será atribuído na contratação (manual por
-- enquanto; automática quando o gateway de pagamento entrar).
-- =====================================================================

alter table public.profiles
  add column if not exists plano text not null default 'gratis'
  check (plano in ('gratis', 'pro'));
