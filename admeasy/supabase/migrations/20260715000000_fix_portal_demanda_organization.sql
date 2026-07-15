-- ============================================================
-- Correção — organization_id e imovel_id não validados em
-- demandas.portal_locatario_insert
-- Admeasy Connect — proposta para revisão, NÃO APLICADA
-- ============================================================
-- ATENÇÃO: proposta para revisão. NÃO aplicada ao banco de produção.
--
-- Corrige dois achados da auditoria final de segurança de RLS
-- (2026-07-15, ver docs/SECURITY_HARDENING_REVIEW.md), ambos na
-- policy "portal_locatario_insert" em "demandas" — criada em
-- 20260714010000_hardening_cobrancas_demandas.sql, JÁ MERGEADA na
-- main:
--
--   1) CRÍTICO: "organization_id" nunca era validado no WITH CHECK,
--      só "locatario_id". Um locatário autenticado podia, via chamada
--      REST direta (fora do app), inserir uma demanda informando um
--      "organization_id" de OUTRA organização, injetando dado num
--      tenant alheio.
--   2) Achado adicional (encontrado ao corrigir o item 1): "imovel_id"
--      só era sobrescrito quando já vinha nulo do client — se o
--      client mandasse um contrato_id inválido MAS um imovel_id
--      próprio, esse imovel_id sobrevivia sem validação nenhuma.
--
-- Corrigido com um único princípio: ou o contrato é validado (mesmo
-- locatário, mesma organização) e TODOS os campos de confiança são
-- sobrescritos incondicionalmente a partir dele, ou o INSERT inteiro
-- é rejeitado — nunca um meio-termo condicional.
--
-- Esta é uma MIGRATION CORRETIVA SEPARADA — não edita
-- 20260714010000_hardening_cobrancas_demandas.sql, que já foi
-- mergeada e pode já ter sido aplicada em outros ambientes
-- (homologação, por exemplo). Editar um arquivo já mergeado mudaria
-- silenciosamente o histórico de uma migration que outro ambiente já
-- rodou com o conteúdo antigo.
--
-- ── Pré-requisito real (não apenas recomendado) ────────────────────
-- Esta migration SUBSTITUI a função por trás da trigger e a policy
-- "portal_locatario_insert", ambas criadas em 20260714010000.
-- **Precisa ser aplicada DEPOIS de 20260714010000, sempre.** Se
-- alguém reaplicar 20260714010000 sozinha depois desta correção, ela
-- vai sobrescrever a função/policy de volta para a versão vulnerável
-- — esta migration precisa ser reaplicada logo em seguida nesse
-- cenário. Por segurança, o bloco abaixo FALHA COM ERRO (em vez de
-- aplicar silenciosamente fora de ordem) se o pré-requisito não for
-- encontrado.
--
-- ── Sobre a dependência de get_portal_organization_id() ────────────
-- Em vez de assumir que 20260714000000_portal_locador_rls.sql (quem
-- cria essa função) já rodou — o que criaria uma dependência de
-- ordem frágil, exatamente o tipo de risco operacional já visto nesta
-- revisão — esta migration cria/garante a MESMA função aqui também,
-- com "CREATE OR REPLACE" (idempotente): se 20260714000000 já rodou,
-- é só uma reafirmação idêntica; se ainda não rodou, a função passa
-- a existir a partir daqui. Isso elimina por completo a dependência
-- de ordem entre esta correção e 20260714000000 — pode aplicar em
-- qualquer ordem relativa entre as duas, desde que 20260714010000
-- já tenha rodado antes desta.
--
-- NÃO remove nem altera "org_isolation" (staff) em nenhuma tabela.
-- NÃO concede DELETE ao locatário (continua sem policy de DELETE).
-- NÃO amplia o UPDATE do locatário (continua restrito por
-- "portal_locatario_update" + trigger de colunas, nenhuma das duas
-- tocada aqui).
-- Idempotente: todo DROP usa IF EXISTS, toda função usa
-- CREATE OR REPLACE — pode ser reexecutada sem erro.


-- ── 0) Trava de segurança — falha alto em vez de aplicar fora de ordem ──
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_preencher_locador_demanda_portal'
      and tgrelid = 'public.demandas'::regclass
  ) then
    raise exception 'Pré-requisito ausente: aplique 20260714010000_hardening_cobrancas_demandas.sql antes desta migration (trigger trg_preencher_locador_demanda_portal não encontrada em public.demandas).';
  end if;
end $$;


-- ── 1) Garante get_portal_organization_id() sem depender de ordem ──
-- Mesma definição de 20260714000000_portal_locador_rls.sql.
create or replace function public.get_portal_organization_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select organization_id from public.clientes where id = public.get_portal_cliente_id()
$$;

revoke execute on function public.get_portal_organization_id() from anon, public;


-- ── 2) Trigger — sobrescreve TODOS os campos de confiança na criação ──
-- Substitui o corpo de public.preencher_locador_demanda_portal()
-- (criada em 20260714010000) — a trigger já existe e já está ligada
-- a esta função por nome, então não precisa recriar o "create
-- trigger", só o corpo da função.
--
-- REVISADO (2026-07-15, segunda correção): a primeira versão desta
-- correção só sobrescrevia imovel_id/locador_id quando um contrato
-- válido era encontrado — se o client mandasse um contrato_id
-- inválido (de outra organização, ou de outro locatário) MAS também
-- mandasse um imovel_id próprio, esse imovel_id sobrevivia sem
-- nenhuma validação, porque só era substituído quando já vinha nulo.
-- Corrigido para o padrão mais seguro: ou o contrato é validado e
-- TODOS os quatro campos de confiança são sobrescritos a partir dele
-- (nunca aceitos condicionalmente), ou o INSERT inteiro é rejeitado.
--
-- Revisado o fluxo real do app antes desta mudança (ver
-- docs/SECURITY_HARDENING_REVIEW.md para o detalhe): o Portal do
-- locatário sempre tenta enviar um contrato_id real
-- (`contrato?.id || ''`, vindo de uma consulta que já filtra
-- `locatario_id` do próprio usuário e `status in ('ativo','pendente')`)
-- — não existe nenhum fluxo do produto que crie demanda
-- deliberadamente sem contrato. O único jeito de chegar aqui com
-- contrato_id nulo/inválido é um caso de borda do frontend (contrato
-- ainda carregando, ou contrato já não está mais 'ativo'/'pendente'
-- mas o acesso ao portal não foi revogado) — não uma regra de negócio
-- documentada. Por isso, nesta primeira versão, o banco passa a
-- REJEITAR esse caso em vez de aceitar uma demanda "solta".
--
-- Regras, só para usuários do portal (mesmo gate de sempre:
-- get_portal_cliente_id() não nulo — staff nunca é afetado, continua
-- controlando todos os campos manualmente):
--   1) contrato_id nulo -> REJEITA (exceção clara).
--   2) contrato_id que não existe, ou existe mas não pertence ao
--      locatário autenticado, ou pertence a outra organização ->
--      REJEITA (mesma exceção — mensagem não distingue os três casos,
--      para não revelar se o id existe ou não, mesmo padrão já usado
--      em outras validações desta revisão).
--   3) contrato_id válido -> sobrescreve, sem exceção, os quatro
--      campos de confiança: locatario_id, organization_id,
--      locador_id, imovel_id — todos a partir do contrato/cliente
--      reais, nunca do que o client enviou.
create or replace function public.preencher_locador_demanda_portal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locatario_id uuid;
  v_organization_id uuid;
  v_contrato public.contratos%rowtype;
begin
  v_locatario_id := public.get_portal_cliente_id();

  if v_locatario_id is not null then
    select c.organization_id into v_organization_id
    from public.clientes c
    where c.id = v_locatario_id;

    if new.contrato_id is null then
      raise exception 'É necessário informar um contrato válido para abrir uma solicitação.' using errcode = '23514';
    end if;

    select ct.* into v_contrato
    from public.contratos ct
    where ct.id = new.contrato_id
      and ct.locatario_id = v_locatario_id
      and ct.organization_id = v_organization_id;

    if v_contrato.id is null then
      -- Mensagem genérica de propósito: não revela se o contrato não
      -- existe, se é de outro locatário ou de outra organização.
      raise exception 'Contrato inválido ou não vinculado a este usuário.' using errcode = '42501';
    end if;

    -- Sobrescreve incondicionalmente — nunca aceita nenhum destes
    -- quatro campos vindo do navegador, mesmo quando o cliente já
    -- mandou o valor "certo".
    new.locatario_id := v_locatario_id;
    new.organization_id := v_organization_id;
    new.locador_id := v_contrato.locador_id;
    new.imovel_id := v_contrato.imovel_id;
  end if;

  return new;
end;
$$;


-- ── 3) Policy — WITH CHECK exige vínculo consistente entre os 4 campos ──
-- Substitui "portal_locatario_insert" (criada em 20260714010000).
-- Continua exigindo tudo que já exigia (status='aberta',
-- origem='locatario', campos financeiros/decisão nulos) e passa a
-- exigir, também:
--   - organization_id igual à organização real do cliente autenticado;
--   - contrato_id NUNCA nulo (não permite demanda sem contrato nesta
--     primeira versão — ver justificativa na trigger acima);
--   - o contrato referenciado precisa pertencer ao mesmo locatário E
--     à mesma organização E ter o mesmo imovel_id que está sendo
--     gravado na linha — os quatro campos (contrato_id, locatario_id,
--     organization_id, imovel_id) precisam ser consistentes entre si,
--     não só cada um isoladamente "parecer" válido.
--
-- Inclui também locador_id nessa mesma checagem de consistência —
-- não pedido explicitamente, mas é o quinto campo derivado do mesmo
-- contrato pela trigger acima, então deixá-lo de fora seria
-- inconsistente com o resto desta policy; sinalizando aqui para
-- visibilidade, fácil de remover se não for desejado.
--
-- Como a trigger acima já sobrescreve incondicionalmente
-- locatario_id/organization_id/locador_id/imovel_id (ou rejeita o
-- INSERT inteiro) antes desta checagem rodar, todas as condições
-- abaixo já saem sempre verdadeiras na prática — a policy fica como
-- camada redundante, não a única linha de defesa. Mesmo padrão de
-- defesa em profundidade já usado nas policies do locador
-- (20260714000000).
drop policy if exists "portal_locatario_insert" on public.demandas;
create policy "portal_locatario_insert" on public.demandas
  for insert
  with check (
    locatario_id = public.get_portal_cliente_id()
    and organization_id = public.get_portal_organization_id()
    and status = 'aberta'
    and origem = 'locatario'
    and orcamento is null
    and valor_final is null
    and fornecedor_id is null
    and autorizado_por is null
    and responsavel_id is null
    and contrato_id is not null
    and exists (
      select 1 from public.contratos c
      where c.id = demandas.contrato_id
        and c.locatario_id = public.get_portal_cliente_id()
        and c.organization_id = public.get_portal_organization_id()
        and c.imovel_id = demandas.imovel_id
        and c.locador_id = demandas.locador_id
    )
  );


-- ============================================================
-- Fora do escopo desta correção:
--   - "portal_locatario_select" / "portal_locatario_update" não são
--     tocadas — SELECT/UPDATE de uma linha já existente não corre o
--     risco de "criar" dado em outra organização (só leem/editam uma
--     linha que já existe com o organization_id que já tinha desde a
--     criação, agora sempre correto graças à trigger acima).
--   - "org_isolation" (staff) inalterada em todas as tabelas.
--   - DELETE continua não concedido ao locatário — não introduzido
--     nem por este arquivo nem pelo original.
--   - As policies de locador (20260714000000) e a RPC (20260714020000)
--     já validavam organização corretamente desde o início — não
--     precisam de correção.
--   - IMPACTO NO FRONTEND (não corrigido aqui, é fora do escopo de
--     uma migration): a partir de agora, o INSERT de uma demanda sem
--     contrato_id válido é REJEITADO com exceção pelo banco. O Portal
--     do locatário (app/portal/page.tsx) hoje monta o formulário com
--     `contratoId={contrato?.id||''}` sem checar se `contrato` existe
--     antes de exibir o botão "Nova solicitação" — se um locatário
--     abrir esse formulário no momento em que `contrato` ainda está
--     `null` (contrato ainda carregando, ou o contrato já não está
--     mais em status 'ativo'/'pendente' mas o acesso ao portal não foi
--     revogado), o envio agora falha com a exceção desta trigger em
--     vez de criar uma demanda "solta". Recomendo, como follow-up de
--     frontend (não incluído nesta migration): desabilitar/ocultar o
--     botão "Nova solicitação" quando `contrato` for `null`, e tratar
--     o erro da RPC/insert com uma mensagem clara em vez de um erro
--     genérico de banco.
-- ============================================================

-- ============================================================
-- ROLLBACK (2026-07-15) — SOMENTE DOCUMENTADO, NÃO EXECUTAR
-- AUTOMATICAMENTE. Reverte esta correção, voltando ao estado (JÁ
-- CONHECIDO COMO VULNERÁVEL) de 20260714010000 — só usar para isolar
-- um problema em investigação, sabendo que o gap crítico volta a
-- existir enquanto isso.
--
-- -- Restaura a função da trigger para a versão original (sem
-- -- sobrescrever locatario_id/organization_id, sem checar posse do
-- -- contrato):
-- create or replace function public.preencher_locador_demanda_portal()
-- returns trigger
-- language plpgsql
-- security definer
-- set search_path = ''
-- as $$
-- declare
--   v_locador_id uuid;
--   v_imovel_id uuid;
-- begin
--   if public.get_portal_cliente_id() is not null then
--     if new.contrato_id is not null then
--       select c.locador_id, c.imovel_id into v_locador_id, v_imovel_id
--       from public.contratos c
--       where c.id = new.contrato_id;
--       new.locador_id := v_locador_id;
--       if new.imovel_id is null then
--         new.imovel_id := v_imovel_id;
--       end if;
--     else
--       new.locador_id := null;
--       new.imovel_id := null;
--     end if;
--   end if;
--   return new;
-- end;
-- $$;
--
-- -- Restaura a policy original (sem checagem de organization_id):
-- drop policy if exists "portal_locatario_insert" on public.demandas;
-- create policy "portal_locatario_insert" on public.demandas
--   for insert
--   with check (
--     locatario_id = public.get_portal_cliente_id()
--     and status = 'aberta'
--     and origem = 'locatario'
--     and orcamento is null
--     and valor_final is null
--     and fornecedor_id is null
--     and autorizado_por is null
--     and responsavel_id is null
--     and (
--       contrato_id is null
--       or exists (
--         select 1 from public.contratos c
--         where c.id = demandas.contrato_id
--           and c.locatario_id = public.get_portal_cliente_id()
--       )
--     )
--   );
--
-- -- NÃO remove get_portal_organization_id() neste rollback — se
-- -- 20260714000000_portal_locador_rls.sql já tiver sido aplicada, a
-- -- função ainda é necessária pra ela e pra RPC
-- -- (20260714020000_rpc_decisao_demanda.sql); removê-la aqui quebraria
-- -- as duas. Só remova via o rollback do próprio
-- -- 20260714000000_portal_locador_rls.sql, depois de confirmar que
-- -- nada mais depende dela.
-- ============================================================
