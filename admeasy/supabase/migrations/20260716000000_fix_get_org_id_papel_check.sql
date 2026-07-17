-- ============================================================
-- Correção — get_org_id() não valida o papel do vínculo
-- Admeasy Connect — PROPOSTA, NÃO APLICADA
-- ============================================================
-- ATENÇÃO: proposta para revisão. NÃO aplicada a nenhum banco (nem
-- homologação, nem produção) nesta sessão.
--
-- ORIGEM DO ACHADO (2026-07-17, investigação da varredura de
-- autorização em preview/homologacao-teste): em admeasy-homologacao,
-- os usuários fictícios locador.homolog@teste.local e
-- locatario.homolog@teste.local possuem, ALÉM da linha esperada em
-- public.clientes (usuario_portal_id preenchido), uma linha em
-- public.usuarios_organizacao com papel = 'locador'/'locatario' e uma
-- linha em public.users com perfil = 'corretor' — NENHUMA das duas
-- foi criada por scripts/seed-homologacao.mjs (que só grava
-- usuarios_organizacao/users para o staff). A origem mais provável é
-- um gatilho (trigger) já existente no schema base, de antes deste
-- repositório rastrear migrations — não encontrado em nenhum arquivo
-- versionado.
--
-- IMPACTO: como get_org_id() (conforme documentado nos comentários de
-- 20260712000000_habilitar_rls.sql) resolve a organização só
-- confirmando "existe uma linha em usuarios_organizacao pra este
-- auth.uid()", sem checar o valor de "papel", um locador/locatário
-- com essa linha indevida passa a ser tratado pelas policies
-- "org_isolation" (financeiro, imóveis, contratos, clientes,
-- fornecedores etc.) exatamente como um membro real da equipe —
-- inclusive contornando qualquer proteção feita só no frontend
-- (menu escondido, layout interno bloqueado, redirecionamento no
-- login), porque a chamada direta à API REST do Supabase (fora do
-- app, com o token do próprio usuário) continuaria autorizada pela
-- RLS.
--
-- CORREÇÃO: get_org_id() passa a exigir também papel in ('admin',
-- 'corretor') — os dois únicos papéis de STAFF reconhecidos pelo
-- produto (ver lib/OrganizationContext.tsx e app/login/page.tsx). Um
-- vínculo com papel 'locador'/'locatario' (indevido ou não) deixa de
-- resolver organização nenhuma, e todas as policies "org_isolation"
-- passam a negar por padrão.
--
-- ⚠️ PRÉ-REQUISITO REAL antes de aplicar: este arquivo assume a
-- definição de get_org_id() documentada nos comentários das migrations
-- já aplicadas (resolve só por usuarios_organizacao.user_id =
-- auth.uid(), sem outro filtro) — mas a função em si nunca foi
-- versionada (faz parte do schema-base, anterior a este repositório
-- rastrear migrations). ANTES de rodar este arquivo, confirme a
-- definição atual, ao vivo, no SQL Editor:
--
--   select pg_get_functiondef('public.get_org_id()'::regprocedure);
--
-- Se o corpo atual for diferente do assumido abaixo (ex.: já tiver
-- outro filtro, ou vier de uma tabela diferente), PARE e ajuste este
-- arquivo antes de aplicar — não sobrescreva às cegas uma função que
-- outras partes do sistema podem depender de um comportamento mais
-- específico do que o documentado aqui.
--
-- NÃO corrige a causa raiz de COMO essas linhas indevidas foram
-- criadas (o gatilho/mecanismo que gerou usuarios_organizacao/users
-- pra clientes do portal) — só neutraliza o efeito nas policies de
-- RLS. Recomendado investigar separadamente (consultar
-- information_schema.triggers / pg_trigger na tabela public.clientes)
-- antes de rodar novos seeds ou liberar acesso de portal em produção.
-- ============================================================

create or replace function public.get_org_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select organization_id
  from public.usuarios_organizacao
  where user_id = auth.uid()
    and papel in ('admin', 'corretor')
  limit 1
$$;

revoke execute on function public.get_org_id() from anon, public;

-- ============================================================
-- ROLLBACK (2026-07-17) — SOMENTE DOCUMENTADO, NÃO EXECUTAR
-- AUTOMATICAMENTE. Restaura o comportamento sem checagem de papel —
-- só usar se esta correção precisar ser revertida e o comportamento
-- documentado acima for confirmado como o original correto.
--
-- create or replace function public.get_org_id()
-- returns uuid
-- language sql stable security definer
-- set search_path = ''
-- as $$
--   select organization_id
--   from public.usuarios_organizacao
--   where user_id = auth.uid()
--   limit 1
-- $$;
-- ============================================================
