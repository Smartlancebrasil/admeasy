export type Perfil = 'admin' | 'corretor' | 'assistente'
export type TipoCliente = 'locatario' | 'locador' | 'comprador' | 'vendedor' | 'lead'
export type StatusCliente = 'ativo' | 'inativo' | 'lead' | 'bloqueado'
export type TipoImovel = 'apartamento' | 'casa' | 'studio' | 'sobrado' | 'terreno' | 'comercial' | 'galpao' | 'outro'
export type StatusImovel = 'disponivel' | 'alugado' | 'vendido' | 'em_analise' | 'inativo' | 'rascunho'
export type IndiceReajuste = 'igpm' | 'ipca' | 'inpc' | 'ivar'
export type StatusContrato = 'ativo' | 'encerrado' | 'rescindido' | 'vencendo' | 'pendente'
export type StatusDemanda = 'aberta' | 'recebida' | 'aguardando_locador' | 'autorizada' | 'em_execucao' | 'concluida' | 'recusada'
export type Urgencia = 'alta' | 'media' | 'baixa'

export interface Organization {
  id: string
  nome: string
  cnpj?: string
  creci?: string
  email?: string
  telefone?: string
  logo_url?: string
  cor_primaria: string
  plano: 'basico' | 'intermediario' | 'avancado'
  ativo: boolean
}

export interface Cliente {
  id: string
  organization_id: string
  tipo: TipoCliente
  nome: string
  cpf?: string
  rg?: string
  data_nascimento?: string
  estado_civil?: string
  profissao?: string
  renda_mensal?: number
  empresa?: string
  email?: string
  telefone?: string
  whatsapp?: string
  endereco?: string
  bairro?: string
  cidade?: string
  estado?: string
  cep?: string
  tem_portal: boolean
  portal_email?: string
  corretor_id?: string
  status: StatusCliente
  observacoes?: string
  created_at: string
}

export interface Imovel {
  id: string
  organization_id: string
  proprietario_id?: string
  titulo: string
  tipo?: TipoImovel
  finalidade?: 'aluguel' | 'venda' | 'aluguel_venda'
  endereco?: string
  bairro?: string
  cidade?: string
  estado?: string
  area_total?: number
  quartos?: number
  banheiros?: number
  vagas?: number
  valor_aluguel?: number
  valor_venda?: number
  valor_condominio?: number
  status: StatusImovel
  publicado_portal: boolean
  descricao?: string
  fotos: string[]
  created_at: string
}

export interface Contrato {
  id: string
  organization_id: string
  imovel_id: string
  locatario_id: string
  locador_id: string
  numero: string
  tipo: string
  data_inicio: string
  data_fim: string
  valor_mensal: number
  valor_atual?: number
  valor_caucao?: number
  indice_reajuste: IndiceReajuste
  mes_reajuste?: number
  proximo_reajuste?: string
  multa_rescisao_locatario: number
  multa_rescisao_locador: number
  aviso_previo_dias: number
  tipo_garantia?: string
  status: StatusContrato
  observacoes?: string
  created_at: string
  // joins
  imovel?: Imovel
  locatario?: Cliente
  locador?: Cliente
}

export interface Demanda {
  id: string
  organization_id: string
  imovel_id?: string
  contrato_id?: string
  locatario_id?: string
  locador_id?: string
  fornecedor_id?: string
  numero?: string
  titulo: string
  descricao?: string
  tipo?: string
  local_imovel?: string
  urgencia: Urgencia
  origem: 'locatario' | 'imobiliaria'
  status: StatusDemanda
  orcamento?: number
  valor_final?: number
  quem_paga?: string
  fotos: string[]
  data_abertura: string
  data_conclusao?: string
  observacoes?: string
}

export interface Fornecedor {
  id: string
  organization_id: string
  nome: string
  especialidade?: string
  cnpj_cpf?: string
  telefone?: string
  whatsapp?: string
  email?: string
  area_atendimento?: string
  avaliacao: number
  total_servicos: number
  ativo: boolean
}

export interface Lancamento {
  id: string
  organization_id: string
  contrato_id?: string
  tipo: 'receita' | 'despesa'
  categoria: string
  descricao: string
  valor: number
  data_lancamento: string
  status: string
}
