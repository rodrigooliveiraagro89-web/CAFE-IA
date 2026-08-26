-- ============================================================================
-- AGRYN Café — Fase 1.2: campos do Talhão persistidos
-- Adiciona à tabela plots os campos que antes viviam transitórios no painel
-- (produtividade esperada/anterior) e os que faltavam (altitude, status,
-- observações). Aditivo e idempotente — seguro em ambiente novo e na produção.
-- ============================================================================
alter table public.plots
  add column if not exists altitude text,                 -- metros
  add column if not exists produtividade_esperada text,   -- sc/ha
  add column if not exists produtividade_anterior text,   -- sc/ha (bienalidade)
  add column if not exists status text,                   -- ativo/formacao/recepado/reforma/inativo
  add column if not exists observacoes text;
