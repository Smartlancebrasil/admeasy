-- ============================================================
-- Habilitar Row Level Security (RLS) em todas as tabelas publicas
-- Fase 5 - Auditoria e correcao de RLS - Admeasy
-- ============================================================
-- ATENCAO: este script ainda NAO foi aplicado ao banco de producao.
-- Revisar linha a linha antes de rodar. Nenhuma tabela e dropada,
-- nenhum dado e alterado -- so trava/libera acesso por linha.
--
-- Contexto de cada "identidade" usada nas policies:
--   - Staff interno (admin/agencia): auth.uid() aparece em
--     usuarios_organizacao.user_id -> get_org_id() resolve a org.
--   - Portal do locatario/locador: auth.uid() aparece em
--     clientes.usuario_portal_id -> get_portal_cliente_id() resolve
--     o cliente_id do usuario logado no portal.
--   - Admin master da AdmEasy (painel /admin): auth.uid() aparece em
--     admeasy_admins.user_id -> is_admeasy_admin() retorna true/false.


-- ── Funcoes auxiliares novas ────────────────────────────────────

create or replace function public.get_portal_cliente_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select id from public.clientes where usuario_portal_id = auth.uid() limit 1
$$;

create or replace function public.is_admeasy_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.admeasy_admins where user_id = auth.uid())
$$;


-- ── Grupo A: ja tem policy org_isolation, so falta ligar RLS ───

alter table public.atividades enable row level security;
alter table public.comprovantes enable row level security;
alter table public.consultas_credito enable row level security;
alter table public.documentos enable row level security;
alter table public.fornecedores enable row level security;
alter table public.imoveis enable row level security;
alter table public.lancamentos enable row level security;
alter table public.laudos_vistoria enable row level security;
alter table public.reajustes enable row level security;
alter table public.visitas enable row level security;

-- imoveis tambem precisa do bypass do admin master: o painel /admin
-- le a contagem de imoveis de TODAS as organizacoes.
create policy admeasy_admin_full_access on public.imoveis
  for select using (public.is_admeasy_admin());


-- ── Grupo B: criar policy org_isolation do zero + ligar RLS ────

alter table public.analises_cadastrais enable row level security;
create policy org_isolation on public.analises_cadastrais
  for all using (organization_id = public.get_org_id());

alter table public.despesas enable row level security;
create policy org_isolation on public.despesas
  for all using (organization_id = public.get_org_id());

alter table public.logs enable row level security;
create policy org_isolation on public.logs
  for all using (organization_id = public.get_org_id());

alter table public.processos_judiciais enable row level security;
create policy org_isolation on public.processos_judiciais
  for all using (organization_id = public.get_org_id());

alter table public.vistoriadores enable row level security;
create policy org_isolation on public.vistoriadores
  for all using (organization_id = public.get_org_id());

alter table public.vistorias enable row level security;
create policy org_isolation on public.vistorias
  for all using (organization_id = public.get_org_id());

alter table public.users enable row level security;
create policy org_isolation on public.users
  for all using (organization_id = public.get_org_id());

alter table public.convites enable row level security;
create policy org_isolation on public.convites
  for all using (organization_id = public.get_org_id());


-- ── Grupo C: staff (org_isolation) + portal (dono do registro) ─

-- contratos e demandas ja tem org_isolation -- falta ligar RLS e
-- acrescentar o acesso do proprio locatario.
alter table public.contratos enable row level security;
create policy portal_locatario on public.contratos
  for select using (locatario_id = public.get_portal_cliente_id());

alter table public.demandas enable row level security;
create policy portal_locatario on public.demandas
  for all using (locatario_id = public.get_portal_cliente_id());

-- clientes ja tem org_isolation -- falta ligar RLS e o proprio
-- locatario/locador poder ler o proprio registro.
alter table public.clientes enable row level security;
create policy portal_proprio_registro on public.clientes
  for select using (usuario_portal_id = auth.uid());

-- cobrancas nao tinha nenhuma policy -- cria as duas do zero.
alter table public.cobrancas enable row level security;
create policy org_isolation on public.cobrancas
  for all using (organization_id = public.get_org_id());
create policy portal_locatario_select on public.cobrancas
  for select using (locatario_id = public.get_portal_cliente_id());
create policy portal_locatario_update on public.cobrancas
  for update using (locatario_id = public.get_portal_cliente_id())
  with check (locatario_id = public.get_portal_cliente_id());


-- ── Grupo D: organizations (chave propria e "id", nao organization_id) ─

alter table public.organizations enable row level security;

create policy org_isolation on public.organizations
  for all using (id = public.get_org_id());

create policy portal_leitura on public.organizations
  for select using (
    id = (select organization_id from public.clientes where usuario_portal_id = auth.uid() limit 1)
  );

create policy admeasy_admin_full_access on public.organizations
  for select using (public.is_admeasy_admin());


-- ── Grupo E: demandas_historico (via tabela-pai demandas) ───────

alter table public.demandas_historico enable row level security;
create policy org_isolation on public.demandas_historico
  for all using (
    exists (
      select 1 from public.demandas d
      where d.id = demandas_historico.demanda_id
        and d.organization_id = public.get_org_id()
    )
  );


-- ── Grupo F: planos -- leitura publica (vitrine de precos do /cadastro) ─

alter table public.planos enable row level security;
create policy leitura_publica on public.planos
  for select using (true);


-- ── Grupo G: autoacesso ──────────────────────────────────────────

alter table public.usuarios_organizacao enable row level security;
create policy proprio_vinculo on public.usuarios_organizacao
  for select using (user_id = auth.uid());

alter table public.admeasy_admins enable row level security;
create policy proprio_vinculo on public.admeasy_admins
  for select using (user_id = auth.uid());


-- ── Grupo H: bloqueadas -- sem nenhum uso no codigo hoje ─────────
-- RLS ligado, zero policy = acesso fechado (so service role acessa).
-- Se um dia forem usadas, criar a policy adequada nessa altura.

alter table public.portal_usuarios enable row level security;
alter table public.documentos_locacao enable row level security;
alter table public.repasses enable row level security;


-- ── Storage: bucket "documentos" -- fecha acesso anonimo ─────────
-- A policy antiga liberava leitura/escrita/listagem pra qualquer um,
-- incluindo visitante sem login. Substitui por uma que exige estar
-- autenticado (login no Supabase Auth), mantendo upload e geracao de
-- URL assinada funcionando normalmente pra quem ja loga hoje.

drop policy if exists allow_all_documentos on storage.objects;

create policy documentos_authenticated_all on storage.objects
  for all to authenticated
  using (bucket_id = 'documentos')
  with check (bucket_id = 'documentos');


-- ── Fechar funcoes SECURITY DEFINER pra usuario anonimo ──────────
-- Por padrao o Postgres libera EXECUTE em funcao nova pra role
-- "public" (inclui anon). Essas duas funcoes so fazem sentido pra
-- quem ja esta logado.

revoke execute on function public.get_portal_cliente_id() from anon, public;
revoke execute on function public.is_admeasy_admin() from anon, public;
