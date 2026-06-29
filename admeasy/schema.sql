-- =====================================================
-- ADMEASY — Schema completo do banco de dados
-- Supabase / PostgreSQL
-- =====================================================

-- =====================================================
-- EXTENSÕES
-- =====================================================
create extension if not exists "uuid-ossp";

-- =====================================================
-- 1. ORGANIZATIONS (multi-tenant white label)
-- Cada imobiliária é uma organização
-- =====================================================
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  cnpj text unique,
  creci text,
  email text,
  telefone text,
  whatsapp text,
  logo_url text,
  cor_primaria text default '#185FA5',
  dominio text unique,
  plano text default 'basico' check (plano in ('basico','intermediario','avancado')),
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================
-- 2. USERS (equipe da imobiliária)
-- =====================================================
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  nome text not null,
  email text not null,
  telefone text,
  perfil text default 'corretor' check (perfil in ('admin','corretor','assistente')),
  ativo boolean default true,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================
-- 3. CLIENTES
-- Locatários, locadores, compradores, leads
-- =====================================================
create table clientes (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,

  -- Tipo
  tipo text not null check (tipo in ('locatario','locador','comprador','vendedor','lead')),

  -- Dados pessoais
  nome text not null,
  cpf text,
  rg text,
  data_nascimento date,
  estado_civil text,
  nacionalidade text default 'Brasileira',
  profissao text,
  renda_mensal numeric(12,2),
  empresa text,

  -- Contato
  email text,
  telefone text,
  whatsapp text,

  -- Endereço anterior
  endereco text,
  bairro text,
  cidade text,
  estado text,
  cep text,

  -- Portal de acesso (locatário/locador)
  tem_portal boolean default false,
  portal_email text,
  portal_ativo boolean default true,

  -- Corretor responsável
  corretor_id uuid references users(id),

  -- Status
  status text default 'ativo' check (status in ('ativo','inativo','lead','bloqueado')),

  -- Metadados
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================
-- 4. CONSULTAS SMARTBUSCAS (crédito)
-- =====================================================
create table consultas_credito (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete cascade,
  consultado_por uuid references users(id),

  -- Resultado
  score integer,
  classificacao text, -- 'otimo','bom','regular','ruim'
  restricoes_spc boolean default false,
  restricoes_serasa boolean default false,
  protestos boolean default false,
  cheques_sem_fundo boolean default false,
  acoes_judiciais boolean default false,
  renda_estimada_min numeric(12,2),
  renda_estimada_max numeric(12,2),
  score_boavista integer,
  resultado_completo jsonb, -- resposta bruta da API

  -- Status
  aprovado boolean,
  protocolo text,
  pdf_url text,

  created_at timestamptz default now()
);

-- =====================================================
-- 5. IMÓVEIS
-- =====================================================
create table imoveis (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  proprietario_id uuid references clientes(id),
  corretor_id uuid references users(id),

  -- Identificação
  titulo text not null,
  codigo_interno text,
  tipo text check (tipo in ('apartamento','casa','studio','sobrado','terreno','comercial','galpao','outro')),
  finalidade text check (finalidade in ('aluguel','venda','aluguel_venda')),

  -- Localização
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  cep text,
  latitude numeric,
  longitude numeric,

  -- Características
  area_total numeric(10,2),
  area_util numeric(10,2),
  quartos integer default 0,
  suites integer default 0,
  banheiros integer default 0,
  vagas integer default 0,
  andar integer,
  total_andares integer,
  mobiliado boolean default false,
  pet boolean default false,

  -- Valores
  valor_aluguel numeric(12,2),
  valor_venda numeric(12,2),
  valor_condominio numeric(12,2),
  valor_iptu numeric(12,2),

  -- Status
  status text default 'disponivel' check (status in ('disponivel','alugado','vendido','em_analise','inativo','rascunho')),
  publicado_portal boolean default false,

  -- Mídia
  fotos jsonb default '[]',
  descricao text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================
-- 6. CONTRATOS
-- =====================================================
create table contratos (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  imovel_id uuid references imoveis(id),
  locatario_id uuid references clientes(id),
  locador_id uuid references clientes(id),
  corretor_id uuid references users(id),

  -- Identificação
  numero text not null,
  tipo text default 'locacao_residencial' check (tipo in ('locacao_residencial','locacao_comercial','compra_venda')),

  -- Período
  data_inicio date not null,
  data_fim date not null,
  data_assinatura date,

  -- Valores
  valor_mensal numeric(12,2) not null,
  valor_atual numeric(12,2), -- após reajustes
  valor_caucao numeric(12,2),
  caucao_devolvido boolean default false,

  -- Reajuste
  indice_reajuste text default 'igpm' check (indice_reajuste in ('igpm','ipca','inpc','ivar')),
  mes_reajuste integer check (mes_reajuste between 1 and 12),
  ultimo_reajuste date,
  proximo_reajuste date,

  -- Rescisão
  multa_rescisao_locatario numeric(5,2) default 3, -- em número de aluguéis
  multa_rescisao_locador numeric(5,2) default 3,
  aviso_previo_dias integer default 30,

  -- Garantia
  tipo_garantia text check (tipo_garantia in ('caucao','fiador','seguro_fianca','titulo_capitalizacao')),

  -- Status
  status text default 'ativo' check (status in ('ativo','encerrado','rescindido','vencendo','pendente')),

  -- PDF gerado
  contrato_pdf_url text,
  observacoes text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================
-- 7. REAJUSTES (histórico)
-- =====================================================
create table reajustes (
  id uuid primary key default uuid_generate_v4(),
  contrato_id uuid references contratos(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  aplicado_por uuid references users(id),

  indice text not null,
  percentual numeric(8,4) not null,
  valor_anterior numeric(12,2) not null,
  valor_novo numeric(12,2) not null,
  data_aplicacao date not null,
  periodo_referencia text, -- ex: 'Jul/23–Jun/24'

  aditivo_pdf_url text,
  notificado_locatario boolean default false,
  notificado_locador boolean default false,

  created_at timestamptz default now()
);

-- =====================================================
-- 8. LAUDOS DE VISTORIA
-- =====================================================
create table laudos_vistoria (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  contrato_id uuid references contratos(id) on delete cascade,
  realizado_por uuid references users(id),

  tipo text check (tipo in ('entrada','saida','periodica')),
  data_vistoria date not null,

  -- Itens avaliados (JSON flexível por cômodo)
  itens jsonb default '[]',
  -- Estrutura: [{comodo, item, condicao_entrada, condicao_saida, observacao}]

  observacoes_gerais text,
  fotos jsonb default '[]',
  pdf_url text,
  assinado boolean default false,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================
-- 9. DOCUMENTOS (histórico por cliente/contrato)
-- =====================================================
create table documentos (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  cliente_id uuid references clientes(id),
  contrato_id uuid references contratos(id),

  tipo text not null check (tipo in (
    'contrato_locacao','laudo_entrada','laudo_saida',
    'aditivo_reajuste','comprovante_pagamento','caucao_recibo',
    'rg','cpf','comprovante_renda','comprovante_residencia',
    'consulta_credito','rescisao','outro'
  )),
  nome text not null,
  descricao text,
  arquivo_url text,
  tamanho_bytes bigint,
  mime_type text,

  created_at timestamptz default now()
);

-- =====================================================
-- 10. COMPROVANTES DE PAGAMENTO
-- =====================================================
create table comprovantes (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  contrato_id uuid references contratos(id) on delete cascade,
  cliente_id uuid references clientes(id),

  mes_referencia text not null, -- 'junho/2024'
  valor numeric(12,2) not null,
  data_pagamento date,
  forma_pagamento text check (forma_pagamento in ('pix','transferencia','boleto','dinheiro','cartao')),
  status text default 'pago' check (status in ('pago','pendente','em_atraso','cancelado')),

  comprovante_url text,
  recibo_url text,
  observacoes text,

  created_at timestamptz default now()
);

-- =====================================================
-- 11. FORNECEDORES
-- =====================================================
create table fornecedores (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,

  nome text not null,
  especialidade text check (especialidade in (
    'hidraulica','eletrica','pintura','serralheria',
    'ar_condicionado','limpeza','geral','outro'
  )),
  cnpj_cpf text,
  registro_profissional text,
  telefone text,
  whatsapp text,
  email text,
  area_atendimento text,
  avaliacao numeric(3,1) default 5.0,
  total_servicos integer default 0,
  ativo boolean default true,
  observacoes text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================
-- 12. DEMANDAS DE REPARO
-- =====================================================
create table demandas (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  imovel_id uuid references imoveis(id),
  contrato_id uuid references contratos(id),
  locatario_id uuid references clientes(id),
  locador_id uuid references clientes(id),
  fornecedor_id uuid references fornecedores(id),
  responsavel_id uuid references users(id),

  -- Identificação
  numero text,
  titulo text not null,
  descricao text,

  -- Classificação
  tipo text check (tipo in (
    'vazamento','eletrica','hidraulica','esquadria',
    'pintura','eletrodomestico','outro'
  )),
  local_imovel text, -- cozinha, banheiro, sala...
  urgencia text default 'media' check (urgencia in ('alta','media','baixa')),
  origem text default 'locatario' check (origem in ('locatario','imobiliaria')),

  -- Fluxo de aprovação
  status text default 'aberta' check (status in (
    'aberta','recebida','aguardando_locador',
    'autorizada','em_execucao','concluida','recusada'
  )),
  autorizado_por uuid references clientes(id),
  data_autorizacao timestamptz,
  motivo_recusa text,

  -- Financeiro
  orcamento numeric(12,2),
  valor_final numeric(12,2),
  quem_paga text check (quem_paga in ('locador','locatario','imobiliaria','a_definir')),

  -- Mídia
  fotos jsonb default '[]',

  -- Datas
  data_abertura timestamptz default now(),
  data_conclusao timestamptz,
  prazo_estimado date,

  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================
-- 13. VISITAS AGENDADAS
-- =====================================================
create table visitas (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  imovel_id uuid references imoveis(id),
  cliente_id uuid references clientes(id),
  corretor_id uuid references users(id),

  data_hora timestamptz not null,
  duracao_minutos integer default 60,
  status text default 'agendada' check (status in ('agendada','confirmada','realizada','cancelada','no_show')),
  observacoes text,
  feedback text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================
-- 14. FINANCEIRO — LANÇAMENTOS
-- =====================================================
create table lancamentos (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  contrato_id uuid references contratos(id),
  cliente_id uuid references clientes(id),
  corretor_id uuid references users(id),

  tipo text check (tipo in ('receita','despesa')),
  categoria text check (categoria in (
    'aluguel','comissao_venda','taxa_administrativa',
    'reparo','manutencao','imposto','outro'
  )),
  descricao text not null,
  valor numeric(12,2) not null,
  data_lancamento date not null,
  forma_pagamento text,
  status text default 'confirmado' check (status in ('confirmado','pendente','cancelado')),
  comprovante_url text,
  observacoes text,

  created_at timestamptz default now()
);

-- =====================================================
-- 15. ATIVIDADES (log / timeline)
-- =====================================================
create table atividades (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  usuario_id uuid references users(id),
  cliente_id uuid references clientes(id),
  contrato_id uuid references contratos(id),
  imovel_id uuid references imoveis(id),
  demanda_id uuid references demandas(id),

  tipo text not null, -- 'contrato_assinado', 'pagamento_recebido', etc
  titulo text not null,
  descricao text,
  icone text,
  cor text,

  created_at timestamptz default now()
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) — multi-tenant
-- =====================================================
alter table organizations enable row level security;
alter table users enable row level security;
alter table clientes enable row level security;
alter table consultas_credito enable row level security;
alter table imoveis enable row level security;
alter table contratos enable row level security;
alter table reajustes enable row level security;
alter table laudos_vistoria enable row level security;
alter table documentos enable row level security;
alter table comprovantes enable row level security;
alter table fornecedores enable row level security;
alter table demandas enable row level security;
alter table visitas enable row level security;
alter table lancamentos enable row level security;
alter table atividades enable row level security;

-- Função auxiliar: retorna organization_id do usuário logado
create or replace function get_org_id()
returns uuid as $$
  select organization_id from users where id = auth.uid()
$$ language sql security definer stable;

-- Políticas RLS (cada tabela só enxerga dados da própria organização)
create policy "org_isolation" on clientes
  using (organization_id = get_org_id());

create policy "org_isolation" on imoveis
  using (organization_id = get_org_id());

create policy "org_isolation" on contratos
  using (organization_id = get_org_id());

create policy "org_isolation" on reajustes
  using (organization_id = get_org_id());

create policy "org_isolation" on laudos_vistoria
  using (organization_id = get_org_id());

create policy "org_isolation" on documentos
  using (organization_id = get_org_id());

create policy "org_isolation" on comprovantes
  using (organization_id = get_org_id());

create policy "org_isolation" on fornecedores
  using (organization_id = get_org_id());

create policy "org_isolation" on demandas
  using (organization_id = get_org_id());

create policy "org_isolation" on visitas
  using (organization_id = get_org_id());

create policy "org_isolation" on lancamentos
  using (organization_id = get_org_id());

create policy "org_isolation" on atividades
  using (organization_id = get_org_id());

create policy "org_isolation" on consultas_credito
  using (organization_id = get_org_id());

-- =====================================================
-- ÍNDICES (performance)
-- =====================================================
create index idx_clientes_org on clientes(organization_id);
create index idx_clientes_tipo on clientes(tipo);
create index idx_imoveis_org on imoveis(organization_id);
create index idx_imoveis_status on imoveis(status);
create index idx_contratos_org on contratos(organization_id);
create index idx_contratos_status on contratos(status);
create index idx_contratos_data_fim on contratos(data_fim);
create index idx_demandas_org on demandas(organization_id);
create index idx_demandas_status on demandas(status);
create index idx_documentos_cliente on documentos(cliente_id);
create index idx_documentos_contrato on documentos(contrato_id);
create index idx_lancamentos_org on lancamentos(organization_id);
create index idx_atividades_cliente on atividades(cliente_id);
create index idx_atividades_contrato on atividades(contrato_id);

-- =====================================================
-- TRIGGERS — updated_at automático
-- =====================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_organizations before update on organizations
  for each row execute function update_updated_at();
create trigger trg_users before update on users
  for each row execute function update_updated_at();
create trigger trg_clientes before update on clientes
  for each row execute function update_updated_at();
create trigger trg_imoveis before update on imoveis
  for each row execute function update_updated_at();
create trigger trg_contratos before update on contratos
  for each row execute function update_updated_at();
create trigger trg_laudos before update on laudos_vistoria
  for each row execute function update_updated_at();
create trigger trg_fornecedores before update on fornecedores
  for each row execute function update_updated_at();
create trigger trg_demandas before update on demandas
  for each row execute function update_updated_at();
create trigger trg_visitas before update on visitas
  for each row execute function update_updated_at();

