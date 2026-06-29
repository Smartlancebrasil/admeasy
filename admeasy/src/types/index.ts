// ============================================================
// AdmEasy — Tipos TypeScript
// ============================================================

export type TipoUsuario = 'admin' | 'corretor' | 'locatario' | 'locador'
export type StatusContrato = 'rascunho' | 'aguardando_assinatura' | 'ativo' | 'vencendo' | 'vencido' | 'rescindido' | 'renovado'
export type IndiceReajuste = 'IGP-M' | 'IPCA' | 'INPC' | 'IVAR'
export type TipoGarantia = 'caucao' | 'seguro_fianca' | 'fiador' | 'titulo_capitalizacao'
export type StatusDemanda = 'aberta' | 'recebida' | 'aguardando_autorizacao' | 'em_execucao' | 'concluida' | 'cancelada'
export type TipoSeguro = 'fianca' | 'incendio' | 'conteudo'

export interface Organizacao {
  id: string
  nome: string
  cnpj?: string
  creci?: string
  email: string
  telefone?: string
  logo_url?: string
  cor_primaria: string
  taxa_adm_padrao: number
  plano: 'basico' | 'intermediario' | 'avancado'
  ativo: boolean
  criado_em: string
}

export interface Usuario {
  id: string
  organizacao_id: string
  nome: string
  email: string
  telefone?: string
  cpf?: string
  rg?: string
  estado_civil?: string
  profissao?: string
  endereco?: string
  tipo: TipoUsuario
  ativo: boolean
  criado_em: string
}

export interface Imovel {
  id: string
  organizacao_id: string
  locador_id?: string
  titulo: string
  tipo: 'apartamento' | 'casa' | 'studio' | 'sobrado' | 'terreno' | 'comercial' | 'sala'
  finalidade: 'aluguel' | 'venda' | 'ambos'
  valor: number
  valor_condominio: number
  area_m2?: number
  dormitorios: number
  banheiros: number
  vagas: number
  endereco: string
  bairro?: string
  cidade?: string
  estado: string
  cep?: string
  descricao?: string
  fotos: string[]
  publicado_portal: boolean
  status: 'disponivel' | 'alugado' | 'vendido' | 'em_analise' | 'inativo'
  criado_em: string
  // joins
  locador?: Usuario
}

export interface Contrato {
  id: string
  organizacao_id: string
  imovel_id: string
  locador_id: string
  locatario_id: string
  corretor_id?: string
  numero: string
  tipo: string
  data_inicio: string
  data_fim: string
  valor_mensal: number
  dia_vencimento: number
  indice_reajuste: IndiceReajuste
  mes_reajuste?: number
  data_ultimo_reajuste?: string
  valor_pos_reajuste?: number
  garantia?: TipoGarantia
  valor_caucao?: number
  multa_rescisoria: number
  taxa_adm_modelo: 'fixa' | 'servico'
  taxa_adm_percentual: number
  clicksign_doc_key?: string
  status: StatusContrato
  observacoes?: string
  criado_em: string
  // joins
  imovel?: Imovel
  locador?: Usuario
  locatario?: Usuario
  corretor?: Usuario
}

export interface Reajuste {
  id: string
  contrato_id: string
  indice: string
  percentual: number
  valor_anterior: number
  valor_novo: number
  data_aplicacao: string
  competencia: string
  notificado_locatario: boolean
  notificado_locador: boolean
  criado_em: string
}

export interface Seguro {
  id: string
  organizacao_id: string
  contrato_id?: string
  imovel_id?: string
  locatario_id?: string
  tipo: TipoSeguro
  seguradora: string
  numero_apolice: string
  premio_mensal: number
  cobertura_total: number
  vigencia_inicio: string
  vigencia_fim: string
  responsavel_pagamento: string
  dias_aviso_renovacao: number
  status: 'ativo' | 'vencendo' | 'vencido' | 'cancelado' | 'renovado'
  criado_em: string
  // joins
  imovel?: Imovel
  locatario?: Usuario
}

export interface Demanda {
  id: string
  organizacao_id: string
  contrato_id?: string
  imovel_id?: string
  locatario_id?: string
  fornecedor_id?: string
  numero: string
  tipo: string
  local_problema?: string
  urgencia: 'alta' | 'media' | 'baixa'
  descricao: string
  fotos: string[]
  orcamento?: number
  requer_autorizacao_locador: boolean
  locador_autorizou?: boolean
  status: StatusDemanda
  criado_em: string
  // joins
  imovel?: Imovel
  locatario?: Usuario
  fornecedor?: Fornecedor
}

export interface Fornecedor {
  id: string
  organizacao_id: string
  nome: string
  especialidade: string
  telefone?: string
  email?: string
  cpf_cnpj?: string
  registro_profissional?: string
  area_atendimento?: string
  avaliacao_media: number
  total_servicos: number
  ativo: boolean
}

export interface Financeiro {
  id: string
  organizacao_id: string
  contrato_id?: string
  tipo: 'aluguel' | 'taxa_adm' | 'comissao' | 'reparo' | 'seguro' | 'caucao' | 'outros'
  descricao: string
  valor: number
  natureza: 'receita' | 'despesa'
  data_lancamento: string
  pago: boolean
  referencia_mes?: string
}

export interface NotificacaoLog {
  id: string
  organizacao_id: string
  tipo: string
  canal: 'whatsapp' | 'email' | 'push'
  destinatario_nome?: string
  destinatario_contato?: string
  referencia_tipo?: string
  referencia_id?: string
  status: 'enviado' | 'entregue' | 'lido' | 'falhou'
  enviado_em: string
}

// Resultado do cálculo de reajuste
export interface ResultadoReajuste {
  indice: IndiceReajuste
  percentual: number
  valorAnterior: number
  acrescimo: number
  valorNovo: number
}

// Resultado do cálculo de rescisão
export interface ResultadoRescisao {
  aluguelProporcional: number
  multaContratual: number
  avisoPrevioValor: number
  caucaoDevolver: number
  totalAPagar: number
  quemPaga: 'locatario' | 'locador' | 'nenhum'
}

// Dashboard metrics
export interface DashboardMetrics {
  totalImoveis: number
  totalContratos: number
  contratosVencendo: number
  demandaAbertas: number
  segurosVencendo: number
  receitaMes: number
  notificacoesHoje: number
  aguardandoAssinatura: number
}
