-- ============================================================
-- Seguro-fiança Porto Seguro — campos novos em contratos
-- Admeasy — proposta para revisão, NÃO APLICADA
-- ============================================================
-- ATENÇÃO: proposta para revisão. Não foi rodada contra o banco de
-- produção. Idempotente — pode ser executada mais de uma vez sem erro,
-- pois cada ADD COLUMN só age se a coluna ainda não existir.
--
-- Contexto: os dumps de schema versionados neste repositório
-- (schema.sql e supabase/schema.sql) estão desatualizados e nem batem
-- entre si — nenhum dos dois reflete colunas que já existem de fato em
-- produção hoje (ex.: valor_seguro_fianca, comissao_seguro_fianca,
-- seguradora_fianca, apolice_fianca em contratos), adicionadas em fase
-- anterior via ALTER TABLE manual rodado direto no SQL Editor. Esta
-- migration NÃO deve ser usada para inferir o schema atual — ela só
-- adiciona os 5 campos genuinamente novos identificados no diagnóstico
-- desta feature (ver relatório da branch feature/seguro-fianca-porto).
--
-- Todos os campos são opcionais (nullable) — contratos antigos
-- continuam abrindo e salvando normalmente sem preenchê-los.

alter table contratos
  add column if not exists responsavel_pagamento_premio text
    check (responsavel_pagamento_premio in ('locatario', 'locador')),
  add column if not exists inicio_vigencia_seguro date,
  add column if not exists fim_vigencia_seguro date,
  add column if not exists cobertura_danos_imovel boolean default false,
  add column if not exists cobertura_pintura_interna boolean default false;

-- ── Rollback ─────────────────────────────────────────────────
-- alter table contratos
--   drop column if exists responsavel_pagamento_premio,
--   drop column if exists inicio_vigencia_seguro,
--   drop column if exists fim_vigencia_seguro,
--   drop column if exists cobertura_danos_imovel,
--   drop column if exists cobertura_pintura_interna;
