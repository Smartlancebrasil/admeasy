-- ============================================================
-- AdmEasy — Schema completo do banco de dados
-- Supabase / PostgreSQL
-- Admin: atendimento@echelli.com.br
-- ============================================================

-- Habilitar extensões necessárias
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";

-- ============================================================
-- TABELA: organizacoes (multi-tenant / white label)
-- Cada imobiliária é uma organização separada
-- ============================================================
create table organizacoes (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  cnpj text unique,
  creci text,
  email text not null,
  telefone text,
  endereco text,
  logo_url text,
  cor_primaria text default '#185FA5',
  dominio text unique,
  taxa_adm_padrao numeric(5,2) default 10.00,
  plano text default 'basico' check (plano in ('basico','intermediario','avancado')),
  ativo boolean default true,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- ============================================================
-- TABELA: usuarios
-- Imobiliária (admin/corretor), locatário, locador
-- ============================================================
create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  organizacao_id uuid references organizacoes(id) on delete cascade,
  nome text not null,
  email text not null unique,
  telefone text,
  cpf text,
  rg text,
  estado_civil text,
  profissao text,
  endereco text,
  tipo text not null check (tipo in ('admin','corretor','locatario','locador')),
  ativo boolean default true,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- ============================================================
-- TABELA: imoveis
-- ============================================================
create table imoveis (
  id uuid primary key default uuid_generate_v4(),
  organizacao_id uuid references organizacoes(id) on delete cascade,
  locador_id uuid references usuarios(id),
  titulo text not null,
  tipo text not null check (tipo in ('apartamento','casa','studio','sobrado','terreno','comercial','sala')),
  finalidade text not null check (finalidade in ('aluguel','venda','ambos')),
  valor numeric(12,2) not null,
  valor_condominio numeric(12,2) default 0,
  valor_iptu numeric(12,2) default 0,
  area_m2 numeric(8,2),
  dormitorios int default 0,
  banheiros int default 0,
  vagas int default 0,
  endereco text not null,
  bairro text,
  cidade text,
  estado text default 'SP',
  cep text,
  descricao text,
  fotos text[] default '{}',
  publicado_portal boolean default false,
  status text default 'disponivel' check (status in ('disponivel','alugado','vendido','em_analise','inativo')),
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- ============================================================
-- TABELA: contratos
-- ============================================================
create table contratos (
  id uuid primary key default uuid_generate_v4(),
  organizacao_id uuid references organizacoes(id) on delete cascade,
  imovel_id uuid references imoveis(id),
  locador_id uuid references usuarios(id),
  locatario_id uuid references usuarios(id),
  corretor_id uuid references usuarios(id),
  numero text unique not null,
  tipo text default 'locacao_residencial' check (tipo in ('locacao_residencial','locacao_comercial','compra_venda','renovacao')),
  data_inicio date not null,
  data_fim date not null,
  valor_mensal numeric(12,2) not null,
  dia_vencimento int default 5 check (dia_vencimento between 1 and 31),
  indice_reajuste text default 'IGP-M' check (indice_reajuste in ('IGP-M','IPCA','INPC','IVAR')),
  mes_reajuste int check (mes_reajuste between 1 and 12),
  data_ultimo_reajuste date,
  valor_pos_reajuste numeric(12,2),
  garantia text check (garantia in ('caucao','seguro_fianca','fiador','titulo_capitalizacao')),
  valor_caucao numeric(12,2),
  multa_rescisoria numeric(5,2) default 3,
  taxa_adm_modelo text default 'fixa' check (taxa_adm_modelo in ('fixa','servico')),
  taxa_adm_percentual numeric(5,2) default 10.00,
  template_id uuid,
  clicksign_doc_key text,
  status text default 'rascunho' check (status in ('rascunho','aguardando_assinatura','ativo','vencendo','vencido','rescindido','renovado')),
  observacoes text,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- ============================================================
-- TABELA: reajustes
-- Histórico de reajustes aplicados
-- ============================================================
create table reajustes (
  id uuid primary key default uuid_generate_v4(),
  contrato_id uuid references contratos(id) on delete cascade,
  organizacao_id uuid references organizacoes(id),
  indice text not null,
  percentual numeric(8,4) not null,
  valor_anterior numeric(12,2) not null,
  valor_novo numeric(12,2) not null,
  data_aplicacao date not null,
  competencia text not null,
  notificado_locatario boolean default false,
  notificado_locador boolean default false,
  clicksign_aditivo_key text,
  criado_em timestamptz default now()
);

-- ============================================================
-- TABELA: rescisoes
-- ============================================================
create table rescisoes (
  id uuid primary key default uuid_generate_v4(),
  contrato_id uuid references contratos(id) on delete cascade,
  organizacao_id uuid references organizacoes(id),
  quem_rescinde text not null check (quem_rescinde in ('locatario','locador','mutuo_acordo')),
  data_solicitacao date not null,
  data_efetiva date not null,
  meses_restantes int,
  multa_valor numeric(12,2),
  aviso_previo_dias int default 30,
  caucao_devolver numeric(12,2),
  total_a_pagar numeric(12,2),
  motivo text,
  status text default 'calculado' check (status in ('calculado','notificado','concluido')),
  criado_em timestamptz default now()
);

-- ============================================================
-- TABELA: vistorias
-- Laudo de entrada e saída
-- ============================================================
create table vistorias (
  id uuid primary key default uuid_generate_v4(),
  contrato_id uuid references contratos(id) on delete cascade,
  organizacao_id uuid references organizacoes(id),
  tipo text not null check (tipo in ('entrada','saida','periodica')),
  data_vistoria date not null,
  itens jsonb default '[]',
  observacoes text,
  fotos text[] default '{}',
  pdf_url text,
  criado_em timestamptz default now()
);

-- ============================================================
-- TABELA: seguros
-- Seguro fiança e incêndio
-- ============================================================
create table seguros (
  id uuid primary key default uuid_generate_v4(),
  organizacao_id uuid references organizacoes(id) on delete cascade,
  contrato_id uuid references contratos(id),
  imovel_id uuid references imoveis(id),
  locatario_id uuid references usuarios(id),
  tipo text not null check (tipo in ('fianca','incendio','conteudo')),
  seguradora text not null,
  numero_apolice text not null,
  premio_mensal numeric(10,2),
  cobertura_total numeric(14,2),
  vigencia_inicio date not null,
  vigencia_fim date not null,
  responsavel_pagamento text check (responsavel_pagamento in ('locatario','locador','imobiliaria')),
  dias_aviso_renovacao int default 30,
  status text default 'ativo' check (status in ('ativo','vencendo','vencido','cancelado','renovado')),
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- ============================================================
-- TABELA: fornecedores
-- ============================================================
create table fornecedores (
  id uuid primary key default uuid_generate_v4(),
  organizacao_id uuid references organizacoes(id) on delete cascade,
  nome text not null,
  especialidade text not null,
  telefone text,
  email text,
  cpf_cnpj text,
  registro_profissional text,
  area_atendimento text,
  avaliacao_media numeric(3,2) default 0,
  total_servicos int default 0,
  ativo boolean default true,
  criado_em timestamptz default now()
);

-- ============================================================
-- TABELA: demandas
-- Demandas de reparo abertas pelo locatário
-- ============================================================
create table demandas (
  id uuid primary key default uuid_generate_v4(),
  organizacao_id uuid references organizacoes(id) on delete cascade,
  contrato_id uuid references contratos(id),
  imovel_id uuid references imoveis(id),
  locatario_id uuid references usuarios(id),
  fornecedor_id uuid references fornecedores(id),
  numero text unique not null,
  tipo text not null,
  local_problema text,
  urgencia text default 'media' check (urgencia in ('alta','media','baixa')),
  descricao text not null,
  fotos text[] default '{}',
  orcamento numeric(10,2),
  requer_autorizacao_locador boolean default true,
  locador_autorizou boolean,
  locador_autorizou_em timestamptz,
  status text default 'aberta' check (status in ('aberta','recebida','aguardando_autorizacao','em_execucao','concluida','cancelada')),
  data_conclusao date,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- ============================================================
-- TABELA: notificacoes_log
-- Histórico de todas as notificações enviadas
-- ============================================================
create table notificacoes_log (
  id uuid primary key default uuid_generate_v4(),
  organizacao_id uuid references organizacoes(id) on delete cascade,
  tipo text not null,
  canal text not null check (canal in ('whatsapp','email','push')),
  destinatario_id uuid references usuarios(id),
  destinatario_nome text,
  destinatario_contato text,
  referencia_tipo text,
  referencia_id uuid,
  mensagem text,
  status text default 'enviado' check (status in ('enviado','entregue','lido','falhou')),
  enviado_em timestamptz default now()
);

-- ============================================================
-- TABELA: notificacoes_config
-- Régua de notificações por organização
-- ============================================================
create table notificacoes_config (
  id uuid primary key default uuid_generate_v4(),
  organizacao_id uuid references organizacoes(id) on delete cascade,
  evento text not null,
  antecedencia_dias int default 0,
  canal_whatsapp boolean default true,
  canal_email boolean default true,
  destinatarios text[] default '{}',
  template_whatsapp text,
  template_email_assunto text,
  template_email_corpo text,
  ativo boolean default true,
  criado_em timestamptz default now()
);

-- ============================================================
-- TABELA: financeiro
-- Lançamentos financeiros
-- ============================================================
create table financeiro (
  id uuid primary key default uuid_generate_v4(),
  organizacao_id uuid references organizacoes(id) on delete cascade,
  contrato_id uuid references contratos(id),
  tipo text not null check (tipo in ('aluguel','taxa_adm','comissao','reparo','seguro','caucao','outros')),
  descricao text not null,
  valor numeric(12,2) not null,
  natureza text not null check (natureza in ('receita','despesa')),
  data_lancamento date not null,
  data_vencimento date,
  pago boolean default false,
  data_pagamento date,
  referencia_mes text,
  criado_em timestamptz default now()
);

-- ============================================================
-- TABELA: templates_contrato
-- Templates de contrato aprovados
-- ============================================================
create table templates_contrato (
  id uuid primary key default uuid_generate_v4(),
  organizacao_id uuid references organizacoes(id),
  nome text not null,
  tipo text not null,
  conteudo text not null,
  variaveis text[] default '{}',
  aprovado boolean default false,
  criado_em timestamptz default now()
);

-- ============================================================
-- TABELA: visitas_agendadas
-- ============================================================
create table visitas_agendadas (
  id uuid primary key default uuid_generate_v4(),
  organizacao_id uuid references organizacoes(id) on delete cascade,
  imovel_id uuid references imoveis(id),
  cliente_id uuid references usuarios(id),
  corretor_id uuid references usuarios(id),
  data_visita timestamptz not null,
  status text default 'agendada' check (status in ('agendada','confirmada','realizada','cancelada')),
  observacoes text,
  criado_em timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Cada organização só vê seus próprios dados
-- ============================================================
alter table organizacoes enable row level security;
alter table usuarios enable row level security;
alter table imoveis enable row level security;
alter table contratos enable row level security;
alter table reajustes enable row level security;
alter table rescisoes enable row level security;
alter table vistorias enable row level security;
alter table seguros enable row level security;
alter table fornecedores enable row level security;
alter table demandas enable row level security;
alter table notificacoes_log enable row level security;
alter table notificacoes_config enable row level security;
alter table financeiro enable row level security;
alter table templates_contrato enable row level security;
alter table visitas_agendadas enable row level security;

-- Função auxiliar: retorna organizacao_id do usuário logado
create or replace function get_org_id()
returns uuid language sql stable as $$
  select organizacao_id from usuarios where id = auth.uid()
$$;

-- Políticas RLS — padrão: usuário só vê dados da sua organização
create policy "org_isolation" on imoveis
  using (organizacao_id = get_org_id());

create policy "org_isolation" on contratos
  using (organizacao_id = get_org_id());

create policy "org_isolation" on reajustes
  using (organizacao_id = get_org_id());

create policy "org_isolation" on rescisoes
  using (organizacao_id = get_org_id());

create policy "org_isolation" on vistorias
  using (organizacao_id = get_org_id());

create policy "org_isolation" on seguros
  using (organizacao_id = get_org_id());

create policy "org_isolation" on fornecedores
  using (organizacao_id = get_org_id());

create policy "org_isolation" on demandas
  using (organizacao_id = get_org_id());

create policy "org_isolation" on notificacoes_log
  using (organizacao_id = get_org_id());

create policy "org_isolation" on notificacoes_config
  using (organizacao_id = get_org_id());

create policy "org_isolation" on financeiro
  using (organizacao_id = get_org_id());

create policy "org_isolation" on templates_contrato
  using (organizacao_id = get_org_id() or organizacao_id is null);

create policy "org_isolation" on visitas_agendadas
  using (organizacao_id = get_org_id());

create policy "usuarios_proprios" on usuarios
  using (organizacao_id = get_org_id() or id = auth.uid());

-- ============================================================
-- DADOS INICIAIS — Templates de notificação padrão
-- (inserir após criar a primeira organização)
-- ============================================================

-- Inserir configurações padrão de notificação (exemplo)
-- INSERT INTO notificacoes_config (organizacao_id, evento, antecedencia_dias, canal_whatsapp, canal_email, destinatarios, template_whatsapp)
-- VALUES
--   (ORG_ID, 'vencimento_contrato', 30, true, true, ARRAY['locatario','locador'], 'Olá {{nome}}! Seu contrato vence em 30 dias ({{data}}).'),
--   (ORG_ID, 'vencimento_contrato', 5,  true, true, ARRAY['locatario','locador','corretor'], 'URGENTE: Seu contrato {{numero}} vence em 5 dias!'),
--   (ORG_ID, 'assinatura_pendente', 2,  false, true, ARRAY['signatario'], 'Documento aguardando sua assinatura digital — Clicksign.'),
--   (ORG_ID, 'seguro_vencendo',     30, true, true, ARRAY['locatario','imobiliaria'], 'Seu seguro vence em 30 dias. Providencie a renovação.'),
--   (ORG_ID, 'reajuste_aplicado',   0,  true, true, ARRAY['locatario','locador'], 'Reajuste {{indice}} aplicado. Novo valor: R$ {{valor_novo}}.');

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
create index idx_imoveis_org on imoveis(organizacao_id);
create index idx_imoveis_status on imoveis(status);
create index idx_contratos_org on contratos(organizacao_id);
create index idx_contratos_status on contratos(status);
create index idx_contratos_data_fim on contratos(data_fim);
create index idx_contratos_locatario on contratos(locatario_id);
create index idx_contratos_locador on contratos(locador_id);
create index idx_seguros_vigencia on seguros(vigencia_fim);
create index idx_seguros_status on seguros(status);
create index idx_demandas_status on demandas(status);
create index idx_financeiro_data on financeiro(data_lancamento);
create index idx_notif_log_org on notificacoes_log(organizacao_id);
create index idx_usuarios_tipo on usuarios(tipo);
create index idx_usuarios_org on usuarios(organizacao_id);
