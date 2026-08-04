-- ============================================================
-- Cláusulas adicionais por contrato — Admeasy
-- Proposta para revisão, NÃO APLICADA
-- ============================================================
-- ATENÇÃO: proposta para revisão. Não foi rodada contra o banco de
-- produção nem de homologação. Idempotente — pode ser executada mais
-- de uma vez sem erro.
--
-- Permite que o analista digite cláusulas extras, específicas de um
-- contrato individual, que são anexadas ao final da sequência fixa de
-- cláusulas no PDF gerado (numeradas a partir da 32ª — nunca inseridas
-- no meio, pra não invalidar referências cruzadas já existentes no
-- texto fixo, ex.: a cláusula 2ª cita "a CLÁUSULA 1ª" literalmente).
--
-- Nullable/default '[]' — contratos antigos continuam abrindo e
-- salvando normalmente sem essa coluna preenchida.

alter table contratos
  add column if not exists clausulas_extras jsonb default '[]'::jsonb;

-- ── Rollback ─────────────────────────────────────────────────
-- alter table contratos
--   drop column if exists clausulas_extras;
