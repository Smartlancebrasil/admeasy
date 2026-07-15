-- ============================================================
-- Hardening — cobrancas e demandas (Etapa 1)
-- Admeasy Connect — proposta para revisão, NÃO APLICADA
-- ============================================================
-- ATENÇÃO: proposta para revisão. Não foi rodada contra o banco de
-- produção. Revisar linha a linha, e ver docs/SECURITY_HARDENING_REVIEW.md
-- para o contexto completo (o que quebra, o que precisa mudar no
-- frontend antes de aplicar, plano de testes e rollback).
--
-- Pré-requisito: supabase/migrations/20260712000000_habilitar_rls.sql
-- já aplicado (é onde get_portal_cliente_id() e as políticas
-- portal_locatario_* / portal_locatario originais foram criadas).
--
-- Esta migration:
--   - REMOVE uma política (cobrancas.portal_locatario_update) — é a
--     única remoção deste arquivo, e é isso que resolve o Risco R0.
--   - REMOVE e RECRIA uma política (demandas.portal_locatario, que
--     era FOR ALL) — vira três políticas mais estreitas.
--   - CRIA duas funções + duas triggers em demandas: uma que impede o
--     portal de alterar qualquer coluna fora de título/descrição/
--     urgência/fotos (allowlist, revisada na auditoria final — ver
--     comentário na própria trigger), e outra que sempre recalcula
--     locador_id a partir do contrato real na criação, ignorando
--     qualquer valor enviado pelo cliente nesse campo.
--   - NÃO mexe em nenhuma política de staff (org_isolation).
--   - NÃO mexe nas políticas de locador (essas estão no arquivo
--     20260714000000_portal_locador_rls.sql).
--   - NÃO usa service role, é só definição de policy/trigger/função.


-- ── 1) COBRANÇAS — remove o UPDATE direto do locatário ─────────────
-- Motivo (Risco R0, ver docs/SECURITY_HARDENING_REVIEW.md): a policy
-- atual não restringe COLUNA, só a linha — permite, em tese, o
-- locatário marcar a própria cobrança como paga ou mudar valores via
-- PATCH direto na API, contornando o webhook do Mercado Pago.
--
-- Confirmado no código (app/portal/page.tsx, função gerarBoleto) que
-- o ÚNICO update de cobranças feito pelo portal hoje é redundante: a
-- rota /api/boleto já persiste os mesmos campos (mp_payment_id,
-- boleto_url etc.) usando a service role, ANTES de responder ao
-- cliente. Ou seja, remover esta policy não depende de nenhuma
-- mudança de banco — só de remover essa linha redundante no
-- frontend (detalhada no documento de revisão, não alterada aqui).
--
-- Leitura (portal_locatario_select) continua exatamente como está.

drop policy if exists "portal_locatario_update" on public.cobrancas;


-- ── 2) DEMANDAS — troca FOR ALL por três políticas estreitas ───────

drop policy if exists "portal_locatario" on public.demandas;

-- 2a) Leitura: igual à política antiga, sem mudança de comportamento.
create policy "portal_locatario_select" on public.demandas
  for select
  using (locatario_id = public.get_portal_cliente_id());

-- 2b) Criação: só pode abrir uma demanda nova vinculada a si mesmo, a
-- um contrato onde ele é o locatário, sempre como "aberta" e origem
-- "locatario", e sempre SEM preencher os campos financeiros/decisão
-- (orcamento, valor_final, fornecedor_id, autorizado_por,
-- responsavel_id) — quem preenche isso depois é o staff/locador,
-- nunca o cliente na criação.
create policy "portal_locatario_insert" on public.demandas
  for insert
  with check (
    locatario_id = public.get_portal_cliente_id()
    and status = 'aberta'
    and origem = 'locatario'
    and orcamento is null
    and valor_final is null
    and fornecedor_id is null
    and autorizado_por is null
    and responsavel_id is null
    and (
      contrato_id is null
      or exists (
        select 1 from public.contratos c
        where c.id = demandas.contrato_id
          and c.locatario_id = public.get_portal_cliente_id()
      )
    )
  );

-- 2c) Edição: só enquanto a demanda ainda está "aberta" (mesma regra
-- que a tela já respeita hoje, agora garantida pelo banco). A trigger
-- abaixo garante que, mesmo dentro desse UPDATE, o locatário não
-- consiga alterar status/orçamento/valor/fornecedor/decisão — só
-- título, descrição, urgência e fotos.
create policy "portal_locatario_update" on public.demandas
  for update
  using (locatario_id = public.get_portal_cliente_id() and status = 'aberta')
  with check (locatario_id = public.get_portal_cliente_id());

-- 2d) Trigger de proteção de colunas — necessária porque staff e
-- portal autenticam pela MESMA role do Postgres ("authenticated"), o
-- que impede usar GRANT/REVOKE de coluna pra diferenciar os dois (um
-- REVOKE afetaria o staff também). A trigger só age quando quem está
-- editando é comprovadamente um usuário do portal
-- (get_portal_cliente_id() não nulo) — staff nunca é afetado.
--
-- CORRIGIDO na auditoria final de 2026-07-14: a primeira versão desta
-- trigger usava uma lista de colunas PROIBIDAS (denylist) — e faltavam
-- várias colunas reais da tabela nessa lista (numero, tipo,
-- local_imovel, origem, data_abertura, data_conclusao, prazo_estimado,
-- observacoes), o que deixaria essas colunas alteráveis pelo portal
-- sem querer. Trocado para o padrão oposto, mais seguro: lista de
-- colunas PERMITIDAS (allowlist) — título, descrição, urgência e
-- fotos — e bloqueia qualquer outra diferença entre a linha antiga e
-- a nova, comparando as duas como jsonb. Isso também protege
-- automaticamente qualquer coluna nova que a tabela ganhar no futuro
-- (por padrão, fica bloqueada pro portal até alguém decidir liberar).
create or replace function public.proteger_colunas_demanda_portal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  colunas_permitidas text[] := array['titulo', 'descricao', 'urgencia', 'fotos', 'updated_at'];
  old_restrito jsonb;
  new_restrito jsonb;
begin
  if public.get_portal_cliente_id() is not null then
    old_restrito := to_jsonb(old) - colunas_permitidas;
    new_restrito := to_jsonb(new) - colunas_permitidas;
    if old_restrito is distinct from new_restrito then
      raise exception 'Usuários do portal só podem alterar título, descrição, urgência e fotos.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_colunas_demanda_portal on public.demandas;
create trigger trg_proteger_colunas_demanda_portal
  before update on public.demandas
  for each row execute function public.proteger_colunas_demanda_portal();


-- ── 3) DEMANDAS — preenchimento seguro de locador_id na criação ────
-- Item da auditoria: a política de INSERT (2b) não validava
-- locador_id nenhum — um client malicioso poderia enviar QUALQUER
-- cliente_id nesse campo, se passando por vínculo com um locador que
-- não é o real dono do imóvel/contrato. Em vez de tentar validar isso
-- só com WITH CHECK (frágil — teria que reconferir toda vez que a
-- regra de negócio mudar), a correção é uma trigger BEFORE INSERT que
-- SEMPRE recalcula locador_id (e imovel_id, se não vier) a partir do
-- contrato real, e ignora completamente qualquer valor enviado pelo
-- cliente nesses campos. BEFORE INSERT roda antes da checagem de
-- RLS/WITH CHECK, então o valor final já sai correto antes de a
-- política avaliar a linha.
--
-- Só age para usuários do portal (mesmo gate das outras trigger) —
-- o formulário interno de staff continua controlando locador_id e
-- imovel_id manualmente, inclusive em casos sem contrato_id definido.
create or replace function public.preencher_locador_demanda_portal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locador_id uuid;
  v_imovel_id uuid;
begin
  if public.get_portal_cliente_id() is not null then
    if new.contrato_id is not null then
      select c.locador_id, c.imovel_id into v_locador_id, v_imovel_id
      from public.contratos c
      where c.id = new.contrato_id;
      new.locador_id := v_locador_id;
      if new.imovel_id is null then
        new.imovel_id := v_imovel_id;
      end if;
    else
      new.locador_id := null;
      new.imovel_id := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_preencher_locador_demanda_portal on public.demandas;
create trigger trg_preencher_locador_demanda_portal
  before insert on public.demandas
  for each row execute function public.preencher_locador_demanda_portal();


-- ============================================================
-- Fora do escopo desta migration (ver docs/SECURITY_HARDENING_REVIEW.md):
--   - Nenhuma política de UPDATE/INSERT pro locador é criada aqui —
--     Etapa 2 desta revisão é só SELECT (ver migration separada
--     20260714000000_portal_locador_rls.sql).
--   - Aprovar/recusar orçamento pelo locador é uma função RPC
--     dedicada, desenhada (não aplicada) em
--     supabase/migrations/20260714020000_rpc_decisao_demanda.sql.
--   - Correção do código do portal (remover a linha redundante de
--     update em cobrancas) — mudança de frontend, não de banco,
--     detalhada no documento de revisão, não aplicada aqui.
--
-- Depende de confirmação ao vivo antes de aplicar:
--   - Confirmar se existe hoje algum outro trigger em "demandas" que
--     preenche a coluna "numero" (protocolo) — o código da aplicação
--     não envia esse campo, um comentário no código do portal
--     ("o gatilho no banco preenche sozinho") indica que existe, mas
--     não encontrei a definição desse trigger em nenhum arquivo
--     versionado. Se existir, confirmar que ele SOBRESCREVE (não só
--     preenche-se-nulo) qualquer valor de "numero" que porventura
--     venha no INSERT, senão um client malicioso poderia declarar um
--     número de protocolo à mão.
-- ============================================================
