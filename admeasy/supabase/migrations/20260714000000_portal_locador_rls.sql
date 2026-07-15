-- ============================================================
-- Portal do locador — políticas de leitura (RLS)
-- Admeasy Connect — preparação, NÃO APLICADA AUTOMATICAMENTE
-- ============================================================
-- ATENÇÃO: este script é uma PROPOSTA para revisão. Não foi rodado
-- contra o banco de produção. Revisar linha a linha antes de aplicar.
--
-- REVISADO em 2026-07-14 (Etapa 2 da revisão de segurança — ver
-- docs/SECURITY_HARDENING_REVIEW.md): adicionada uma camada extra de
-- isolamento por organização em cima do vínculo de locador, e
-- comentários reforçando que esta versão é estritamente SELECT.
--
-- Pré-requisito: as funções auxiliares abaixo já devem existir (foram
-- criadas em supabase/migrations/20260712000000_habilitar_rls.sql):
--   - public.get_org_id()            -> organização do STAFF interno
--   - public.get_portal_cliente_id() -> cliente_id do usuário logado
--     no portal (locatário OU locador), via clientes.usuario_portal_id
--   - public.is_admeasy_admin()      -> admin master da AdmEasy
--
-- Este arquivo SÓ ADICIONA políticas novas (locador + duas lacunas
-- encontradas em imoveis/vistorias que hoje quebram até o portal do
-- LOCATÁRIO, que já está em produção) e uma função auxiliar nova.
-- Nenhuma política existente é removida ou alterada. Usa
-- "drop policy if exists" apenas no nome da própria política nova,
-- para o script poder ser reexecutado sem erro (idempotente), sem
-- afetar políticas de outros nomes.
--
-- NÃO desativa RLS em nenhuma tabela.
-- NÃO concede acesso amplo/global.
-- NÃO usa service role.
-- NÃO altera políticas de staff/organização (org_isolation).
-- NÃO concede UPDATE, INSERT ou DELETE ao locador nesta versão —
-- todas as políticas abaixo são "for select".
-- NÃO altera as políticas de locatário existentes (essas têm um risco
-- separado, corrigido em migration própria:
-- supabase/migrations/20260714010000_hardening_cobrancas_demandas.sql).


-- ── 0) Função auxiliar — organização do usuário logado no portal ───
-- Isolamento por organização pro portal não pode usar get_org_id()
-- (essa resolve só quem tem linha em "users", que é só o staff
-- interno). Esta função espelha a mesma lógica pro lado do portal:
-- resolve a organização a partir do próprio cliente vinculado ao
-- usuário autenticado. É redundante em relação ao isolamento que já
-- vem "de graça" via FK (locador_id só aponta pra clientes da mesma
-- organização do contrato) — mas adiciona uma camada extra e
-- independente de defesa, que não depende só da integridade
-- referencial estar sempre correta.

create or replace function public.get_portal_organization_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select organization_id from public.clientes where id = public.get_portal_cliente_id()
$$;

revoke execute on function public.get_portal_organization_id() from anon, public;


-- ── 1) CONTRATOS — locador lê os próprios contratos ────────────────
-- Só SELECT. Vínculo direto (locador_id) + isolamento explícito por
-- organização como camada extra.

drop policy if exists "portal_locador" on public.contratos;
create policy "portal_locador" on public.contratos
  for select
  using (
    locador_id = public.get_portal_cliente_id()
    and organization_id = public.get_portal_organization_id()
  );


-- ── 2) DEMANDAS — locador lê as demandas dos seus imóveis ──────────
-- Só SELECT. A ação de aprovar/recusar orçamento NÃO é liberada por
-- UPDATE direto aqui — ver docs/SECURITY_HARDENING_REVIEW.md: a
-- recomendação continua sendo uma função RPC (security definer)
-- dedicada, a construir depois, que valida a transição de status e
-- não deixa o locador tocar em orcamento/fornecedor_id/valor_final.
--
-- Dependência encontrada nesta revisão: hoje NENHUM fluxo do sistema
-- (nem o formulário interno de staff fora do caminho normal, nem o
-- portal do locatário) grava um status "aguardando_locador" — e o
-- formulário de nova demanda do PORTAL DO LOCATÁRIO não preenche
-- locador_id ao criar. Ou seja: mesmo com esta política aplicada, o
-- locador não veria nada aparecer em "Solicitações" até essas duas
-- lacunas de aplicação serem corrigidas (fora do escopo desta
-- migration — ver docs/SECURITY_HARDENING_REVIEW.md, seção de
-- mudanças de frontend/backend necessárias).

drop policy if exists "portal_locador" on public.demandas;
create policy "portal_locador" on public.demandas
  for select
  using (
    locador_id = public.get_portal_cliente_id()
    and organization_id = public.get_portal_organization_id()
  );


-- ── 3) COBRANÇAS — locador lê as cobranças dos seus contratos ──────
-- Só SELECT. Nunca UPDATE — nem pra locatário (ver migration de
-- hardening) nem pra locador.

drop policy if exists "portal_locador_select" on public.cobrancas;
create policy "portal_locador_select" on public.cobrancas
  for select
  using (
    locador_id = public.get_portal_cliente_id()
    and organization_id = public.get_portal_organization_id()
  );


-- ── 4) IMÓVEIS — leitura pelo dono OU por quem tem contrato ativo ──
-- LACUNA ENCONTRADA (não é só do locador): a migration anterior
-- ligou RLS em "imoveis" mas só criou política pra staff
-- (org_isolation) e pro admin master. Nenhuma política cobre o
-- portal — isso já afeta o LOCATÁRIO em produção hoje: a consulta
-- em app/portal/page.tsx traz "contrato.imovel:imoveis(...)" via
-- join, e o Postgres aplica RLS também na tabela unida. Sem uma
-- política de leitura em "imoveis" pro portal, esse campo vem vazio
-- pro locatário também, não só pro locador.
--
-- "imoveis" não tem organization_id vindo do lado do vínculo (usa
-- proprietario_id direto, ou o contrato) — o EXISTS já garante que o
-- contrato encontrado pertence à organização do imóvel por
-- construção (contratos.imovel_id -> imoveis.id na mesma tabela);
-- adiciono a checagem de organização explícita mesmo assim, como
-- camada extra.

drop policy if exists "portal_leitura" on public.imoveis;
create policy "portal_leitura" on public.imoveis
  for select
  using (
    organization_id = public.get_portal_organization_id()
    and (
      proprietario_id = public.get_portal_cliente_id()
      or exists (
        select 1 from public.contratos c
        where c.imovel_id = imoveis.id
          and (
            c.locador_id = public.get_portal_cliente_id()
            or c.locatario_id = public.get_portal_cliente_id()
          )
      )
    )
  );


-- ── 5) VISTORIAS — leitura via contrato do imóvel ───────────────────
-- "vistorias" não tem locador_id/locatario_id nem contrato_id — só
-- imovel_id, mais dois campos de texto livre (locadores/locatarios,
-- nomes digitados, não são FK). A única ligação confiável é via
-- imovel_id -> contratos.imovel_id.

drop policy if exists "portal_leitura" on public.vistorias;
create policy "portal_leitura" on public.vistorias
  for select
  using (
    organization_id = public.get_portal_organization_id()
    and exists (
      select 1 from public.contratos c
      where c.imovel_id = vistorias.imovel_id
        and (
          c.locador_id = public.get_portal_cliente_id()
          or c.locatario_id = public.get_portal_cliente_id()
        )
    )
  );


-- ============================================================
-- Fora do escopo desta migration (decisão pendente, ver docs):
--   - Storage do bucket "documentos" — ver
--     docs/STORAGE_PRIVATE_MIGRATION_PROPOSAL.md.
--   - RPC de aprovar/recusar demanda (locador) — ainda não construída.
--   - Correção de aplicação: preencher demandas.locador_id ao criar
--     pelo portal do locatário, e algum fluxo passar a usar o status
--     "aguardando_locador" — sem isso, a política acima nunca mostra
--     nada pro locador na prática.
-- ============================================================
