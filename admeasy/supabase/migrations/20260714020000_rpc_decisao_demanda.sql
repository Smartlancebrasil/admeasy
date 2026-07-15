-- ============================================================
-- RPC — decisão do locador sobre demanda (aprovar/recusar)
-- Admeasy Connect — proposta para revisão, NÃO APLICADA
-- ============================================================
-- ATENÇÃO: proposta para revisão. Não foi rodada contra o banco de
-- produção. Ver docs/SECURITY_HARDENING_REVIEW.md.
--
-- Pré-requisito: as duas migrations anteriores já aplicadas
-- (20260714010000_hardening_cobrancas_demandas.sql e
-- 20260714000000_portal_locador_rls.sql) — esta função assume que o
-- locador só tem SELECT em "demandas" via RLS, e é exatamente por
-- isso que a decisão (que é um UPDATE) precisa passar por uma função
-- security definer em vez de uma policy de UPDATE direta.
--
-- Esta migration NÃO concede UPDATE direto em "demandas" pro locador
-- — só cria a função. A permissão de executar a função é dada
-- explicitamente à role "authenticated"; a validação de quem pode
-- fazer o quê acontece DENTRO da função, não por RLS de tabela.


-- ── Aprovar ou recusar o orçamento de uma demanda ───────────────────
create or replace function public.portal_locador_decidir_demanda(
  p_demanda_id uuid,
  p_decisao text,          -- 'autorizada' ou 'recusada'
  p_justificativa text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locador_id uuid;
  v_demanda public.demandas%rowtype;
begin
  -- 1) precisa ser um usuário do portal autenticado e vinculado a um cliente
  v_locador_id := public.get_portal_cliente_id();
  if v_locador_id is null then
    raise exception 'Usuário não autenticado no portal.' using errcode = '28000';
  end if;

  -- 2) decisão só pode ser um dos dois valores válidos
  if p_decisao not in ('autorizada', 'recusada') then
    raise exception 'Decisão inválida. Use "autorizada" ou "recusada".' using errcode = '22023';
  end if;

  -- 3) recusa exige justificativa não vazia
  if p_decisao = 'recusada' and (p_justificativa is null or btrim(p_justificativa) = '') then
    raise exception 'Justificativa é obrigatória para recusar.' using errcode = '22004';
  end if;

  -- 4) busca a demanda garantindo, na MESMA query, que o vínculo de
  -- locador e a organização batem com o usuário autenticado — se a
  -- linha não existir ou não pertencer a ele, "select into" não acha
  -- nada e v_demanda.id fica null (não estoura erro de "no rows", só
  -- segue pro próximo if).
  select d.* into v_demanda
  from public.demandas d
  where d.id = p_demanda_id
    and d.locador_id = v_locador_id
    and d.organization_id = public.get_portal_organization_id();

  if v_demanda.id is null then
    -- mensagem genérica de propósito: não revela se o problema é
    -- "não existe" ou "não é sua" — mesmo padrão já usado em
    -- app/api/portal/gerenciar-acesso/route.ts.
    raise exception 'Demanda não encontrada ou sem permissão.' using errcode = '42501';
  end if;

  -- 5) só pode decidir quando o estado atual é o esperado — impede
  -- decidir duas vezes, ou decidir uma demanda que ainda não chegou
  -- nessa etapa do fluxo.
  if v_demanda.status is distinct from 'aguardando_locador' then
    raise exception 'Esta demanda não está aguardando decisão do locador (status atual: %).', v_demanda.status
      using errcode = '22023';
  end if;

  -- 6) aplica a decisão — só os campos de decisão, nada financeiro
  -- nem de execução (fornecedor_id, valor_final, responsavel_id
  -- continuam de fora, controlados só pelo staff).
  update public.demandas
  set
    status = p_decisao,
    autorizado_por = v_locador_id,
    data_autorizacao = now(),
    motivo_recusa = case when p_decisao = 'recusada' then p_justificativa else null end,
    updated_at = now()
  where id = p_demanda_id;

  return jsonb_build_object(
    'demanda_id', p_demanda_id,
    'status', p_decisao,
    'decidido_em', now()
  );
end;
$$;

-- Só usuários autenticados podem chamar — a validação de QUEM pode
-- decidir O QUÊ acontece dentro da função, não aqui.
revoke all on function public.portal_locador_decidir_demanda(uuid, text, text) from public, anon;
grant execute on function public.portal_locador_decidir_demanda(uuid, text, text) to authenticated;


-- ============================================================
-- "Solicitar esclarecimento" — NÃO incluído nesta migration.
--
-- Não existe hoje nenhuma coluna em "demandas" pra guardar uma
-- pergunta do locador sem finalizar a decisão (diferente de
-- "recusada", que já é uma decisão final com justificativa). Duas
-- opções, nenhuma implementada:
--
--   a) Adicionar uma coluna nova (ex.: "solicitacao_esclarecimento
--      text", "esclarecimento_pendente boolean"), mantendo o status
--      em "aguardando_locador" — mais simples, mas não guarda
--      histórico de idas e vindas.
--   b) Criar a tabela "demandas_comentarios" (já cogitada na análise
--      anterior, docs/MOBILE_APP_RLS_REVIEW.md seção 7) — mais
--      robusta, permite qualquer número de trocas entre imobiliária e
--      locador, mas é uma tabela nova, com sua própria RLS.
--
-- Recomendo (b), mas isso é decisão de produto — sinalizando aqui,
-- não implementei nenhuma das duas.
-- ============================================================


-- ============================================================
-- Chamada esperada do frontend (não aplicado, só documentado):
--
--   const { data, error } = await supabase.rpc('portal_locador_decidir_demanda', {
--     p_demanda_id: demanda.id,
--     p_decisao: 'autorizada', // ou 'recusada'
--     p_justificativa: motivo || null,
--   })
--
-- Substitui os updates diretos hoje em app/portal/page.tsx
-- (funções aprovarDemanda/recusarDemanda, Fase 7) — ver
-- docs/SECURITY_HARDENING_REVIEW.md, Seção 4, item 3.
-- ============================================================
