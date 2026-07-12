'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { useOrganization } from '@/lib/OrganizationContext'
import { FileText, Plus, X, AlertTriangle, Edit2, FileDown, UserPlus, Upload, Download, Trash2, Hourglass, CheckCircle2 } from 'lucide-react'
import { registrarLog } from '@/lib/logs'

type Contrato = {
  id: string
  numero: string
  tipo: string
  data_inicio: string
  data_fim: string
  valor_mensal: number
  valor_atual?: number
  valor_caucao?: number
  valor_condominio?: number
  valor_iptu?: number
  valor_seguro_incendio?: number
  valor_seguro_fianca?: number
  seguradora_fianca?: string
  apolice_fianca?: string
  parcelas_caucao?: number
  indice_reajuste: string
  mes_reajuste?: number
  multa_rescisao_locatario: number
  multa_rescisao_locador: number
  aviso_previo_dias: number
  tipo_garantia?: string
  status: string
  observacoes?: string
  imovel_id?: string
  locatario_id?: string
  locador_id?: string
  fiador_id?: string
  locatarios_adicionais?: string[]
  locadores_adicionais?: string[]
  fiador_imovel_cep?: string
  fiador_imovel_endereco?: string
  fiador_imovel_numero?: string
  fiador_imovel_complemento?: string
  fiador_imovel_bairro?: string
  fiador_imovel_cidade?: string
  fiador_imovel_estado?: string
  fiador_imovel_matricula?: string
  fiador_imovel_iptu?: string
  taxa_administracao?: number
  honorarios_aplicavel?: boolean
  valor_honorarios?: number
  foro?: string
  apolice_incendio_numero?: string
  apolice_incendio_valor?: number
  forma_recebimento_caucao?: string
  pix_recebimento_caucao?: string
  banco_recebimento_caucao?: string
  agencia_recebimento_caucao?: string
  conta_recebimento_caucao?: string
  dados_qualificacao?: any
  imovel?: any
  locatario?: any
  locador?: any
  fiador?: any
}

type Parte = {
  nome: string; cpf: string; rg: string; profissao: string
  estado_civil: string; endereco: string; nacionalidade: string
}

type Documento = { nome: string; url: string; tipo: string; created_at: string }

// Categorias fixas do "kit" de documentos assinados, exibido na tela de
// consulta (somente leitura) do contrato — depois de gerado o PDF.
const KIT_CATEGORIAS: { chave: string; label: string; somenteGarantia?: string }[] = [
  { chave: 'documentos_locatario', label: 'Documentos do locatário' },
  { chave: 'documentos_locador', label: 'Documentos do locador' },
  { chave: 'contrato_assinado', label: 'Contrato de locação assinado' },
  { chave: 'laudo_vistoria', label: 'Laudo de vistoria assinado' },
  { chave: 'termo_entrega_chaves', label: 'Termo de entrega de chaves' },
  { chave: 'apolice_seguro_incendio', label: 'Apólice do seguro incêndio' },
  { chave: 'comprovante_caucao', label: 'Comprovante de pagamento da caução', somenteGarantia: 'caucao' },
  { chave: 'apolice_seguro_fianca', label: 'Apólice do seguro fiança assinado', somenteGarantia: 'seguro_fianca' },
]

const ESTADO_CIVIL_LABEL: Record<string, string> = {
  solteiro: 'solteiro(a)', casado: 'casado(a)', divorciado: 'divorciado(a)',
  viuvo: 'viúvo(a)', separado: 'separado(a)', uniao_estavel: 'em união estável',
}

type SelectOpt = { id: string; titulo?: string; nome?: string; valor_aluguel?: number; valor_condominio?: number; valor_iptu?: number; taxa_administracao?: number; tipo?: string; categoria?: string; finalidade?: string; codigo?: string; endereco?: string; bairro?: string; cidade?: string; estado?: string; cpf?: string; rg?: string; profissao?: string; estado_civil?: string; telefone?: string; chave_pix?: string }

function diasRestantes(dataFim: string) {
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const fim = new Date(dataFim + 'T00:00:00')
  return Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

function mesesContrato(dataInicio: string, dataFim: string) {
  const ini = new Date(dataInicio + 'T00:00:00')
  const fim = new Date(dataFim + 'T00:00:00')
  let meses = (fim.getFullYear() - ini.getFullYear()) * 12 + (fim.getMonth() - ini.getMonth())
  if (fim.getDate() >= ini.getDate()) meses += 1
  return Math.max(1, meses)
}

function calcularDataFim(dataInicio: string, duracaoMeses: number) {
  if (!dataInicio || !duracaoMeses || duracaoMeses <= 0) return ''
  const d = new Date(dataInicio + 'T00:00:00')
  d.setMonth(d.getMonth() + duracaoMeses)
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

function tipoContratoDoImovel(categoriaImovel?: string, finalidadeImovel?: string): string | null {
  if (categoriaImovel === 'comercial') return 'locacao_comercial'
  if (categoriaImovel === 'residencial') return 'locacao_residencial'
  return null
}

function statusContrato(dataFim: string, status: string) {
  if (status === 'encerrado' || status === 'rescindido') return status
  const dias = diasRestantes(dataFim)
  if (dias < 0) return 'encerrado'
  if (dias <= 15) return 'vencendo'
  if (dias <= 30) return 'atencao'
  return 'ativo'
}

const statusBadge: Record<string,string> = {
  ativo:'badge badge-green', vencendo:'badge badge-red',
  atencao:'badge badge-yellow', encerrado:'badge badge-gray',
  rescindido:'badge badge-gray', pendente:'badge badge-yellow',
}
const statusLabel: Record<string,string> = {
  ativo:'Ativo', vencendo:'Vencendo', atencao:'Atenção',
  encerrado:'Encerrado', rescindido:'Rescindido', pendente:'Pendente',
}

function formatVal(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}
function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date + 'T00:00:00'))
}
function getTitulo(val: any): string {
  if (!val) return '—'; if (Array.isArray(val)) return val[0]?.titulo || '—'; return val.titulo || '—'
}
function getNome(val: any): string {
  if (!val) return '—'; if (Array.isArray(val)) return val[0]?.nome || '—'; return val.nome || '—'
}

const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const DIAS_EXTENSO = [
  '', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
  'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte',
  'vinte e um', 'vinte e dois', 'vinte e três', 'vinte e quatro', 'vinte e cinco',
  'vinte e seis', 'vinte e sete', 'vinte e oito', 'vinte e nove', 'trinta', 'trinta e um',
]
const ORDINAIS_EXT = [
  '', 'primeiro', 'segundo', 'terceiro', 'quarto', 'quinto', 'sexto', 'sétimo', 'oitavo', 'nono', 'décimo',
  'décimo primeiro', 'décimo segundo', 'décimo terceiro', 'décimo quarto', 'décimo quinto',
  'décimo sexto', 'décimo sétimo', 'décimo oitavo', 'décimo nono', 'vigésimo',
  'vigésimo primeiro', 'vigésimo segundo', 'vigésimo terceiro', 'vigésimo quarto', 'vigésimo quinto',
  'vigésimo sexto', 'vigésimo sétimo', 'vigésimo oitavo', 'vigésimo nono', 'trigésimo', 'trigésimo primeiro',
]
function diaOrdinalExtenso(dia: number): string { return ORDINAIS_EXT[dia] || String(dia) }
function diaExtenso(dia: number): string { return DIAS_EXTENSO[dia] || String(dia) }

const UNIDADES_EXT = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
const DEZ_A_DEZENOVE_EXT = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZENAS_EXT = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS_EXT = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function centenaExtenso(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const partes: string[] = []
  const c = Math.floor(n / 100)
  const resto = n % 100
  if (c > 0) partes.push(CENTENAS_EXT[c])
  if (resto > 0) {
    if (resto < 10) partes.push(UNIDADES_EXT[resto])
    else if (resto < 20) partes.push(DEZ_A_DEZENOVE_EXT[resto - 10])
    else {
      const d = Math.floor(resto / 10)
      const u = resto % 10
      partes.push(u > 0 ? `${DEZENAS_EXT[d]} e ${UNIDADES_EXT[u]}` : DEZENAS_EXT[d])
    }
  }
  return partes.join(' e ')
}

function numeroExtenso(n: number): string {
  if (n === 0) return 'zero'
  const partes: string[] = []
  const milhoes = Math.floor(n / 1000000)
  const milhares = Math.floor((n % 1000000) / 1000)
  const resto = n % 1000
  if (milhoes > 0) partes.push(milhoes === 1 ? 'um milhão' : `${centenaExtenso(milhoes)} milhões`)
  if (milhares > 0) partes.push(milhares === 1 ? 'mil' : `${centenaExtenso(milhares)} mil`)
  if (resto > 0) partes.push(centenaExtenso(resto))
  return partes.join(' e ')
}

function valorExtenso(val: number): string {
  const inteiros = Math.floor(val)
  const centavos = Math.round((val - inteiros) * 100)
  const inteirosTexto = numeroExtenso(inteiros).toUpperCase()
  const reaisLabel = inteiros === 1 ? 'REAL' : 'REAIS'
  if (centavos > 0) {
    const centavosTexto = numeroExtenso(centavos).toUpperCase()
    const centavosLabel = centavos === 1 ? 'CENTAVO' : 'CENTAVOS'
    return `${inteirosTexto} ${reaisLabel} E ${centavosTexto} ${centavosLabel}`
  }
  return `${inteirosTexto} ${reaisLabel}`
}

function mesesEntre(inicio: string, fim: string): number {
  const i = new Date(inicio + 'T00:00:00')
  const f = new Date(fim + 'T00:00:00')
  return Math.round((f.getTime() - i.getTime()) / (1000 * 60 * 60 * 24 * 30))
}

function dataExtenso(dateStr: string): string {
  const mesesL = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  const d = new Date(dateStr + 'T12:00:00')
  return `${d.getDate()} de ${mesesL[d.getMonth()]} de ${d.getFullYear()}`
}

function ModalSelecionarCliente({ clientes, titulo, onSelecionar, onAdicionarNovo, onFechar }: {
  clientes: SelectOpt[]; titulo: string; onSelecionar: (cliente: SelectOpt) => void; onAdicionarNovo: () => void; onFechar: () => void
}) {
  const [busca, setBusca] = useState('')
  const termo = busca.toLowerCase()
  const filtrados = clientes.filter(c =>
    (c.nome || '').toLowerCase().includes(termo) ||
    c.cpf?.includes(termo) ||
    c.telefone?.includes(termo)
  )

  return (
    <div style={{ background: 'rgba(0,0,0,0.7)' }} className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onFechar}>
      <div style={{ background: '#0d1b2e', border: '0.5px solid #1e3a5f' }} className="rounded-2xl p-5 w-full max-w-lg my-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold">Selecionar {titulo}</h3>
          <button onClick={onFechar} style={{ color: '#8b9ab4' }}><X size={16} /></button>
        </div>
        <input
          className="input mb-3"
          autoFocus
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome, CPF ou telefone..."
        />
        <button
          type="button"
          onClick={onAdicionarNovo}
          style={{ background: '#1A7FFF' }}
          className="w-full py-2.5 rounded-xl text-white text-sm font-semibold mb-3 flex items-center justify-center gap-2"
        >
          <UserPlus size={14} />Não encontrei — cadastrar novo {titulo}
        </button>
        <div style={{ maxHeight: '50vh', overflowY: 'auto' }} className="space-y-1.5">
          {filtrados.length === 0 && (
            <p style={{ color: '#8b9ab4' }} className="text-sm text-center py-6">Nenhum cliente encontrado.</p>
          )}
          {filtrados.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onSelecionar(c); onFechar() }}
              style={{ background: '#16243a', border: '0.5px solid #1e3a5f' }}
              className="w-full text-left rounded-xl p-3 hover:opacity-80 transition-opacity"
            >
              <p style={{ color: '#f4f4f3' }} className="text-sm font-medium truncate">{c.nome}</p>
              <p style={{ color: '#8b9ab4' }} className="text-xs truncate">
                {[c.cpf, c.telefone].filter(Boolean).join(' · ') || 'Sem CPF/telefone cadastrado'}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ModalSelecionarImovel({ imoveis, onSelecionar, onFechar }: {
  imoveis: SelectOpt[]; onSelecionar: (imovel: SelectOpt) => void; onFechar: () => void
}) {
  const [busca, setBusca] = useState('')
  const termo = busca.toLowerCase()
  const filtrados = imoveis.filter(i =>
    (i.codigo || '').toLowerCase().includes(termo) ||
    (i.titulo || '').toLowerCase().includes(termo) ||
    (i.endereco || '').toLowerCase().includes(termo) ||
    (i.bairro || '').toLowerCase().includes(termo)
  )

  return (
    <div style={{ background: 'rgba(0,0,0,0.7)' }} className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onFechar}>
      <div style={{ background: '#0d1b2e', border: '0.5px solid #1e3a5f' }} className="rounded-2xl p-5 w-full max-w-lg my-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold">Selecionar imóvel</h3>
          <button onClick={onFechar} style={{ color: '#8b9ab4' }}><X size={16} /></button>
        </div>
        <input
          className="input mb-3"
          autoFocus
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por código, título, endereço ou bairro..."
        />
        <div style={{ maxHeight: '55vh', overflowY: 'auto' }} className="space-y-1.5">
          {filtrados.length === 0 && (
            <p style={{ color: '#8b9ab4' }} className="text-sm text-center py-6">Nenhum imóvel encontrado.</p>
          )}
          {filtrados.map(i => (
            <button
              key={i.id}
              type="button"
              onClick={() => { onSelecionar(i); onFechar() }}
              style={{ background: '#16243a', border: '0.5px solid #1e3a5f' }}
              className="w-full text-left rounded-xl p-3 hover:opacity-80 transition-opacity flex items-center gap-3"
            >
              <div className="min-w-0">
                <p style={{ color: '#f4f4f3' }} className="text-sm font-medium truncate">{i.titulo}</p>
                <p style={{ color: '#8b9ab4' }} className="text-xs truncate">{[i.endereco, i.bairro].filter(Boolean).join(', ')}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function InputMoeda({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const display = value && !isNaN(Number(value))
    ? Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : ''
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) { onChange(''); return }
    onChange(String(parseInt(digits, 10) / 100))
  }
  return (
    <input
      className="input"
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder={placeholder || 'R$ 0,00'}
    />
  )
}

const formVazio = {
  id:'', numero:'', tipo:'locacao_residencial',
  imovel_id:'', locatario_id:'', locador_id:'', fiador_id:'', locatarios_adicionais:'', locadores_adicionais:'', taxa_administracao: '10',
  honorarios_aplicavel: '', valor_honorarios: '',
  data_inicio:'', data_fim:'', duracao_meses:'',
  valor_mensal:'', valor_condominio:'', valor_iptu:'', valor_seguro_incendio:'', valor_seguro_fianca:'',
  seguradora_fianca:'', apolice_fianca:'',
  valor_caucao:'',
  parcelas_caucao: '1',
  indice_reajuste:'igpm', mes_reajuste:'1',
  multa_rescisao_locatario:'3', multa_rescisao_locador:'',
  aviso_previo_dias:'30', tipo_garantia:'',
  status:'ativo', observacoes:'',
  // Campos usados só no texto do PDF do contrato (opcionais, ficam na própria tela principal)
  foro: 'Santana, São Paulo, SP',
  apolice_incendio_numero: '',
  forma_recebimento_caucao: 'pix',
  pix_recebimento_caucao: '', banco_recebimento_caucao: '', agencia_recebimento_caucao: '', conta_recebimento_caucao: '',
  fiador_imovel_cep: '', fiador_imovel_endereco: '', fiador_imovel_numero: '', fiador_imovel_complemento: '',
  fiador_imovel_bairro: '', fiador_imovel_cidade: '', fiador_imovel_estado: '',
  fiador_imovel_matricula: '', fiador_imovel_iptu: '',
}

const clienteFormVazio: Record<string, string> = {
  nome: '', tipo: 'locatario', cpf: '', rg: '',
  estado_civil: '', profissao: '',
  email: '', telefone: '',
  cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
  chave_pix: '',
  status: 'ativo',
}

const conjugeFormVazio: Record<string, string> = {
  nome: '', cpf: '', rg: '', profissao: '',
}

const UFs_MODAL = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

/**
 * Modal de cadastro de cliente para qualificacao do contrato.
 * Campos: nome, CPF, RG, estado civil, profissao, endereco completo, email, celular.
 * Se "casado(a)", habilita o cadastro do conjuge como registro separado em clientes,
 * reaproveitando o mesmo endereco do titular (sem duplicidade).
 */
function ModalClienteCompleto({ tipoParte, onSalvar, onFechar, organizationId }: {
  tipoParte: 'locatario' | 'locador' | 'fiador'
  onSalvar: (cliente: { id: string; nome: string }) => void
  onFechar: () => void
  organizationId: string
}) {
  const [form, setForm] = useState<Record<string, string>>({ ...clienteFormVazio, tipo: tipoParte })
  const [cadastrarConjuge, setCadastrarConjuge] = useState(false)
  const [conjuge, setConjuge] = useState<Record<string, string>>({ ...conjugeFormVazio })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const set = (campo: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [campo]: e.target.value }))

  const setConj = (campo: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setConjuge(c => ({ ...c, [campo]: e.target.value }))

  const [buscandoCep, setBuscandoCep] = useState(false)

  // Busca o endereço automaticamente assim que o CEP tiver os 8 dígitos —
  // não precisa clicar em outro campo nem apertar Enter.
  async function buscarCep(cepDigitado: string) {
    const cepLimpo = cepDigitado.replace(/\D/g, '')
    if (cepLimpo.length !== 8) return
    setBuscandoCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
      const dados = await res.json()
      if (!dados.erro) {
        setForm(f => ({
          ...f,
          endereco: dados.logradouro || f.endereco,
          bairro: dados.bairro || f.bairro,
          cidade: dados.localidade || f.cidade,
          estado: dados.uf || f.estado,
        }))
      }
    } catch {
      // Sem internet ou API fora do ar: usuário preenche manualmente, sem travar o formulário.
    }
    setBuscandoCep(false)
  }

  function aoDigitarCep(e: React.ChangeEvent<HTMLInputElement>) {
    const valor = e.target.value
    setForm(f => ({ ...f, cep: valor }))
    buscarCep(valor)
  }

  const ehCasado = form.estado_civil === 'casado'

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro('')

    // A tabela "clientes" guarda o endereço todo num campo só (endereco),
    // então juntamos rua + número + complemento aqui antes de enviar —
    // número/complemento existem só nesta tela, para facilitar o preenchimento.
    const enderecoCompleto = [form.endereco, form.numero, form.complemento].filter(Boolean).join(', ')
    const { numero, complemento, ...formSemNumeroComplemento } = form

    const payloadTitular = { ...formSemNumeroComplemento, endereco: enderecoCompleto, organization_id: organizationId, tem_portal: false }
    const { data: titular, error: erroTitular } = await supabase
      .from('clientes').insert([payloadTitular]).select('id, nome').single()

    if (erroTitular) { setSalvando(false); setErro('Erro: ' + erroTitular.message); return }

    if (ehCasado && cadastrarConjuge && conjuge.nome.trim()) {
      const payloadConjuge = {
        nome: conjuge.nome, cpf: conjuge.cpf || null, rg: conjuge.rg || null,
        profissao: conjuge.profissao || null,
        estado_civil: 'casado', tipo: form.tipo, status: 'ativo', tem_portal: false,
        // mesmo endereco do titular, para evitar duplicidade de cadastro
        endereco: enderecoCompleto || null, bairro: form.bairro || null,
        cidade: form.cidade || null, estado: form.estado || null, cep: form.cep || null,
        organization_id: organizationId,
      }
      const { error: erroConjuge } = await supabase.from('clientes').insert([payloadConjuge])
      if (erroConjuge) { setSalvando(false); setErro('Titular salvo, mas erro ao salvar cônjuge: ' + erroConjuge.message); return }
    }

    setSalvando(false)
    onSalvar(titular)
  }

  return (
    <div
      style={{ background: 'rgba(0,0,0,0.6)' }}
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onFechar}
    >
      <div
        className="card w-full max-w-2xl my-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold">
            Cadastrar {tipoParte === 'locatario' ? 'locatário' : 'locador'} — qualificação para o contrato
          </h3>
          <button onClick={onFechar} className="btn btn-sm"><X size={13} /></button>
        </div>
        <form onSubmit={salvar}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className="label">Nome completo *</label>
              <input className="input" required autoFocus value={form.nome} onChange={set('nome')} placeholder="Nome completo" /></div>
            <div><label className="label">CPF *</label>
              <input className="input" required value={form.cpf} onChange={set('cpf')} placeholder="000.000.000-00" /></div>
            <div><label className="label">RG *</label>
              <input className="input" required value={form.rg} onChange={set('rg')} /></div>
            <div><label className="label">Estado civil *</label>
              <select className="input" required value={form.estado_civil} onChange={e => { set('estado_civil')(e); if (e.target.value !== 'casado') setCadastrarConjuge(false) }}>
                <option value="">Selecionar</option><option value="solteiro">Solteiro(a)</option>
                <option value="casado">Casado(a)</option><option value="divorciado">Divorciado(a)</option>
                <option value="viuvo">Viúvo(a)</option><option value="uniao_estavel">União estável</option>
              </select></div>
            <div><label className="label">Profissão *</label>
              <input className="input" required value={form.profissao} onChange={set('profissao')} /></div>
            <div><label className="label">E-mail</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} /></div>
            <div><label className="label">Celular *</label>
              <input className="input" required value={form.telefone} onChange={set('telefone')} placeholder="(11) 99999-9999" /></div>
            <div><label className="label">CEP</label>
              <div className="relative">
                <input className="input" value={form.cep} onChange={aoDigitarCep} placeholder="00000-000" maxLength={9} />
                {buscandoCep && <span style={{ color: '#5b9bf5' }} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs">Buscando...</span>}
              </div>
            </div>
            <div><label className="label">Estado *</label>
              <select className="input" required value={form.estado} onChange={set('estado')}>
                <option value="">UF</option>{UFs_MODAL.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select></div>
            <div className="sm:col-span-2"><label className="label">Endereço (rua) *</label>
              <input className="input" required value={form.endereco} onChange={set('endereco')} placeholder="Preenchido automaticamente pelo CEP, ou digite" /></div>
            <div><label className="label">Número *</label>
              <input className="input" required value={form.numero} onChange={set('numero')} placeholder="Ex: 123" /></div>
            <div><label className="label">Complemento</label>
              <input className="input" value={form.complemento} onChange={set('complemento')} placeholder="Ex: Apto 42, Bloco B" /></div>
            <div><label className="label">Bairro *</label>
              <input className="input" required value={form.bairro} onChange={set('bairro')} /></div>
            <div><label className="label">Cidade *</label>
              <input className="input" required value={form.cidade} onChange={set('cidade')} /></div>
            {tipoParte === 'locador' && (
              <div className="sm:col-span-2"><label className="label">Chave PIX (para recebimento dos repasses)</label>
                <input className="input" value={form.chave_pix || ''} onChange={set('chave_pix')} placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória" /></div>
            )}
          </div>

          {ehCasado && (
            <div style={{ background: '#16243a', border: '0.5px solid #1e3a5f' }} className="rounded-lg p-3 mt-4">
              <label style={{ color: '#5b9bf5' }} className="flex items-center gap-2 text-sm cursor-pointer mb-2">
                <input type="checkbox" checked={cadastrarConjuge} onChange={e => setCadastrarConjuge(e.target.checked)} />
                Cadastrar cônjuge para constar no contrato
              </label>
              {cadastrarConjuge && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div className="sm:col-span-2"><label className="label">Nome completo do cônjuge *</label>
                    <input className="input" required={cadastrarConjuge} value={conjuge.nome} onChange={setConj('nome')} placeholder="Nome completo" /></div>
                  <div><label className="label">CPF *</label>
                    <input className="input" required={cadastrarConjuge} value={conjuge.cpf} onChange={setConj('cpf')} placeholder="000.000.000-00" /></div>
                  <div><label className="label">RG *</label>
                    <input className="input" required={cadastrarConjuge} value={conjuge.rg} onChange={setConj('rg')} /></div>
                  <div className="sm:col-span-2"><label className="label">Profissão *</label>
                    <input className="input" required={cadastrarConjuge} value={conjuge.profissao} onChange={setConj('profissao')} /></div>
                </div>
              )}
              <p style={{ color: '#7daee8' }} className="text-[10px] mt-2">
                O cônjuge usará o mesmo endereço informado acima, evitando duplicidade de cadastro.
              </p>
            </div>
          )}

          {erro && <div style={{ background: '#2e1717', border: '0.5px solid #4a2424', color: '#ef4444' }} className="text-sm px-3 py-2 rounded-lg mt-3">{erro}</div>}
          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={salvando} className="btn btn-primary flex-1">
              {salvando ? 'Salvando...' : 'Cadastrar e selecionar'}
            </button>
            <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FormContrato({ inicial, imoveis, clientes, onSalvar, onCancelar, onClienteCriado, popupPdf, onGerarPdf, organizationId }: {
  inicial: Record<string,string>
  imoveis: SelectOpt[]
  clientes: SelectOpt[]
  onSalvar: (dados: Record<string,string>) => Promise<string | void>
  onCancelar: () => void
  onClienteCriado: () => Promise<void>
  popupPdf: 'processando' | 'sucesso' | null
  onGerarPdf: (contratoId: string) => void
  organizationId: string
}) {
  const [form, setForm] = useState(inicial)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  type CampoParte = 'locatario_id' | 'locador_id' | 'fiador_id' | 'locatarios_adicionais' | 'locadores_adicionais'
  const [modalCadastro, setModalCadastro] = useState<CampoParte | null>(null)
  const [modalImovel, setModalImovel] = useState(false)
  const [modalSelecionarCliente, setModalSelecionarCliente] = useState<CampoParte | null>(null)
  const [documentos, setDocumentos] = useState<Record<string, Documento | null>>({})
  const [uploadandoKit, setUploadandoKit] = useState<string | null>(null)
  const [loadingKit, setLoadingKit] = useState(true)
  const set = (c: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setForm(f=>({...f,[c]:e.target.value}))
  const [buscandoCepFiador, setBuscandoCepFiador] = useState(false)

  async function buscarCepFiador(cepDigitado: string) {
    const cepLimpo = cepDigitado.replace(/\D/g, '')
    if (cepLimpo.length !== 8) return
    setBuscandoCepFiador(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
      const dados = await res.json()
      if (!dados.erro) {
        setForm(f => ({
          ...f,
          fiador_imovel_endereco: dados.logradouro || f.fiador_imovel_endereco,
          fiador_imovel_bairro: dados.bairro || f.fiador_imovel_bairro,
          fiador_imovel_cidade: dados.localidade || f.fiador_imovel_cidade,
          fiador_imovel_estado: dados.uf || f.fiador_imovel_estado,
        }))
      }
    } catch {
      // sem internet ou API fora do ar — usuário preenche manualmente
    }
    setBuscandoCepFiador(false)
  }

  const caucaoVal = parseFloat(form.valor_caucao) || 0
  const parcelasNum = parseInt(form.parcelas_caucao) || 1
  const valorParcela = caucaoVal > 0 && parcelasNum > 1 ? caucaoVal / parcelasNum : caucaoVal

  const somaMensal =
    (parseFloat(form.valor_mensal) || 0) +
    (parseFloat(form.valor_condominio) || 0) +
    (parseFloat(form.valor_iptu) || 0) +
    (parseFloat(form.valor_seguro_incendio) || 0) +
    (form.tipo_garantia === 'seguro_fianca' ? (parseFloat(form.valor_seguro_fianca) || 0) : 0) +
    (parcelasNum > 1 ? valorParcela : 0)

  useEffect(() => { if (form.id) carregarKit() }, [form.id])

  async function carregarKit() {
    setLoadingKit(true)
    const { data: files } = await supabase.storage.from('documentos').list(`contratos/${form.id}/kit`)
    const mapa: Record<string, Documento | null> = {}
    // URL assinada (expira em 1h) em vez de link público — kit de contrato
    // tem documento pessoal/financeiro assinado.
    for (const cat of KIT_CATEGORIAS) {
      const arquivo = files?.find(f => f.name.startsWith(cat.chave))
      if (arquivo) {
        const caminho = `contratos/${form.id}/kit/${arquivo.name}`
        const { data: assinada } = await supabase.storage.from('documentos').createSignedUrl(caminho, 3600)
        mapa[cat.chave] = {
          nome: arquivo.name,
          url: assinada?.signedUrl || '',
          tipo: arquivo.name.split('.').pop() || '',
          created_at: arquivo.created_at || '',
        }
      } else {
        mapa[cat.chave] = null
      }
    }
    setDocumentos(mapa)
    setLoadingKit(false)
  }

  async function uploadKit(chave: string, file: File) {
    if (!organizationId) return
    setUploadandoKit(chave)
    const ext = file.name.split('.').pop()
    const path = `contratos/${form.id}/kit/${chave}.${ext}`
    const { error } = await supabase.storage.from('documentos').upload(path, file, { upsert: true })
    if (error) alert('Erro ao enviar: ' + error.message)
    await carregarKit()
    setUploadandoKit(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true); setErro('')
    try {
      const novoId = await onSalvar(form)
      if (novoId) setForm(f => ({ ...f, id: novoId }))
    } catch(err: any) { setErro(err.message) }
    setSalvando(false)
  }

  function idsExtras(campo: 'locatarios_adicionais' | 'locadores_adicionais'): string[] {
    return (form[campo] || '').split(',').filter(Boolean)
  }
  function adicionarExtra(campo: 'locatarios_adicionais' | 'locadores_adicionais', id: string) {
    const atuais = idsExtras(campo)
    if (atuais.includes(id) || id === form.locatario_id || id === form.locador_id) return
    setForm(f => ({ ...f, [campo]: [...atuais, id].join(',') }))
  }
  function removerExtra(campo: 'locatarios_adicionais' | 'locadores_adicionais', id: string) {
    setForm(f => ({ ...f, [campo]: idsExtras(campo).filter(x => x !== id).join(',') }))
  }

  async function aoCriarCliente(campo: CampoParte, cliente: { id: string; nome: string }) {
    await onClienteCriado()
    if (campo === 'locatarios_adicionais' || campo === 'locadores_adicionais') {
      adicionarExtra(campo, cliente.id)
    } else {
      setForm(f => ({ ...f, [campo]: cliente.id }))
    }
    setModalCadastro(null)
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ color: '#f4f4f3' }} className="text-sm font-semibold">{form.id ? `Contrato #${form.numero}` : 'Novo contrato'}</h2>
        <button onClick={onCancelar} className="btn btn-sm"><X size={13} /></button>
      </div>
      {erro && <div style={{ background: '#2e1717', border: '0.5px solid #4a2424', color: '#ef4444' }} className="px-3 py-2 rounded-lg mb-3 text-sm">{erro}</div>}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="label">Número *</label>
            <input className="input" required value={form.numero} onChange={set('numero')} placeholder="Ex: 001/2024" /></div>
          <div><label className="label">Tipo</label>
            <select className="input" value={form.tipo} onChange={set('tipo')}>
              <option value="locacao_residencial">Locação residencial</option>
              <option value="locacao_comercial">Locação comercial</option>
            </select></div>
          <div className="sm:col-span-2"><label className="label">Imóvel *</label>
            <button type="button" onClick={() => setModalImovel(true)}
              style={{ background: '#060D1C', border: '0.5px solid #1e3a5f', color: form.imovel_id ? '#f4f4f3' : '#5b5e6b' }}
              className="input w-full text-left flex items-center gap-2">
              {form.imovel_id ? (() => {
                const sel = imoveis.find(i => i.id === form.imovel_id)
                return <span className="truncate">{sel?.titulo}</span>
              })() : 'Selecionar imóvel'}
            </button>
            <p style={{ color: '#5b5e6b' }} className="text-[10px] mt-1">
              Selecionar o imóvel já preenche valor do aluguel e taxa de administração. Condomínio e IPTU ficam zerados — preencha manualmente se houver.
            </p>
          </div>

          <div>
            <label className="label">Locatário *</label>
            <button type="button" onClick={() => setModalSelecionarCliente('locatario_id')}
              style={{ background: '#060D1C', border: '0.5px solid #1e3a5f', color: form.locatario_id ? '#f4f4f3' : '#5b5e6b' }}
              className="input text-left">
              {form.locatario_id ? clientes.find(c => c.id === form.locatario_id)?.nome : 'Clique para selecionar ou cadastrar'}
            </button>
            {idsExtras('locatarios_adicionais').length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {idsExtras('locatarios_adicionais').map(id => (
                  <span key={id} style={{ background: '#16243a', border: '0.5px solid #1e3a5f', color: '#c3c2b7' }} className="text-xs px-2 py-1 rounded-lg flex items-center gap-1.5">
                    {clientes.find(c => c.id === id)?.nome || '—'}
                    <button type="button" onClick={() => removerExtra('locatarios_adicionais', id)} style={{ color: '#8b9ab4' }}><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}
            {form.locatario_id && (
              <button type="button" onClick={() => setModalSelecionarCliente('locatarios_adicionais')}
                style={{ color: '#5b9bf5' }} className="text-xs font-medium mt-1.5 hover:underline">
                <Plus size={11} className="inline" /> Adicionar outro locatário
              </button>
            )}
          </div>

          <div>
            <label className="label">Locador *</label>
            <button type="button" onClick={() => setModalSelecionarCliente('locador_id')}
              style={{ background: '#060D1C', border: '0.5px solid #1e3a5f', color: form.locador_id ? '#f4f4f3' : '#5b5e6b' }}
              className="input text-left">
              {form.locador_id ? clientes.find(c => c.id === form.locador_id)?.nome : 'Clique para selecionar ou cadastrar'}
            </button>
            {idsExtras('locadores_adicionais').length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {idsExtras('locadores_adicionais').map(id => (
                  <span key={id} style={{ background: '#16243a', border: '0.5px solid #1e3a5f', color: '#c3c2b7' }} className="text-xs px-2 py-1 rounded-lg flex items-center gap-1.5">
                    {clientes.find(c => c.id === id)?.nome || '—'}
                    <button type="button" onClick={() => removerExtra('locadores_adicionais', id)} style={{ color: '#8b9ab4' }}><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}
            {form.locador_id && (
              <button type="button" onClick={() => setModalSelecionarCliente('locadores_adicionais')}
                style={{ color: '#5b9bf5' }} className="text-xs font-medium mt-1.5 hover:underline">
                <Plus size={11} className="inline" /> Adicionar outro locador
              </button>
            )}
          </div>

          <div><label className="label">Aluguel (R$) *</label>
            <InputMoeda value={form.valor_mensal} onChange={v => setForm(f => ({
              ...f,
              valor_mensal: v,
              valor_caucao: (f.tipo_garantia === 'caucao' && (f.valor_caucao === '' || f.valor_caucao === '0'))
                ? String((parseFloat(v) || 0) * 3)
                : f.valor_caucao,
            }))} /></div>
          <div><label className="label">Taxa de administração (%)</label>
            <input className="input" type="number" step="0.1" value={form.taxa_administracao} onChange={set('taxa_administracao')} placeholder="10" />
            <p style={{ color: '#5b5e6b' }} className="text-[10px] mt-1">Vem do cadastro do imóvel, mas pode ajustar pra este contrato específico.</p>
          </div>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer" style={{ color: '#a8aab5' }}>
              <input
                type="checkbox"
                checked={!!form.honorarios_aplicavel}
                onChange={() => setForm(f => ({
                  ...f,
                  honorarios_aplicavel: f.honorarios_aplicavel ? '' : '1',
                  valor_honorarios: !f.honorarios_aplicavel && !f.valor_honorarios ? f.valor_mensal : f.valor_honorarios,
                }))}
                className="accent-blue-600"
              />
              <span className="text-sm font-medium">Cobrar honorários de locação neste contrato</span>
            </label>
            <p style={{ color: '#5b5e6b' }} className="text-[10px] mt-1 ml-6">
              Taxa cobrada uma única vez, junto com a 1ª cobrança do contrato (comum em locações novas).
            </p>
          </div>
          {form.honorarios_aplicavel && (
            <div className="sm:col-span-2">
              <label className="label">Valor dos honorários (R$)</label>
              <InputMoeda value={form.valor_honorarios} onChange={v => setForm(f => ({ ...f, valor_honorarios: v }))} />
            </div>
          )}

          <div className="sm:col-span-2">
            <label className="label">Garantia</label>
            <div className="flex gap-2 flex-wrap">
              {[
                ['caucao', 'Caução'],
                ['fiador', 'Fiador'],
                ['seguro_fianca', 'Seguro fiança'],
                ['titulo_capitalizacao', 'Título de capitalização'],
              ].map(([valor, label]) => {
                const marcado = form.tipo_garantia === valor
                return (
                  <label key={valor}
                    style={marcado
                      ? { background: '#2563eb22', border: '0.5px solid #2563eb', color: '#5b9bf5' }
                      : { border: '0.5px solid #2a2f3a', color: '#a8aab5' }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all">
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => setForm(f => ({
                        ...f,
                        tipo_garantia: marcado ? '' : valor,
                        valor_caucao: (!marcado && valor === 'caucao' && !f.valor_caucao && f.valor_mensal)
                          ? String((parseFloat(f.valor_mensal) || 0) * 3)
                          : f.valor_caucao,
                      }))}
                      className="accent-blue-600"
                    />
                    {label}
                  </label>
                )
              })}
            </div>
          </div>

          {form.tipo_garantia === 'fiador' && (
            <div className="sm:col-span-2">
              <label className="label">Fiador *</label>
              <button type="button" onClick={() => setModalSelecionarCliente('fiador_id')}
                style={{ background: '#060D1C', border: '0.5px solid #1e3a5f', color: form.fiador_id ? '#f4f4f3' : '#5b5e6b' }}
                className="input text-left">
                {form.fiador_id ? clientes.find(c => c.id === form.fiador_id)?.nome : 'Clique para selecionar ou cadastrar'}
              </button>
            </div>
          )}

          {form.tipo_garantia === 'fiador' && form.fiador_id && (
            <div className="sm:col-span-2 card" style={{ background: '#0d1117' }}>
              <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-3">Imóvel de garantia do fiador</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="label">CEP</label>
                  <input className="input" value={form.fiador_imovel_cep}
                    onChange={e => { const v = e.target.value; setForm(f => ({...f, fiador_imovel_cep: v})); buscarCepFiador(v) }}
                    placeholder="00000-000" />
                  {buscandoCepFiador && <p style={{ color: '#5b9bf5' }} className="text-[10px] mt-1">Buscando endereço...</p>}
                </div>
                <div><label className="label">Nº de matrícula do imóvel</label>
                  <input className="input" value={form.fiador_imovel_matricula} onChange={set('fiador_imovel_matricula')} /></div>
                <div className="sm:col-span-2"><label className="label">Logradouro</label>
                  <input className="input" value={form.fiador_imovel_endereco} onChange={set('fiador_imovel_endereco')} /></div>
                <div><label className="label">Número</label>
                  <input className="input" value={form.fiador_imovel_numero} onChange={set('fiador_imovel_numero')} /></div>
                <div><label className="label">Complemento</label>
                  <input className="input" value={form.fiador_imovel_complemento} onChange={set('fiador_imovel_complemento')} /></div>
                <div><label className="label">Bairro</label>
                  <input className="input" value={form.fiador_imovel_bairro} onChange={set('fiador_imovel_bairro')} /></div>
                <div><label className="label">Cidade</label>
                  <input className="input" value={form.fiador_imovel_cidade} onChange={set('fiador_imovel_cidade')} /></div>
                <div><label className="label">Estado (UF)</label>
                  <input className="input" maxLength={2} value={form.fiador_imovel_estado} onChange={set('fiador_imovel_estado')} /></div>
                <div><label className="label">IPTU (nº ou valor)</label>
                  <input className="input" value={form.fiador_imovel_iptu} onChange={set('fiador_imovel_iptu')} /></div>
              </div>
            </div>
          )}

          {form.tipo_garantia === 'caucao' && (
            <div className="sm:col-span-2">
              <label className="label">Caução (R$)</label>
              <InputMoeda value={form.valor_caucao} onChange={v => setForm(f => ({...f, valor_caucao: v}))} />
              <p style={{ color: '#5b5e6b' }} className="text-[10px] mt-1">Sugestão automática: 3x o valor do aluguel. Pode ajustar livremente.</p>

              {caucaoVal > 0 && (
                <div className="mt-3">
                  <label className="label">Parcelamento do caução</label>
                  <div className="flex gap-2 flex-wrap">
                    {[1,2,3,4,5].map(p => (
                      <button key={p} type="button"
                        onClick={() => setForm(f => ({...f, parcelas_caucao: String(p)}))}
                        style={parcelasNum === p ? { background: '#2563eb', color: '#fff', border: '0.5px solid #2563eb' } : { border: '0.5px solid #2a2f3a', color: '#a8aab5' }}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all">
                        {p === 1 ? 'À vista' : `${p}x`}
                      </button>
                    ))}
                  </div>
                  {parcelasNum > 1 && (
                    <div style={{ background: '#16243a', border: '0.5px solid #1e3a5f' }} className="mt-2 rounded-lg p-3">
                      <p style={{ color: '#5b9bf5' }} className="text-xs font-medium">
                        {parcelasNum}x de {formatVal(valorParcela)} — Total: {formatVal(caucaoVal)}
                      </p>
                      <p style={{ color: '#7daee8' }} className="text-[10px] mt-1">
                        As parcelas serão lançadas automaticamente no financeiro a partir da data de início do contrato.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {form.tipo_garantia === 'seguro_fianca' && (
            <div className="sm:col-span-2">
              <label className="label">Seguro fiança (R$) — valor mensal</label>
              <InputMoeda value={form.valor_seguro_fianca} onChange={v => setForm(f => ({...f, valor_seguro_fianca: v}))} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="label">Seguradora</label>
                  <input className="input" value={form.seguradora_fianca} onChange={set('seguradora_fianca')} placeholder="Ex: Porto Seguro" />
                </div>
                <div>
                  <label className="label">Nº da apólice</label>
                  <input className="input" value={form.apolice_fianca} onChange={set('apolice_fianca')} placeholder="Ex: 123456789" />
                </div>
              </div>
            </div>
          )}

          <div><label className="label">Condomínio (mensal) (R$)</label>
            <InputMoeda value={form.valor_condominio} onChange={v => setForm(f => ({...f, valor_condominio: v}))} /></div>
          <div><label className="label">IPTU (mensal) (R$)</label>
            <InputMoeda value={form.valor_iptu} onChange={v => setForm(f => ({...f, valor_iptu: v}))} /></div>
          <div><label className="label">Seguro incêndio (R$/mês)</label>
            <InputMoeda value={form.valor_seguro_incendio} onChange={v => setForm(f => ({...f, valor_seguro_incendio: v}))} /></div>
          <div><label className="label">Nº apólice — Seguro incêndio</label>
            <input className="input" value={form.apolice_incendio_numero} onChange={set('apolice_incendio_numero')} /></div>

          <div className="sm:col-span-2">
            <div style={{ background: '#16243a', border: '0.5px solid #1e3a5f' }} className="rounded-lg p-3">
              <p style={{ color: '#5b9bf5' }} className="text-xs font-medium">
                Total mensal do boleto: {formatVal(somaMensal)}
              </p>
              <p style={{ color: '#7daee8' }} className="text-[10px] mt-1">
                Aluguel + condomínio + IPTU + seguro incêndio{form.tipo_garantia === 'seguro_fianca' ? ' + seguro fiança' : ''}
                {parcelasNum > 1 ? ` + parcela da caução (${formatVal(valorParcela)}/mês, nos primeiros ${parcelasNum} meses)` : ''}.
                {' '}Serão geradas {form.data_inicio && form.data_fim ? mesesContrato(form.data_inicio, form.data_fim) : 0} cobranças ao criar o contrato.
              </p>
            </div>
          </div>

          <div><label className="label">Data início *</label>
            <input className="input" type="date" required value={form.data_inicio}
              min="2020-01-01"
              style={{ colorScheme: 'dark' }}
              onChange={e => {
                const novaData = e.target.value
                const mesInicio = novaData ? String(new Date(novaData + 'T00:00:00').getMonth() + 1) : form.mes_reajuste
                setForm(f => ({
                  ...f,
                  data_inicio: novaData,
                  data_fim: f.duracao_meses ? calcularDataFim(novaData, parseInt(f.duracao_meses)) || f.data_fim : f.data_fim,
                  mes_reajuste: novaData ? mesInicio : f.mes_reajuste,
                }))
              }} /></div>
          <div><label className="label">Duração (meses)</label>
            <input className="input" type="number" min="1" value={form.duracao_meses} placeholder="Ex: 30"
              onChange={e => {
                const meses = e.target.value
                setForm(f => ({
                  ...f,
                  duracao_meses: meses,
                  data_fim: f.data_inicio && meses ? calcularDataFim(f.data_inicio, parseInt(meses)) || f.data_fim : f.data_fim,
                }))
              }} /></div>
          <div><label className="label">Data fim *</label>
            <input className="input" type="date" required value={form.data_fim}
              min={form.data_inicio || undefined}
              style={{ colorScheme: 'dark' }}
              onChange={set('data_fim')} />
            <p style={{ color: '#5b5e6b' }} className="text-[10px] mt-1">
              {form.duracao_meses ? 'Calculada automaticamente — pode ajustar se precisar.' : 'Preencha a duração acima para calcular, ou informe manualmente.'}
            </p>
          </div>

          <div><label className="label">Índice de reajuste</label>
            <select className="input" value={form.indice_reajuste} onChange={set('indice_reajuste')}>
              <option value="igpm">IGP-M</option><option value="ipca">IPCA</option>
              <option value="inpc">INPC</option><option value="ivar">IVAR</option>
            </select></div>
          <div><label className="label">Mês do reajuste</label>
            <select className="input" value={form.mes_reajuste} onChange={set('mes_reajuste')}>
              {meses.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
            </select></div>
          <div><label className="label">Multa locatário (aluguéis)</label>
            <input className="input" type="number" step="0.5" value={form.multa_rescisao_locatario} onChange={set('multa_rescisao_locatario')} /></div>
          <div><label className="label">Multa locador (aluguéis)</label>
            <input className="input" type="number" step="0.5" value={form.multa_rescisao_locador} onChange={set('multa_rescisao_locador')} /></div>
          <div><label className="label">Aviso prévio (dias)</label>
            <input className="input" type="number" value={form.aviso_previo_dias} onChange={set('aviso_previo_dias')} /></div>
          <div><label className="label">Status</label>
            <select className="input" value={form.status} onChange={set('status')}>
              <option value="ativo">Ativo</option>
              <option value="pendente">Pendente</option>
              <option value="encerrado">Encerrado</option>
              <option value="rescindido">Rescindido</option>
            </select></div>
          <div className="sm:col-span-2"><label className="label">Observações</label>
            <textarea className="input" rows={2} value={form.observacoes} onChange={set('observacoes')} /></div>

          <div className="sm:col-span-2 mt-2" style={{ borderTop: '0.5px solid #1e3a5f', paddingTop: '1rem' }}>
            <p style={{ color: '#8b9ab4' }} className="text-xs font-medium mb-3">Dados para o contrato (PDF) — opcional</p>
          </div>

          <div><label className="label">Foro eleito</label>
            <input className="input" value={form.foro} onChange={set('foro')} /></div>

          {(parseFloat(form.valor_caucao) || 0) > 0 && (
            <div className="sm:col-span-2">
              <label className="label">Forma de recebimento da caução pelo locador</label>
              <div style={{ background: '#0d1117', border: '0.5px solid #2a2f3a' }} className="inline-flex rounded-lg p-0.5 mb-2">
                {[['pix', 'PIX'], ['transferencia', 'Transferência bancária']].map(([valor, label]) => (
                  <button key={valor} type="button" onClick={() => setForm(f => ({...f, forma_recebimento_caucao: valor}))}
                    style={form.forma_recebimento_caucao === valor
                      ? { background: '#1e3a5f', color: '#f4f4f3' }
                      : { background: 'transparent', color: '#8b9ab4' }}
                    className="px-4 py-1.5 rounded-md text-xs font-medium transition-all">
                    {label}
                  </button>
                ))}
              </div>
              {form.forma_recebimento_caucao === 'transferencia' ? (
                <div className="grid grid-cols-3 gap-2">
                  <input className="input" value={form.banco_recebimento_caucao} onChange={set('banco_recebimento_caucao')} placeholder="Banco" />
                  <input className="input" value={form.agencia_recebimento_caucao} onChange={set('agencia_recebimento_caucao')} placeholder="Agência" />
                  <input className="input" value={form.conta_recebimento_caucao} onChange={set('conta_recebimento_caucao')} placeholder="Conta" />
                </div>
              ) : (
                <input className="input" value={form.pix_recebimento_caucao} onChange={set('pix_recebimento_caucao')} placeholder="Chave PIX (em branco usa a do cadastro do locador)" />
              )}
            </div>
          )}
        </div>

        {form.id && (
          <div className="card mt-4" style={{ background: '#0d1117' }}>
            <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-1">Kit de documentos</h3>
            <p style={{ color: '#8b9ab4' }} className="text-xs mb-4">Documentos assinados, guardados pra consulta futura.</p>
            {loadingKit ? (
              <p style={{ color: '#8b9ab4' }} className="text-sm text-center py-4">Carregando...</p>
            ) : (
              <div className="space-y-1.5">
                {KIT_CATEGORIAS.filter(cat => !cat.somenteGarantia || cat.somenteGarantia === form.tipo_garantia).map(cat => {
                  const doc = documentos[cat.chave]
                  return (
                    <div key={cat.chave} style={{ background: '#16243a', border: '0.5px solid #1e3a5f' }} className="flex items-center justify-between px-3 py-2 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        {doc ? <CheckCircle2 size={13} style={{ color: '#3fb950' }} className="flex-shrink-0" /> : <Hourglass size={13} style={{ color: '#5b5e6b' }} className="flex-shrink-0" />}
                        <span style={{ color: '#f4f4f3' }} className="text-xs truncate">{cat.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {doc ? (
                          <a href={doc.url} target="_blank" rel="noopener noreferrer" download
                            style={{ background: '#f0fdf4', color: '#16a34a' }}
                            className="text-xs px-2.5 py-1 rounded-md flex items-center gap-1 font-medium">
                            <Download size={11} />Enviado
                          </a>
                        ) : (
                          <label
                            style={{ color: '#8b9ab4', border: '0.5px solid #2a2f3a' }}
                            className="text-xs px-2.5 py-1 rounded-md cursor-pointer flex items-center gap-1 font-medium">
                            <Upload size={10} />{uploadandoKit === cat.chave ? 'Enviando...' : 'Pendente'}
                            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                              onChange={e => { const f = e.target.files?.[0]; if (f) uploadKit(cat.chave, f); e.target.value = '' }} />
                          </label>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button type="submit" disabled={salvando} className="btn btn-primary">
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          {form.id && (
            <button type="button"
              style={{ background: '#22c55e', color: '#fff', border: 'none' }}
              className="btn font-medium"
              disabled={!!popupPdf} onClick={() => onGerarPdf(form.id)}>
              <FileDown size={13} />Emitir Contrato
            </button>
          )}
        </div>
      </form>

      {popupPdf && (
        <div style={{ background: 'rgba(0,0,0,0.6)' }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {popupPdf === 'processando' && (
            <div style={{ background: '#16243a', border: '0.5px solid #1e3a5f', color: '#5b9bf5' }}
              className="rounded-2xl px-10 py-8 shadow-2xl flex flex-col items-center gap-4">
              <Hourglass size={40} className="animate-spin" />
              <span className="text-lg font-semibold">Gerando contrato...</span>
            </div>
          )}
          {popupPdf === 'sucesso' && (
            <div style={{ background: '#1a2e1f', border: '0.5px solid #2d4a35', color: '#3fb950' }}
              className="rounded-2xl px-10 py-8 shadow-2xl flex flex-col items-center gap-4">
              <CheckCircle2 size={40} />
              <span className="text-lg font-semibold">Contrato gerado com sucesso</span>
            </div>
          )}
        </div>
      )}

      {modalCadastro && (
        <ModalClienteCompleto
          tipoParte={modalCadastro.startsWith('locatario') ? 'locatario' : modalCadastro.startsWith('locador') ? 'locador' : 'fiador'}
          onFechar={() => setModalCadastro(null)}
          onSalvar={(cliente) => aoCriarCliente(modalCadastro, cliente)}
          organizationId={organizationId}
        />
      )}

      {modalSelecionarCliente && (
        <ModalSelecionarCliente
          clientes={clientes}
          titulo={
            modalSelecionarCliente === 'locatario_id' || modalSelecionarCliente === 'locatarios_adicionais' ? 'locatário'
            : modalSelecionarCliente === 'locador_id' || modalSelecionarCliente === 'locadores_adicionais' ? 'locador'
            : 'fiador'
          }
          onFechar={() => setModalSelecionarCliente(null)}
          onSelecionar={(cliente) => {
            if (modalSelecionarCliente === 'locatarios_adicionais' || modalSelecionarCliente === 'locadores_adicionais') {
              adicionarExtra(modalSelecionarCliente, cliente.id)
            } else {
              setForm(f => ({ ...f, [modalSelecionarCliente]: cliente.id }))
            }
          }}
          onAdicionarNovo={() => {
            const campo = modalSelecionarCliente
            setModalSelecionarCliente(null)
            setModalCadastro(campo)
          }}
        />
      )}

      {modalImovel && (
        <ModalSelecionarImovel
          imoveis={imoveis}
          onFechar={() => setModalImovel(false)}
          onSelecionar={(imovel) => {
            setForm(f => ({
              ...f,
              imovel_id: imovel.id,
              valor_mensal: imovel.valor_aluguel != null ? String(imovel.valor_aluguel) : f.valor_mensal,
              taxa_administracao: imovel.taxa_administracao != null ? String(imovel.taxa_administracao) : f.taxa_administracao,
              tipo: tipoContratoDoImovel(imovel.categoria, imovel.finalidade) || f.tipo,
            }))
          }}
        />
      )}
    </div>
  )
}

function clienteParaParte(cli: any): Parte {
  return {
    nome: cli?.nome || '',
    cpf: cli?.cpf || '',
    rg: cli?.rg || '',
    profissao: cli?.profissao || '',
    estado_civil: cli?.estado_civil || 'solteiro',
    endereco: [cli?.endereco, cli?.numero, cli?.bairro, cli?.cidade].filter(Boolean).join(', '),
    nacionalidade: cli?.nacionalidade || 'brasileiro(a)',
  }
}

function descricaoImovelAuto(im: any): string {
  if (!im) return ''
  const tiposLabel: Record<string, string> = {
    apartamento: 'apartamento', casa: 'casa', sala_comercial: 'sala comercial', salao_comercial: 'salão comercial',
    loja: 'loja', galpao: 'galpão', terreno: 'terreno', rural: 'imóvel rural',
  }
  let desc = `${tiposLabel[im.tipo] || 'imóvel'} situado à ${im.endereco || ''}, ${im.numero || ''}${im.complemento ? `, ${im.complemento}` : ''}, ${im.bairro || ''}, CEP ${im.cep || ''}, ${im.cidade || ''}/${im.estado || ''}`
  if (im.descricao) desc += `. ${im.descricao}`
  return desc
}

/** Retorna a lista de campos essenciais que faltam no cadastro de uma parte, para o aviso antes de gerar o PDF. */
function camposFaltantes(cli: any, label: string): string[] {
  if (!cli) return [`cadastro do ${label}`]
  const faltando: string[] = []
  if (!cli.cpf) faltando.push(`CPF do ${label}`)
  if (!cli.rg) faltando.push(`RG do ${label}`)
  if (!cli.endereco) faltando.push(`endereço do ${label}`)
  return faltando
}

/**
 * Busca os dados completos do contrato (imóvel, locatário, locador, fiador) direto do banco
 * e monta o PDF do contrato — sem nenhuma tela intermediária de qualificação, usando sempre
 * o que já está cadastrado. Chamada direto pelo botão "Gerar Contrato" da lista.
 */
async function gerarContratoPdf(contratoId: string, organizationId: string, onEstado: (e: 'processando' | 'sucesso' | null) => void) {
  const { data: c } = await supabase
    .from('contratos')
    .select('*, imovel:imoveis(*), locatario:clientes!contratos_locatario_id_fkey(*), locador:clientes!contratos_locador_id_fkey(*), fiador:clientes!contratos_fiador_id_fkey(*)')
    .eq('id', contratoId).eq('organization_id', organizationId).single()

  if (!c) { alert('Não foi possível carregar os dados do contrato.'); return }

  const { data: org } = await supabase.from('organizations').select('*').eq('id', organizationId).single()
  if (!org) { alert('Não foi possível carregar os dados da imobiliária.'); return }

  let locatariosExtras: any[] = []
  let locadoresExtras: any[] = []
  if (c.locatarios_adicionais?.length) {
    const { data } = await supabase.from('clientes').select('*').eq('organization_id', organizationId).in('id', c.locatarios_adicionais)
    locatariosExtras = data || []
  }
  if (c.locadores_adicionais?.length) {
    const { data } = await supabase.from('clientes').select('*').eq('organization_id', organizationId).in('id', c.locadores_adicionais)
    locadoresExtras = data || []
  }

  const locadores: Parte[] = [clienteParaParte(c.locador), ...locadoresExtras.map(clienteParaParte)]
  const locatarios: Parte[] = [clienteParaParte(c.locatario), ...locatariosExtras.map(clienteParaParte)]
  const fiadores: Parte[] = c.tipo_garantia === 'fiador' && c.fiador ? [clienteParaParte(c.fiador)] : []
  const descricaoImovel = descricaoImovelAuto(c.imovel)
  const foro = c.foro || 'Santana, São Paulo, SP'
  const numApoliceIncendio = c.apolice_incendio_numero || ''
  const valorSeguroIncendioMensal = c.valor_seguro_incendio != null ? String(c.valor_seguro_incendio) : ''
  const numApoliceSeguroFianca = c.apolice_fianca || ''
  const formaRecebimento = c.forma_recebimento_caucao || 'pix'
  const pixLocador = c.pix_recebimento_caucao || c.locador?.chave_pix || ''
  const bancoLocador = c.banco_recebimento_caucao || ''
  const agenciaLocador = c.agencia_recebimento_caucao || ''
  const contaLocador = c.conta_recebimento_caucao || ''
  const form = c // reaproveita os nomes de campo do contrato (numero, data_inicio, valor_mensal etc.)

  const tituloTipo: Record<string, string> = {
    locacao_residencial: 'LOCAÇÃO RESIDENCIAL',
    locacao_comercial: 'LOCAÇÃO COMERCIAL',
    compra_venda: 'COMPRA E VENDA',
  }
  const tituloContrato = tituloTipo[form.tipo] || 'LOCAÇÃO'

  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const W = 210
  const ML = 20
  const MR = W - 20
  const CW = MR - ML
  let y = 20
  let pagNum = 1

  function addRodape() {
    doc.setFontSize(7).setTextColor(130)
    doc.text(`${org.nome} — CNPJ: ${org.cnpj || ''} — CRECI: ${org.creci || ''}`, W / 2, 288, { align: 'center' })
    doc.text(`Página ${pagNum}`, MR, 288, { align: 'right' })
    doc.setTextColor(0)
  }
  function novaPag() { addRodape(); doc.addPage(); pagNum++; y = 20 }
  function checkY(n: number) { if (y + n > 275) novaPag() }
  function titulo(texto: string) {
    checkY(12)
    doc.setFontSize(9).setFont('helvetica', 'bold')
    doc.setFillColor(240, 240, 240)
    doc.rect(ML, y - 3, CW, 7, 'F')
    doc.text(texto, W / 2, y + 1, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    y += 9
  }
  function clausula(num: string, texto: string) {
    const numLinhas = doc.splitTextToSize(texto, CW).length
    checkY(numLinhas * 5 + 8)
    doc.setFontSize(9).setFont('helvetica', 'bold')
    doc.text(`CLÁUSULA ${num} –`, ML, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.text(texto, ML, y, { maxWidth: CW, align: 'justify' })
    y += numLinhas * 5
    y += 2
  }
  function paragrafo(texto: string, negrito = false) {
    const numLinhas = doc.splitTextToSize(texto, CW).length
    checkY(numLinhas * 5 + 3)
    doc.setFontSize(9).setFont('helvetica', negrito ? 'bold' : 'normal')
    doc.text(texto, ML, y, { maxWidth: CW, align: negrito ? 'left' : 'justify' })
    y += numLinhas * 5
    y += 1
    doc.setFont('helvetica', 'normal')
  }
  function paragrafoRotulo(texto: string) {
    const match = texto.match(/^(PARÁGRAFO[^:-]*[:-])\s*([\s\S]*)$/)
    if (!match) { paragrafo(texto, false); return }
    const [, rotulo, resto] = match
    doc.setFontSize(9).setFont('helvetica', 'bold')
    const rotuloLinhas = doc.splitTextToSize(rotulo, CW)
    const larguraRotulo = doc.getTextWidth(rotuloLinhas[0])
    doc.setFont('helvetica', 'normal')
    const restoNaMesmaLinha = doc.splitTextToSize(resto, CW - larguraRotulo - 2)[0] || ''
    const restoRestante = resto.slice(restoNaMesmaLinha.length).trim()
    const numLinhasRestante = restoRestante ? doc.splitTextToSize(restoRestante, CW).length : 0
    checkY(5 + numLinhasRestante * 5 + 3)
    doc.setFont('helvetica', 'bold')
    doc.text(rotulo, ML, y)
    doc.setFont('helvetica', 'normal')
    doc.text(restoNaMesmaLinha, ML + larguraRotulo + 1.5, y)
    y += 5
    if (restoRestante) {
      doc.text(restoRestante, ML, y, { maxWidth: CW, align: 'justify' })
      y += numLinhasRestante * 5
    }
    y += 1
  }

  if (org.logo_url) {
    try {
      const ext = org.logo_url.split('.').pop()?.toLowerCase().split('?')[0]
      const formato = ext === 'png' ? 'PNG' : ext === 'webp' ? 'WEBP' : 'JPEG'
      const logoW = 30, logoH = 16
      doc.addImage(org.logo_url, formato, (W - logoW) / 2, y, logoW, logoH)
      y += logoH + 9
    } catch {}
  }
  doc.setFontSize(16).setFont('helvetica', 'bold')
  doc.text(`CONTRATO DE ${tituloContrato}`, W / 2, y, { align: 'center' })
  y += 10
  doc.setDrawColor(0).line(ML, y, MR, y); y += 6

  titulo('DO LOCADOR')
  locadores.forEach(l => {
    paragrafo(`${l.nome.toUpperCase()}, ${l.nacionalidade}, ${ESTADO_CIVIL_LABEL[l.estado_civil] || l.estado_civil}, ${l.profissao}, portador(a) da Cédula de identidade RG nº ${l.rg} e inscrito(a) no CPF/MF sob nº ${l.cpf}, residente e domiciliado(a) à ${l.endereco}, doravante denominado(a) LOCADOR(A).`)
  })
  y += 2

  titulo('DO LOCATÁRIO')
  locatarios.forEach(l => {
    paragrafo(`${l.nome.toUpperCase()}, ${l.nacionalidade}, ${ESTADO_CIVIL_LABEL[l.estado_civil] || l.estado_civil}, ${l.profissao}, portador(a) da Cédula de identidade RG nº ${l.rg} e inscrito(a) no CPF sob nº ${l.cpf}, residente e domiciliado(a) à ${l.endereco}, doravante denominado(a) LOCATÁRIO(A).`)
  })
  y += 2

  paragrafo('Têm entre si contratado, pelo presente instrumento e na melhor forma de direito, a locação do imóvel abaixo referido, sob as cláusulas e condições seguintes:')
  y += 2

  titulo('IMÓVEL OBJETO DA LOCAÇÃO')
  paragrafo(`O imóvel objeto do presente instrumento: ${descricaoImovel}.`)
  paragrafo('Ficam os LOCATÁRIO(A) cientificados de que deverão proceder à ligação e transferência junto à SABESP (água) e ENEL (Luz) imediatamente, após assinatura deste instrumento e antes de ter posse das chaves do imóvel, sob pena de ter o fornecimento do serviço interrompido.')
  paragrafo('A NÃO TRANSFERÊNCIA SERÁ CONSIDERADA INFRAÇÃO CONTRATUAL.', true)
  y += 2

  const mesesQtd = mesesEntre(form.data_inicio, form.data_fim)
  titulo('DOS PRAZOS')
  clausula('1ª', `A presente locação é pelo prazo de ${mesesQtd} meses, a contar do dia ${dataExtenso(form.data_inicio)} e término em ${dataExtenso(form.data_fim)}.`)
  clausula('2ª', `Vencido o prazo mencionado na CLÁUSULA 1ª e, pretendendo os LOCATÁRIOS entregarem as chaves do imóvel, deverão dar ciência à LOCADORA, POR ESCRITO, e com antecedência mínima de 30 (Trinta) dias de sua deliberação, ficando de qualquer modo, obrigados ao pagamento do aluguel e encargos até a efetiva rescisão do contrato.`)
  const dataInicioObj = new Date(form.data_inicio + 'T00:00:00')
  const diaInicioMes = dataInicioObj.getDate()
  clausula('3ª', `A locação não iniciada no ${diaInicioMes}º (${diaOrdinalExtenso(diaInicioMes)}) dia do mês terá o acerto dos dias decorridos até o final do mesmo, se houver.`)

  titulo('DO ALUGUEL')
  const valorMensal = parseFloat(form.valor_mensal) || 0
  const diaVencimento = new Date(form.data_inicio + 'T00:00:00').getDate()
  let textoAluguel = `O aluguel mensal inicial é de ${formatVal(valorMensal)} (${valorExtenso(valorMensal)}), ficando ainda a cargo dos LOCATÁRIOS os demais encargos da locação`
  if (form.valor_condominio) textoAluguel += `, o condomínio no valor de ${formatVal(parseFloat(form.valor_condominio))} (${valorExtenso(parseFloat(form.valor_condominio))})`
  if (form.valor_iptu) textoAluguel += `, IPTU no valor de ${formatVal(parseFloat(form.valor_iptu))}`
  textoAluguel += `, devendo ser pagos até o dia ${diaVencimento} (${diaExtenso(diaVencimento)}) do mês subsequente ao vencido, diretamente à ${org.nome}, na qualidade de ADMINISTRADORA, CNPJ: ${org.cnpj || ''}, CRECI ${org.creci || ''}, estabelecida à ${org.endereco || ''}, ${org.numero || ''} – ${org.bairro || ''} – ${org.cidade || ''}, através de boleto bancário, que posteriormente será repassado ao LOCADOR.`
  clausula('4ª', textoAluguel)
  paragrafoRotulo(`PARÁGRAFO PRIMEIRO: O aluguel será reajustado anualmente na exata proporção da variação acumulada do Índice ${form.indice_reajuste?.toUpperCase() || 'IGP-M'}.`)
  paragrafoRotulo(`PARÁGRAFO SEGUNDO: Esse mesmo critério de reajuste será sempre observado, independentemente de aviso ou interpelação, a cada período de 12 (doze) meses até quando finda ou rescinda a locação.`)
  paragrafoRotulo(`PARÁGRAFO TERCEIRO: Em caso de variação negativa do índice adotado, o valor do aluguel será mantido, não sendo aplicado qualquer decréscimo.`)
  clausula('5ª', `Os aluguéis que não forem pagos na data do vencimento terão acréscimo de 10% (DEZ POR CENTO) DE MULTA e, mais 2% (DOIS POR CENTO) AO MÊS DE JUROS DE MORA e ficarão sujeitos a correção monetária, com base na variação do IPCA do IBGE.`)
  clausula('6ª', `Os aluguéis em atraso por mais de 30 (trinta) dias serão encaminhados ao Departamento Jurídico, ficando os LOCATÁRIOS sujeitos a todas as penalidades legais e contratuais, bem como à obrigação de ressarcir integralmente o LOCADOR por quaisquer despesas judiciais ou extrajudiciais.`)

  titulo('DA GARANTIA')
  const caucaoValPdf = parseFloat(form.valor_caucao) || 0
  const parcelasNumPdf = parseInt(form.parcelas_caucao) || 1
  if (form.tipo_garantia === 'fiador') {
    const f = fiadores[0]
    const enderecoImovelGarantia = [form.fiador_imovel_endereco, form.fiador_imovel_numero, form.fiador_imovel_complemento, form.fiador_imovel_bairro, form.fiador_imovel_cidade, form.fiador_imovel_estado].filter(Boolean).join(', ')
    const textoImovelGarantia = enderecoImovelGarantia
      ? ` Em garantia desta fiança, o(a) FIADOR(A) oferece o imóvel situado à ${enderecoImovelGarantia}${form.fiador_imovel_cep ? `, CEP ${form.fiador_imovel_cep}` : ''}${form.fiador_imovel_matricula ? `, matrícula nº ${form.fiador_imovel_matricula}` : ''}${form.fiador_imovel_iptu ? `, IPTU nº ${form.fiador_imovel_iptu}` : ''}.`
      : ''
    if (f?.nome) {
      const fiadoresTexto = fiadores.filter(fi => fi.nome)
        .map(fi => `${fi.nome.toUpperCase()}, ${fi.nacionalidade}, ${ESTADO_CIVIL_LABEL[fi.estado_civil] || fi.estado_civil}, ${fi.profissao}, portador(a) do RG nº ${fi.rg} e inscrito(a) no CPF sob nº ${fi.cpf}, residente à ${fi.endereco}`)
        .join('; e ')
      clausula('7ª', `O presente contrato será garantido por fiança, prestada por ${fiadoresTexto}, doravante denominado(a) ${fiadores.length > 1 ? 'FIADORES' : 'FIADOR(A)'}, que se responsabiliza(m) solidária e integralmente por todas as obrigações assumidas pelos LOCATÁRIOS neste contrato, inclusive aluguéis, encargos, multas e demais despesas, até a efetiva entrega das chaves.${textoImovelGarantia}`)
    } else {
      clausula('7ª', `O presente contrato será garantido por fiança, cujo(s) fiador(es) responsabiliza(m)-se solidária e integralmente por todas as obrigações assumidas pelos LOCATÁRIOS neste contrato, conforme qualificação a ser anexada a este instrumento.${textoImovelGarantia}`)
    }
  } else if (form.tipo_garantia === 'titulo_capitalizacao') {
    clausula('7ª', `O presente contrato será garantido por título de capitalização, vinculado em favor do LOCADOR pelo valor correspondente a, no mínimo, ${caucaoValPdf > 0 ? formatVal(caucaoValPdf) : '3 (três) aluguéis'}, permanecendo caução até a efetiva entrega das chaves e quitação de todas as obrigações do presente contrato.`)
  } else if (form.tipo_garantia === 'seguro_fianca' && numApoliceSeguroFianca) {
    clausula('7ª', `O presente contrato será garantido por seguro fiança, Apólice nº ${numApoliceSeguroFianca}, no valor de ${form.valor_seguro_fianca ? formatVal(parseFloat(form.valor_seguro_fianca)) : 'conforme apólice'}.`)
  } else if (form.tipo_garantia === 'caucao' || !form.tipo_garantia) {
    if (caucaoValPdf > 0) {
      let textoCaucao = `Fica acordado que o presente contrato será garantido por meio de caução no valor de ${formatVal(caucaoValPdf)} (${valorExtenso(caucaoValPdf)})`
      if (parcelasNumPdf > 1) {
        const parcVal = caucaoValPdf / parcelasNumPdf
        textoCaucao += `, a ser pago em ${parcelasNumPdf} (${parcelasNumPdf === 2 ? 'duas' : parcelasNumPdf === 3 ? 'três' : parcelasNumPdf === 4 ? 'quatro' : 'cinco'}) parcelas de ${formatVal(parcVal)}`
        const datas = []
        for (let i = 0; i < parcelasNumPdf; i++) {
          const d = new Date(form.data_inicio + 'T00:00:00')
          d.setMonth(d.getMonth() + i)
          datas.push(d.toLocaleDateString('pt-BR'))
        }
        textoCaucao += `, com vencimentos em: ${datas.join(', ')}`
      } else {
        textoCaucao += `, a ser pago à vista`
      }
      if (formaRecebimento === 'pix' && pixLocador) {
        textoCaucao += `, através de transferência via PIX: ${pixLocador} em nome de ${locadores[0]?.nome || 'LOCADOR'}`
      } else if (formaRecebimento === 'transferencia' && (bancoLocador || contaLocador)) {
        textoCaucao += `, através de transferência bancária para: Banco ${bancoLocador || '____'}, Agência ${agenciaLocador || '____'}, Conta ${contaLocador || '____'}, em nome de ${locadores[0]?.nome || 'LOCADOR'}`
      }
      textoCaucao += `.`
      clausula('7ª', textoCaucao)
    }
  }

  titulo('DAS OBRIGAÇÕES DOS LOCATÁRIOS')
  clausula('8ª', `Os LOCATÁRIOS obrigam-se pela mais perfeita conservação do imóvel locado, mantendo-o sempre em perfeitas condições de habitabilidade, respondendo por todos os prejuízos provenientes de qualquer estrago ou má conservação.`)
  clausula('9ª', `Os LOCATÁRIOS ficam obrigados a servir-se do imóvel para o uso convencionado, qual seja sua residência e de sua família, não podendo cedê-lo ou sublocá-lo no todo ou em parte, nem transferir o presente contrato sem autorização expressa e por escrito do LOCADOR.`)
  clausula('10ª', `Os LOCATÁRIOS ficam obrigados a comunicar por escrito à ADMINISTRADORA, o surgimento de qualquer dano ou defeito que a este incumba à reparação.`)
  clausula('11ª', `Caberá aos LOCATÁRIOS o cumprimento, dentro dos prazos legais, de quaisquer multas ou intimações por infrações das leis, portarias ou regulamentos vigentes.`)

  titulo('DA UTILIZAÇÃO DO IMÓVEL')
  clausula('12ª', `A presente locação destina-se restritivamente ao uso do imóvel para fins ${form.tipo === 'locacao_comercial' ? 'comerciais' : 'residenciais'}, não podendo os LOCATÁRIOS transferir, sublocar, ceder ou emprestar ou usá-lo de forma diferente do previsto, salvo autorização expressa do LOCADOR.`)
  paragrafoRotulo(`PARÁGRAFO PRIMEIRO – Vistorias. Faculta ao LOCADOR a realização de vistorias esporádicas no imóvel, em dia e hora a serem combinados, a fim de averiguar o estado de conservação do imóvel.`)
  paragrafoRotulo(`PARÁGRAFO SEGUNDO – Devolução. Finda ou rescindida a locação, os LOCATÁRIOS obrigam-se a devolverem o imóvel nas mesmas condições em que recebeu.`)

  titulo('DO CONSERTO, REPARO E MANUTENÇÃO')
  clausula('13ª', `Os LOCATÁRIOS precisam comunicar previamente à ADMINISTRADORA, todo e qualquer conserto, reparo ou manutenção que o imóvel locado venha necessitar internamente.`)

  titulo('DAS BENFEITORIAS')
  clausula('14ª', `As benfeitorias necessárias e úteis serão indenizáveis, desde que autorizadas pelo LOCADOR, por escrito, e avisadas com antecedência.`)
  clausula('15ª', `Se qualquer benfeitoria ou modificação for feita sem o consentimento prévio e por escrito do LOCADOR, este poderá exigir que tudo seja reposto no seu estado primitivo.`)

  titulo('DO DIREITO DE PREFERÊNCIA')
  clausula('16ª', `O LOCADOR, em qualquer tempo, poderá alienar o imóvel, mesmo durante a vigência do contrato de locação, devendo notificar os LOCATÁRIOS para que possam exercer seu direito de preferência na aquisição do imóvel, no prazo de 30 dias.`)

  titulo('DA RESCISÃO DA LOCAÇÃO')
  clausula('17ª', `Finda a locação, caberá aos LOCATÁRIOS entregar o imóvel locado em perfeitas condições de habitabilidade.`)
  clausula('18ª', `A presente locação poderá ser rescindida, se assim convier ao LOCADOR, no caso de infração por parte dos LOCATÁRIOS de qualquer das cláusulas contratuais.`)
  clausula('19ª', `Caso ocorra a devolução do imóvel antes do prazo de ${mesesQtd} meses, seja pela entrega voluntária ou por decisão judicial, facultará ao LOCADOR cobrar dos LOCATÁRIOS o pagamento de multa compensatória, proporcionalmente ao tempo de contrato não cumprido.`)
  clausula('20ª', `Durante o prazo estipulado para a duração do contrato, não poderá o LOCADOR reaver o imóvel alugado, salvo se por mútuo acordo (Conforme art. 9º da Lei 8.245/91).`)

  titulo('DA RESTITUIÇÃO DAS CHAVES')
  clausula('21ª', `A restituição das chaves ao LOCADOR ou seus procuradores, só poderá ser feita pelos LOCATÁRIOS estando o imóvel nas condições em que foi locado.`)
  clausula('22ª', `Para entrega do imóvel, ficarão os LOCATÁRIOS obrigados a acompanhar o laudo de vistoria rescisório e apresentar todos os recibos de condomínio e IPTU devidamente quitados.`)

  titulo('DO SEGURO')
  let textoSeguro = `Os LOCATÁRIOS farão um seguro do imóvel contra incêndio em companhia de sua livre escolha, durante todo o prazo da locação, correndo por conta dos LOCATÁRIOS todas as despesas decorrentes`
  if (numApoliceIncendio) textoSeguro += `. Apólice nº ${numApoliceIncendio}${valorSeguroIncendioMensal ? ', valor mensal: ' + formatVal(parseFloat(valorSeguroIncendioMensal)) : ''}`
  clausula('27ª', textoSeguro + '.')

  titulo('DAS DISPOSIÇÕES FINAIS')
  clausula('28ª', `As partes contratantes obrigam-se por si, seus herdeiros e sucessores ao fiel cumprimento de todas as cláusulas e condições ora pactuadas.`)
  clausula('29ª', `É expressamente vedado qualquer depósito em conta do LOCADOR sem prévia autorização da ADMINISTRADORA.`)
  clausula('30ª', `Os LOCATÁRIOS declaram estar cientes de que serão integralmente responsáveis pelo pagamento de quaisquer multas ou penalidades decorrentes de sua conduta durante a vigência da locação.`)
  clausula('31ª', `Não será facultativa a nenhuma das partes o direito de arrependimento, devendo ambas as partes cumprir fielmente o disposto nas cláusulas aqui avençadas.`)
  paragrafoRotulo(`PARÁGRAFO ÚNICO – FORO. Elegem a Comarca de ${foro} como foro para dirimir quaisquer questões, desistindo de qualquer outro, por mais privilegiado que seja.`)

  checkY(80)
  y += 5
  doc.setDrawColor(200).line(ML, y, MR, y); y += 8
  doc.setFontSize(9)
  doc.text(`${org.cidade || 'São Paulo'}, ${dataExtenso(new Date().toISOString().split('T')[0])}`, MR, y, { align: 'right' })
  y += 14

  const colW = (MR - ML - 5) / 2
  const assinaturas = [
    ...locadores.map((l, i) => ({ label: i === 0 ? 'LOCADOR(A)' : `LOCADOR(A) ${i + 1}`, nome: l.nome })),
    ...locatarios.map((l, i) => ({ label: i === 0 ? 'LOCATÁRIO(A)' : `LOCATÁRIO(A) ${i + 1}`, nome: l.nome })),
    { label: 'ADMINISTRADORA', nome: org.nome },
    { label: 'TESTEMUNHA 1', nome: '' },
    { label: 'TESTEMUNHA 2', nome: '' },
  ]
  for (let i = 0; i < assinaturas.length; i += 2) {
    checkY(22)
    const a1 = assinaturas[i]; const a2 = assinaturas[i + 1]
    doc.setDrawColor(0).line(ML, y, ML + colW, y)
    if (a2) doc.line(ML + colW + 5, y, MR, y)
    y += 4
    doc.setFontSize(8)
    doc.text(a1.label, ML, y)
    doc.setFontSize(7).setTextColor(100)
    doc.text(a1.nome, ML, y + 4)
    if (a2) {
      doc.setFontSize(8).setTextColor(0)
      doc.text(a2.label, ML + colW + 5, y)
      doc.setFontSize(7).setTextColor(100)
      doc.text(a2.nome, ML + colW + 5, y + 4)
    }
    doc.setTextColor(0)
    y += 18
  }
  addRodape()

  onEstado('processando')
  await new Promise(resolve => setTimeout(resolve, 5000))
  onEstado('sucesso')
  await new Promise(resolve => setTimeout(resolve, 2000))

  window.open(doc.output('bloburl') as unknown as string, '_blank')
  onEstado(null)
}

/**
 * Confirma se faltam dados essenciais (CPF/RG/endereço) no cadastro do locador, locatário
 * ou fiador antes de gerar o PDF; se faltar algo, mostra um aviso e deixa o usuário decidir
 * se quer gerar mesmo assim.
 */
async function confirmarEGerarPdf(contratoId: string, organizationId: string, onEstado: (e: 'processando' | 'sucesso' | null) => void) {
  const { data: c } = await supabase
    .from('contratos')
    .select('tipo_garantia, locatario:clientes!contratos_locatario_id_fkey(*), locador:clientes!contratos_locador_id_fkey(*), fiador:clientes!contratos_fiador_id_fkey(*)')
    .eq('id', contratoId).eq('organization_id', organizationId).single()

  if (!c) { alert('Não foi possível carregar os dados do contrato.'); return }

  let faltando = [
    ...camposFaltantes(c.locador, 'locador'),
    ...camposFaltantes(c.locatario, 'locatário'),
  ]
  if (c.tipo_garantia === 'fiador') faltando = [...faltando, ...camposFaltantes(c.fiador, 'fiador')]

  if (faltando.length > 0) {
    const ok = confirm(`Faltam alguns dados no cadastro:\n\n${faltando.map(f => `• ${f}`).join('\n')}\n\nEsses trechos ficarão em branco no PDF. Deseja gerar mesmo assim?`)
    if (!ok) return
  }

  await gerarContratoPdf(contratoId, organizationId, onEstado)
}

/**
 * Tela de consulta (somente leitura) de um contrato: mostra os dados, o kit de documentos
 * assinados pra upload/consulta, e só libera edição ao clicar em "Editar" no rodapé.
 */
export default function ContratosPage() {
  const { organizacao } = useOrganization()
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [imoveis, setImoveis] = useState<SelectOpt[]>([])
  const [clientes, setClientes] = useState<SelectOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [formInicial, setFormInicial] = useState<Record<string,string>|null>(null)
  const [popupPdf, setPopupPdf] = useState<'processando' | 'sucesso' | null>(null)
  const [sucesso, setSucesso] = useState('')
  const [erroExclusao, setErroExclusao] = useState('')

  useEffect(() => {
    if (organizacao?.id) buscarTudo(organizacao.id)
  }, [organizacao?.id])

  async function buscarTudo(orgId: string) {
    setLoading(true)
    const [cont, imov, cli] = await Promise.all([
      supabase.from('contratos').select(`*, imovel:imoveis(titulo), locatario:clientes!contratos_locatario_id_fkey(nome), locador:clientes!contratos_locador_id_fkey(nome)`).eq('organization_id', orgId).order('numero'),
      supabase.from('imoveis').select('id, codigo, titulo, tipo, categoria, finalidade, endereco, bairro, valor_aluguel, valor_condominio, valor_iptu, taxa_administracao').eq('organization_id', orgId).order('titulo'),
      supabase.from('clientes').select('id, nome, cpf, rg, profissao, estado_civil, telefone, endereco, bairro, cidade, estado, chave_pix, tipo').eq('organization_id', orgId).order('nome'),
    ])
    if (cont.data) setContratos(cont.data)
    if (imov.data) setImoveis(imov.data)
    if (cli.data) setClientes(cli.data)
    setLoading(false)
  }

  async function recarregarClientes() {
    if (!organizacao?.id) return
    const { data } = await supabase.from('clientes').select('id, nome, cpf, rg, profissao, estado_civil, telefone, endereco, bairro, cidade, estado, chave_pix, tipo').eq('organization_id', organizacao.id).order('nome')
    if (data) setClientes(data)
  }

  function abrirNovo() {
    if (!organizacao?.id) return
    const anoAtual = new Date().getFullYear()
    const numerosDoAno = contratos
      .map(c => c.numero)
      .filter(n => n && n.endsWith(`/${anoAtual}`))
      .map(n => parseInt(n.split('/')[0], 10))
      .filter(n => !isNaN(n))
    const proximo = numerosDoAno.length > 0 ? Math.max(...numerosDoAno) + 1 : 1
    const numeroGerado = `${String(proximo).padStart(3, '0')}/${anoAtual}`
    setFormInicial({ ...formVazio, numero: numeroGerado })
  }

  function dadosFormDoContrato(c: Contrato): Record<string,string> {
    return {
      id: c.id, numero: c.numero||'', tipo: c.tipo||'locacao_residencial',
      imovel_id: c.imovel_id||'', locatario_id: c.locatario_id||'', locador_id: c.locador_id||'',
      fiador_id: c.fiador_id||'',
      locatarios_adicionais: (c.locatarios_adicionais||[]).join(','),
      locadores_adicionais: (c.locadores_adicionais||[]).join(','),
      taxa_administracao: c.taxa_administracao?.toString() || '10',
      honorarios_aplicavel: c.honorarios_aplicavel ? '1' : '',
      valor_honorarios: c.valor_honorarios?.toString() || '',
      data_inicio: c.data_inicio||'', data_fim: c.data_fim||'',
      duracao_meses: c.data_inicio && c.data_fim ? String(mesesContrato(c.data_inicio, c.data_fim)) : '',
      valor_mensal: c.valor_mensal?.toString()||'', valor_caucao: c.valor_caucao?.toString()||'',
      valor_condominio: c.valor_condominio?.toString()||'', valor_iptu: c.valor_iptu?.toString()||'',
      valor_seguro_incendio: c.valor_seguro_incendio?.toString()||'', valor_seguro_fianca: c.valor_seguro_fianca?.toString()||'',
      seguradora_fianca: c.seguradora_fianca||'', apolice_fianca: c.apolice_fianca||'',
      parcelas_caucao: '1',
      indice_reajuste: c.indice_reajuste||'igpm', mes_reajuste: c.mes_reajuste?.toString()||'1',
      multa_rescisao_locatario: c.multa_rescisao_locatario?.toString()||'3',
      multa_rescisao_locador: c.multa_rescisao_locador?.toString()||'',
      aviso_previo_dias: c.aviso_previo_dias?.toString()||'30',
      tipo_garantia: c.tipo_garantia||'caucao', status: c.status||'ativo',
      observacoes: c.observacoes||'',
      foro: c.foro || 'Santana, São Paulo, SP',
      apolice_incendio_numero: c.apolice_incendio_numero || '',
      forma_recebimento_caucao: c.forma_recebimento_caucao || 'pix',
      pix_recebimento_caucao: c.pix_recebimento_caucao || '',
      banco_recebimento_caucao: c.banco_recebimento_caucao || '',
      agencia_recebimento_caucao: c.agencia_recebimento_caucao || '',
      conta_recebimento_caucao: c.conta_recebimento_caucao || '',
      fiador_imovel_cep: c.fiador_imovel_cep || '',
      fiador_imovel_endereco: c.fiador_imovel_endereco || '',
      fiador_imovel_numero: c.fiador_imovel_numero || '',
      fiador_imovel_complemento: c.fiador_imovel_complemento || '',
      fiador_imovel_bairro: c.fiador_imovel_bairro || '',
      fiador_imovel_cidade: c.fiador_imovel_cidade || '',
      fiador_imovel_estado: c.fiador_imovel_estado || '',
      fiador_imovel_matricula: c.fiador_imovel_matricula || '',
      fiador_imovel_iptu: c.fiador_imovel_iptu || '',
    }
  }

  function abrirEdicao(c: Contrato) {
    setFormInicial(dadosFormDoContrato(c))
  }

  async function salvar(dados: Record<string,string>) {
    if (!organizacao?.id) throw new Error('Organização ainda não carregada. Aguarde e tente novamente.')
    const inicioDate = new Date(dados.data_inicio)
    const proximoReajuste = new Date(inicioDate)
    proximoReajuste.setFullYear(proximoReajuste.getFullYear() + 1)

    const payload = {
      numero: dados.numero, tipo: dados.tipo,
      imovel_id: dados.imovel_id, locatario_id: dados.locatario_id, locador_id: dados.locador_id,
      fiador_id: dados.tipo_garantia === 'fiador' ? (dados.fiador_id || null) : null,
      locatarios_adicionais: (dados.locatarios_adicionais || '').split(',').filter(Boolean),
      locadores_adicionais: (dados.locadores_adicionais || '').split(',').filter(Boolean),
      data_inicio: dados.data_inicio, data_fim: dados.data_fim,
      valor_mensal: parseFloat(dados.valor_mensal),
      valor_atual: parseFloat(dados.valor_mensal),
      valor_caucao: dados.valor_caucao ? parseFloat(dados.valor_caucao) : null,
      valor_condominio: dados.valor_condominio ? parseFloat(dados.valor_condominio) : 0,
      valor_iptu: dados.valor_iptu ? parseFloat(dados.valor_iptu) : 0,
      valor_seguro_incendio: dados.valor_seguro_incendio ? parseFloat(dados.valor_seguro_incendio) : 0,
      valor_seguro_fianca: dados.tipo_garantia === 'seguro_fianca' && dados.valor_seguro_fianca ? parseFloat(dados.valor_seguro_fianca) : 0,
      seguradora_fianca: dados.tipo_garantia === 'seguro_fianca' ? (dados.seguradora_fianca || null) : null,
      apolice_fianca: dados.tipo_garantia === 'seguro_fianca' ? (dados.apolice_fianca || null) : null,
      taxa_administracao: dados.taxa_administracao ? parseFloat(dados.taxa_administracao) : 10,
      honorarios_aplicavel: !!dados.honorarios_aplicavel,
      valor_honorarios: dados.honorarios_aplicavel && dados.valor_honorarios ? parseFloat(dados.valor_honorarios) : 0,
      parcelas_caucao: dados.tipo_garantia === 'caucao' ? (parseInt(dados.parcelas_caucao) || 1) : 1,
      indice_reajuste: dados.indice_reajuste, mes_reajuste: parseInt(dados.mes_reajuste),
      proximo_reajuste: dados.id ? undefined : proximoReajuste.toISOString().split('T')[0],
      multa_rescisao_locatario: parseFloat(dados.multa_rescisao_locatario) || 0,
      multa_rescisao_locador: parseFloat(dados.multa_rescisao_locador) || 0,
      aviso_previo_dias: parseInt(dados.aviso_previo_dias),
      tipo_garantia: dados.tipo_garantia, status: dados.status,
      observacoes: dados.observacoes||null,
      foro: dados.foro || 'Santana, São Paulo, SP',
      apolice_incendio_numero: dados.apolice_incendio_numero || null,
      forma_recebimento_caucao: dados.forma_recebimento_caucao || 'pix',
      pix_recebimento_caucao: dados.pix_recebimento_caucao || null,
      banco_recebimento_caucao: dados.banco_recebimento_caucao || null,
      agencia_recebimento_caucao: dados.agencia_recebimento_caucao || null,
      conta_recebimento_caucao: dados.conta_recebimento_caucao || null,
      fiador_imovel_cep: dados.tipo_garantia === 'fiador' ? (dados.fiador_imovel_cep || null) : null,
      fiador_imovel_endereco: dados.tipo_garantia === 'fiador' ? (dados.fiador_imovel_endereco || null) : null,
      fiador_imovel_numero: dados.tipo_garantia === 'fiador' ? (dados.fiador_imovel_numero || null) : null,
      fiador_imovel_complemento: dados.tipo_garantia === 'fiador' ? (dados.fiador_imovel_complemento || null) : null,
      fiador_imovel_bairro: dados.tipo_garantia === 'fiador' ? (dados.fiador_imovel_bairro || null) : null,
      fiador_imovel_cidade: dados.tipo_garantia === 'fiador' ? (dados.fiador_imovel_cidade || null) : null,
      fiador_imovel_estado: dados.tipo_garantia === 'fiador' ? (dados.fiador_imovel_estado || null) : null,
      fiador_imovel_matricula: dados.tipo_garantia === 'fiador' ? (dados.fiador_imovel_matricula || null) : null,
      fiador_imovel_iptu: dados.tipo_garantia === 'fiador' ? (dados.fiador_imovel_iptu || null) : null,
      organization_id: organizacao.id,
    }

    let contratoId = dados.id
    let error

    if (dados.id) {
      const res = await supabase.from('contratos').update(payload).eq('id', dados.id).eq('organization_id', organizacao.id)
      error = res.error
    } else {
      const res = await supabase.from('contratos').insert([{...payload, data_assinatura: dados.data_inicio}]).select().single()
      error = res.error
      if (res.data) contratoId = res.data.id
    }

    if (error) throw new Error(error.message)

    const caucaoVal = parseFloat(dados.valor_caucao) || 0
    const parcelasNum = parseInt(dados.parcelas_caucao) || 1

    if (!dados.id && caucaoVal > 0 && contratoId) {
      const valorParcela = caucaoVal / parcelasNum
      const lancamentos = []
      for (let i = 0; i < parcelasNum; i++) {
        const vencimento = new Date(dados.data_inicio + 'T00:00:00')
        vencimento.setMonth(vencimento.getMonth() + i)
        lancamentos.push({
          organization_id: organizacao.id,
          contrato_id: contratoId,
          cliente_id: dados.locatario_id,
          tipo: 'receita',
          categoria: 'caucao',
          descricao: parcelasNum > 1
            ? `Caução ${i + 1}/${parcelasNum} — Contrato #${dados.numero}`
            : `Caução — Contrato #${dados.numero}`,
          valor: valorParcela,
          data_lancamento: vencimento.toISOString().split('T')[0],
          status: 'pendente',
        })
      }
      const { error: erroLancamentos } = await supabase.from('lancamentos').insert(lancamentos)
      if (erroLancamentos) {
        console.error('Erro ao gerar lançamentos de caução:', erroLancamentos)
        throw new Error(`Contrato salvo, mas falhou ao gerar lançamentos de caução: ${erroLancamentos.message}`)
      }
    }

    if (!dados.id && contratoId) {
      const valorMensal = parseFloat(dados.valor_mensal) || 0
      const valorCondominio = parseFloat(dados.valor_condominio) || 0
      const valorIptu = parseFloat(dados.valor_iptu) || 0
      const valorSeguroIncendio = parseFloat(dados.valor_seguro_incendio) || 0
      const valorSeguroFianca = dados.tipo_garantia === 'seguro_fianca' ? (parseFloat(dados.valor_seguro_fianca) || 0) : 0
      const numMeses = mesesContrato(dados.data_inicio, dados.data_fim)
      const valorCaucaoParcela = parcelasNum > 1 ? caucaoVal / parcelasNum : 0
      const taxaAdmPct = dados.taxa_administracao ? parseFloat(dados.taxa_administracao) : 10
      const temHonorario = !!dados.honorarios_aplicavel

      // A 1ª cobrança sempre vence 30 dias após o início do contrato,
      // não no mesmo dia do início. Os meses seguintes contam a partir dela.
      const primeiroVencimento = new Date(dados.data_inicio + 'T00:00:00')
      primeiroVencimento.setDate(primeiroVencimento.getDate() + 30)

      const cobrancas = []
      for (let i = 0; i < numMeses; i++) {
        const vencimento = new Date(primeiroVencimento)
        vencimento.setMonth(vencimento.getMonth() + i)
        const caucaoDoMes = i < parcelasNum ? valorCaucaoParcela : 0
        const total = valorMensal + valorCondominio + valorIptu + valorSeguroIncendio + valorSeguroFianca + caucaoDoMes

        // Regra de honorários: a 1ª cobrança do contrato fica 100% com a
        // imobiliária (repasse zero); da 2ª em diante, repasse normal.
        const ehPrimeira = i === 0
        const valorTaxaAdm = (temHonorario && ehPrimeira) ? valorMensal : valorMensal * (taxaAdmPct / 100)
        const valorRepasse = (temHonorario && ehPrimeira) ? 0 : valorMensal - valorTaxaAdm

        cobrancas.push({
          organization_id: organizacao.id,
          contrato_id: contratoId,
          locatario_id: dados.locatario_id,
          locador_id: dados.locador_id,
          data_vencimento: vencimento.toISOString().split('T')[0],
          mes_referencia: `${meses[vencimento.getMonth()]}/${vencimento.getFullYear()}`,
          competencia: new Date(vencimento.getFullYear(), vencimento.getMonth(), 1).toISOString().split('T')[0],
          valor_aluguel: valorMensal,
          valor_condominio: valorCondominio,
          valor_iptu: valorIptu,
          valor_seguro_incendio: valorSeguroIncendio,
          valor_seguro_fianca: valorSeguroFianca,
          valor_caucao_parcela: caucaoDoMes,
          caucao_parcela_num: caucaoDoMes > 0 ? i + 1 : null,
          caucao_parcelas_total: caucaoDoMes > 0 ? parcelasNum : null,
          valor_total: total,
          taxa_administracao_pct: taxaAdmPct,
          valor_taxa_adm: valorTaxaAdm,
          valor_repasse: valorRepasse,
          status_repasse: 'aguardando',
          status_cobranca: 'pendente',
        })
      }
      const { error: erroCobrancas } = await supabase.from('cobrancas').insert(cobrancas)
      if (erroCobrancas) {
        console.error('Erro ao gerar cobranças:', erroCobrancas)
        throw new Error(`Contrato salvo, mas falhou ao gerar cobranças: ${erroCobrancas.message}`)
      }
    }

    await registrarLog({
      acao: dados.id ? 'editou' : 'criou',
      modulo: 'contrato', registro_nome: `Contrato #${dados.numero}`,
      descricao: `${dados.id ? 'Editou' : 'Criou'} o contrato #${dados.numero}${!dados.id && caucaoVal > 0 && parcelasNum > 1 ? ` — caução parcelado em ${parcelasNum}x` : ''}`,
    })

    setSucesso(dados.id ? 'Contrato atualizado!' : `Contrato criado! ${!dados.id ? `${mesesContrato(dados.data_inicio, dados.data_fim)} cobranças geradas.` : ''}${caucaoVal > 0 && parcelasNum > 1 ? ` Caução parcelado em ${parcelasNum}x lançado no financeiro.` : ''}`)
    await buscarTudo(organizacao.id)
    setTimeout(() => setSucesso(''), 4000)
    return contratoId
  }

  async function excluir(id: string, numero: string) {
    if (!organizacao?.id) return
    if (!confirm(`Excluir contrato #${numero}?\n\nIsso também vai apagar todas as cobranças, lançamentos e demandas vinculados a ele. Essa ação não pode ser desfeita.`)) return

    setErroExclusao('')

    const { error: erroCobrancas } = await supabase.from('cobrancas').delete().eq('contrato_id', id).eq('organization_id', organizacao.id)
    if (erroCobrancas) {
      setErroExclusao(`Erro ao apagar cobranças do contrato: ${erroCobrancas.message}`)
      return
    }

    const { error: erroLancamentos } = await supabase.from('lancamentos').delete().eq('contrato_id', id).eq('organization_id', organizacao.id)
    if (erroLancamentos) {
      setErroExclusao(`Erro ao apagar lançamentos do contrato: ${erroLancamentos.message}`)
      return
    }

    const { error: erroDemandas } = await supabase.from('demandas').delete().eq('contrato_id', id).eq('organization_id', organizacao.id)
    if (erroDemandas) {
      setErroExclusao(`Erro ao apagar demandas do contrato: ${erroDemandas.message}`)
      return
    }

    const { error: erroContrato } = await supabase.from('contratos').delete().eq('id', id).eq('organization_id', organizacao.id)
    if (erroContrato) {
      setErroExclusao(`Erro ao excluir contrato: ${erroContrato.message}`)
      return
    }

    await registrarLog({
      acao: 'excluiu',
      modulo: 'contrato', registro_nome: `Contrato #${numero}`,
      descricao: `Excluiu o contrato #${numero} (junto com cobranças e lançamentos vinculados)`,
    })

    setSucesso(`Contrato #${numero} excluído.`)
    buscarTudo(organizacao.id)
    setTimeout(() => setSucesso(''), 4000)
  }

  const vencendo = contratos.filter(c => {
    const st = statusContrato(c.data_fim, c.status)
    return st === 'vencendo' || st === 'atencao'
  })

  return (
    <AppLayout>
      <div style={{ background: '#0d1117', minHeight: '100vh' }} className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="max-w-[1600px] mx-auto">

          <div className="flex items-center justify-between mb-5">
            <h1 style={{ color: '#f4f4f3' }} className="text-lg font-medium">Contratos</h1>
            <button className="btn btn-primary" onClick={abrirNovo} disabled={!organizacao?.id}><Plus size={14} />Novo contrato</button>
          </div>

          {sucesso && <div style={{ background: '#1a2e1f', border: '0.5px solid #2d4a35', color: '#3fb950' }} className="px-4 py-3 rounded-lg mb-4 text-sm">{sucesso}</div>}
          {erroExclusao && <div style={{ background: '#2e1717', border: '0.5px solid #4a2424', color: '#ef4444' }} className="px-4 py-3 rounded-lg mb-4 text-sm">{erroExclusao}</div>}

          {formInicial !== null && organizacao?.id && (
            <FormContrato key={formInicial.id||'novo'} inicial={formInicial}
              imoveis={imoveis} clientes={clientes}
              onSalvar={salvar} onCancelar={() => setFormInicial(null)}
              onClienteCriado={recarregarClientes}
              popupPdf={popupPdf}
              onGerarPdf={(id) => confirmarEGerarPdf(id, organizacao.id, setPopupPdf)}
              organizationId={organizacao.id} />
          )}

          {vencendo.length > 0 && !formInicial && (
            <div style={{ background: '#2e2515', border: '0.5px solid #4a3a1f' }} className="rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
                <span style={{ color: '#fcd34d' }} className="text-sm font-medium">{vencendo.length} contrato(s) vencendo em breve</span>
              </div>
              {vencendo.map(c => {
                const dias = diasRestantes(c.data_fim)
                return (
                  <div key={c.id} style={{ color: '#c3a76b', borderTop: '0.5px solid #4a3a1f' }} className="text-xs py-1 first:border-0">
                    #{c.numero} — {getTitulo(c.imovel)} · {getNome(c.locatario)} · vence em {dias} dias ({formatDate(c.data_fim)})
                  </div>
                )
              })}
            </div>
          )}

          {!formInicial && (
          <div className="card p-0 overflow-hidden overflow-x-auto">
            {loading ? (
              <div style={{ color: '#8b8d98' }} className="text-center py-12 text-sm">Carregando...</div>
            ) : contratos.length === 0 ? (
              <div style={{ color: '#8b8d98' }} className="text-center py-12">
                <FileText size={36} className="mx-auto mb-2 opacity-30" />
                <div style={{ color: '#c3c2b7' }} className="font-medium">Nenhum contrato cadastrado</div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '0.5px solid #2a2f3a' }}>
                    {['#','Imóvel','Locatário','Locador','Início','Vencimento','Valor','Índice','Status',''].map(h => (
                      <th key={h} style={{ color: '#8b8d98' }} className="text-left px-2.5 py-2.5 text-xs font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contratos.map(c => {
                    const st = statusContrato(c.data_fim, c.status)
                    const dias = diasRestantes(c.data_fim)
                    return (
                      <tr key={c.id} style={{ borderBottom: '0.5px solid #1c2128', cursor: 'pointer' }} className="hover:bg-[#161b22]"
                        onClick={() => abrirEdicao(c)}>
                        <td style={{ color: '#8b8d98' }} className="px-2.5 py-2.5 text-xs font-mono whitespace-nowrap">#{c.numero}</td>
                        <td style={{ color: '#f4f4f3' }} className="px-2.5 py-2.5 font-medium text-sm whitespace-nowrap">{getTitulo(c.imovel)}</td>
                        <td style={{ color: '#c3c2b7' }} className="px-2.5 py-2.5 text-sm whitespace-nowrap">{getNome(c.locatario)}</td>
                        <td style={{ color: '#c3c2b7' }} className="px-2.5 py-2.5 text-sm whitespace-nowrap">{getNome(c.locador)}</td>
                        <td style={{ color: '#8b8d98' }} className="px-2.5 py-2.5 text-xs whitespace-nowrap">{formatDate(c.data_inicio)}</td>
                        <td className="px-2.5 py-2.5 text-xs whitespace-nowrap">
                          <div style={{ color: st==='vencendo' ? '#ef4444' : st==='atencao' ? '#f59e0b' : '#8b8d98' }} className={st==='vencendo'||st==='atencao' ? 'font-semibold' : ''}>
                            {formatDate(c.data_fim)}
                          </div>
                          {dias > 0 && dias <= 60 && <div style={{ color: '#5b5e6b' }} className="text-[10px]">{dias} dias</div>}
                        </td>
                        <td style={{ color: '#f4f4f3' }} className="px-2.5 py-2.5 font-medium text-sm whitespace-nowrap">{formatVal(c.valor_atual || c.valor_mensal)}</td>
                        <td style={{ color: '#8b8d98' }} className="px-2.5 py-2.5 text-xs uppercase">{c.indice_reajuste}</td>
                        <td className="px-2.5 py-2.5"><span className={statusBadge[st]||'badge badge-gray'}>{statusLabel[st]||st}</span></td>
                        <td className="px-2.5 py-2.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1.5">
                            <button className="btn btn-sm flex-shrink-0" onClick={() => abrirEdicao(c)}><Edit2 size={12} />Editar</button>
                            <button className="btn btn-sm flex-shrink-0" style={{ background: 'transparent', color: '#8b9ab4', border: '1px solid #2a2f3a' }} onClick={() => abrirEdicao(c)}>Visualizar</button>
                            <button className="btn btn-sm flex-shrink-0" style={{ color: '#ef4444' }} onClick={() => excluir(c.id, c.numero)}><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
