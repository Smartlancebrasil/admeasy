-- ============================================================
-- Correção — get_org_id() não valida o papel do vínculo
-- Admeasy Connect — PROPOSTA, revisada com dados confirmados ao vivo
-- ============================================================
-- ATENÇÃO: proposta para revisão. NÃO aplicada a produção. Aplicar
-- SOMENTE em admeasy-homologacao, e só depois de aprovação explícita
-- do SQL final (este arquivo).
--
-- ORIGEM DO ACHADO (2026-07-17, varredura de autorização em
-- preview/homologacao-teste): em admeasy-homologacao, os usuários
-- fictícios locador.homolog@teste.local e locatario.homolog@teste.local
-- possuem, além da linha esperada em public.clientes
-- (usuario_portal_id preenchido), uma linha em
-- public.usuarios_organizacao com papel = 'locador'/'locatario' e uma
-- linha em public.users com perfil = 'corretor' — NENHUMA das duas foi
-- criada por scripts/seed-homologacao.mjs (que só grava
-- usuarios_organizacao/users para o staff).
--
-- CAUSA DAS LINHAS INDEVIDAS: **NÃO CONFIRMADA**. A hipótese inicial de
-- gatilho legado foi DESCARTADA por evidência direta — a consulta em
-- pg_trigger contra auth.users, public.users, public.clientes e
-- public.usuarios_organizacao (2026-07-17, admeasy-homologacao) só
-- retornou dois triggers, nenhum deles relacionado:
--   - trg_clientes em public.clientes -> update_updated_at
--   - trg_users em public.users -> update_updated_at
-- Não há trigger em auth.users nem em public.usuarios_organizacao
-- criando esses vínculos. A origem real (código da aplicação, rota de
-- cadastro, script antigo já removido, ou operação manual no painel)
-- permanece desconhecida e não é resolvida por esta migration — ela
-- só neutraliza o EFEITO nas policies de RLS, não a causa.
--
-- IMPACTO: get_org_id() (definição confirmada ao vivo em
-- admeasy-homologacao, 2026-07-17, via
-- select pg_get_functiondef('public.get_org_id()'::regprocedure)):
--
--   CREATE OR REPLACE FUNCTION public.get_org_id()
--    RETURNS uuid
--    LANGUAGE sql
--    STABLE SECURITY DEFINER
--    SET search_path TO ''
--   AS $function$
--     select uo.organization_id
--     from public.usuarios_organizacao uo
--     where uo.user_id = auth.uid()
--     limit 1
--   $function$
--
-- resolve a organização só confirmando "existe uma linha em
-- usuarios_organizacao pra este auth.uid()", sem checar "papel". Um
-- locador/locatário com essa linha indevida é tratado pelas 25
-- policies "org_isolation" já confirmadas como dependentes desta
-- função (clientes, cobrancas, contratos, despesas, fornecedores,
-- imoveis, users, organizations, vistorias, entre outras) exatamente
-- como um membro real da equipe — inclusive contornando qualquer
-- proteção feita só no frontend (menu escondido, layout interno
-- bloqueado, redirecionamento no login), porque uma chamada direta à
-- API REST do Supabase (fora do app, com o token do próprio usuário)
-- continuaria autorizada pela RLS.
--
-- DEPENDÊNCIAS VERIFICADAS AO VIVO (2026-07-17, admeasy-homologacao):
--   - 25 policies "org_isolation" dependem de get_org_id() — nenhuma
--     outra função pública chama get_org_id() internamente.
--   - get_portal_cliente_id() / get_portal_organization_id() (usadas
--     pelo portal do locador/locatário) são funções separadas, não
--     tocadas por esta migration — o portal externo não é afetado.
--
-- PRIVILÉGIOS ATUAIS (confirmados ao vivo, information_schema.routine_privileges):
--   PUBLIC, anon, authenticated, postgres, service_role — todos com EXECUTE.
--   O EXECUTE de "authenticated" hoje vem via PUBLIC (não há grant
--   individual explícito) — por isso a correção revoga de PUBLIC/anon
--   e CONCEDE EXPLICITAMENTE a authenticated e service_role, pra não
--   quebrar nenhuma policy de RLS por falta de permissão. "postgres"
--   não é tocado (dono da função, mantém acesso independente de grants).
--
-- CORREÇÃO: get_org_id() passa a exigir também uo.papel in ('admin',
-- 'corretor') — os dois únicos papéis de STAFF reconhecidos pelo
-- produto (ver lib/OrganizationContext.tsx e app/login/page.tsx). Um
-- vínculo com papel 'locador'/'locatario' (indevido ou não) deixa de
-- resolver organização nenhuma (retorna null), e todas as 25 policies
-- "org_isolation" passam a negar por padrão pra esse caso — null nunca
-- é igual a organization_id em SQL.
--
-- IDEMPOTENTE: create or replace function e revoke/grant podem ser
-- reexecutados sem erro (revoke de privilégio inexistente e grant de
-- privilégio já concedido são no-ops em Postgres, não falham).
-- ============================================================

create or replace function public.get_org_id()
returns uuid
language sql
stable
security definer
set search_path to ''
as $function$
  select uo.organization_id
  from public.usuarios_organizacao uo
  where uo.user_id = auth.uid()
    and uo.papel in ('admin', 'corretor')
  limit 1
$function$;

-- Revoga o acesso amplo (PUBLIC herdava para anon/authenticated) e
-- concede explicitamente só para as duas roles que realmente precisam:
-- authenticated (é quem dispara as policies de RLS que usam esta
-- função) e service_role (rotas de servidor, mesmo bypassando RLS).
-- anon nunca deveria ter tido EXECUTE aqui — não há fluxo anônimo que
-- precise resolver organização.
revoke execute on function public.get_org_id() from public;
revoke execute on function public.get_org_id() from anon;

grant execute on function public.get_org_id() to authenticated;
grant execute on function public.get_org_id() to service_role;

-- ============================================================
-- ROLLBACK (2026-07-17) — SOMENTE DOCUMENTADO, NÃO EXECUTAR
-- AUTOMATICAMENTE. Restaura a definição e os privilégios originais
-- (confirmados ao vivo acima) — só usar se esta correção precisar ser
-- revertida em admeasy-homologacao.
--
-- create or replace function public.get_org_id()
-- returns uuid
-- language sql
-- stable
-- security definer
-- set search_path to ''
-- as $function$
--   select uo.organization_id
--   from public.usuarios_organizacao uo
--   where uo.user_id = auth.uid()
--   limit 1
-- $function$;
--
-- grant execute on function public.get_org_id() to public;
-- grant execute on function public.get_org_id() to anon;
-- ============================================================
