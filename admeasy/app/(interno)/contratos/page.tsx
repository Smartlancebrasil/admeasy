'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { FileText, Plus, X, AlertTriangle, Edit2, FileDown, UserPlus } from 'lucide-react'
import { registrarLog } from '@/lib/logs'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

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
  taxa_administracao?: number
  honorarios_aplicavel?: boolean
  valor_honorarios?: number
  imovel?: any
  locatario?: any
  locador?: any
}

type SelectOpt = { id: string; titulo?: string; nome?: string; valor_aluguel?: number; valor_condominio?: number; valor_iptu?: number; taxa_administracao?: number; tipo?: string; categoria?: string; finalidade?: string; codigo?: string; endereco?: string; bairro?: string; cpf?: string; telefone?: string }

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
  if (finalidadeImovel === 'venda') return 'compra_venda'
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
              {i.codigo && (
                <span style={{ background: '#0d1b2e', color: '#5b9bf5', border: '0.5px solid #1e3a5f' }} className="text-[10px] font-semibold px-2 py-1 rounded flex-shrink-0">
                  {i.codigo}
                </span>
              )}
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
  imovel_id:'', locatario_id:'', locador_id:'', taxa_administracao: '10',
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
function ModalClienteCompleto({ tipoParte, onSalvar, onFechar }: {
  tipoParte: 'locatario' | 'locador'
  onSalvar: (cliente: { id: string; nome: string }) => void
  onFechar: () => void
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

    const payloadTitular = { ...formSemNumeroComplemento, endereco: enderecoCompleto, organization_id: ORG_ID, tem_portal: false }
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
        organization_id: ORG_ID,
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

function FormContrato({ inicial, imoveis, clientes, onSalvar, onCancelar, onClienteCriado }: {
  inicial: Record<string,string>
  imoveis: SelectOpt[]
  clientes: SelectOpt[]
  onSalvar: (dados: Record<string,string>, irParaPdf?: boolean) => Promise<void>
  onCancelar: () => void
  onClienteCriado: () => Promise<void>
}) {
  const [form, setForm] = useState(inicial)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [modalCadastro, setModalCadastro] = useState<'locatario' | 'locador' | null>(null)
  const [modalImovel, setModalImovel] = useState(false)
  const [modalSelecionarCliente, setModalSelecionarCliente] = useState<'locatario' | 'locador' | null>(null)
  const set = (c: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setForm(f=>({...f,[c]:e.target.value}))

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

  const [irParaPdfFlag, setIrParaPdfFlag] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true); setErro('')
    try { await onSalvar(form, irParaPdfFlag) } catch(err: any) { setErro(err.message) }
    setSalvando(false)
    setIrParaPdfFlag(false)
  }

  async function aoCriarCliente(campo: 'locatario_id' | 'locador_id', cliente: { id: string; nome: string }) {
    await onClienteCriado()
    setForm(f => ({ ...f, [campo]: cliente.id }))
    setModalCadastro(null)
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ color: '#f4f4f3' }} className="text-sm font-semibold">{inicial.id ? `Editando contrato #${inicial.numero}` : 'Novo contrato'}</h2>
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
              <option value="compra_venda">Compra e venda</option>
            </select></div>
          <div className="sm:col-span-2"><label className="label">Imóvel *</label>
            <button type="button" onClick={() => setModalImovel(true)}
              style={{ background: '#060D1C', border: '0.5px solid #1e3a5f', color: form.imovel_id ? '#f4f4f3' : '#5b5e6b' }}
              className="input w-full text-left flex items-center gap-2">
              {form.imovel_id ? (() => {
                const sel = imoveis.find(i => i.id === form.imovel_id)
                return <>
                  {sel?.codigo && <span style={{ background: '#16243a', color: '#5b9bf5', border: '0.5px solid #1e3a5f' }} className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0">{sel.codigo}</span>}
                  <span className="truncate">{sel?.titulo}</span>
                </>
              })() : 'Selecionar imóvel'}
            </button>
            <p style={{ color: '#5b5e6b' }} className="text-[10px] mt-1">
              Selecionar o imóvel já preenche valor do aluguel e taxa de administração. Condomínio e IPTU ficam zerados — preencha manualmente se houver.
            </p>
          </div>

          <div>
            <label className="label">Locatário *</label>
            <button type="button" onClick={() => setModalSelecionarCliente('locatario')}
              style={{ background: '#060D1C', border: '0.5px solid #1e3a5f', color: form.locatario_id ? '#f4f4f3' : '#5b5e6b' }}
              className="input text-left">
              {form.locatario_id ? clientes.find(c => c.id === form.locatario_id)?.nome : 'Clique para selecionar ou cadastrar'}
            </button>
          </div>

          <div>
            <label className="label">Locador *</label>
            <button type="button" onClick={() => setModalSelecionarCliente('locador')}
              style={{ background: '#060D1C', border: '0.5px solid #1e3a5f', color: form.locador_id ? '#f4f4f3' : '#5b5e6b' }}
              className="input text-left">
              {form.locador_id ? clientes.find(c => c.id === form.locador_id)?.nome : 'Clique para selecionar ou cadastrar'}
            </button>
          </div>

          <div><label className="label">Valor mensal (R$) *</label>
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
          <div><label className="label">Seguro incêndio (R$)</label>
            <InputMoeda value={form.valor_seguro_incendio} onChange={v => setForm(f => ({...f, valor_seguro_incendio: v}))} /></div>

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
              min={inicial.id ? undefined : new Date().toISOString().split('T')[0]}
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
        </div>
        <div className="flex gap-2 mt-4">
          <button type="submit" disabled={salvando} className="btn btn-primary">
            {salvando ? 'Salvando...' : inicial.id ? 'Salvar alterações' : 'Salvar contrato'}
          </button>
          <button type="button" className="btn" onClick={onCancelar}>Cancelar</button>
        </div>
      </form>

      {modalCadastro && (
        <ModalClienteCompleto
          tipoParte={modalCadastro}
          onFechar={() => setModalCadastro(null)}
          onSalvar={(cliente) => aoCriarCliente(modalCadastro === 'locatario' ? 'locatario_id' : 'locador_id', cliente)}
        />
      )}

      {modalSelecionarCliente && (
        <ModalSelecionarCliente
          clientes={clientes}
          titulo={modalSelecionarCliente === 'locatario' ? 'locatário' : 'locador'}
          onFechar={() => setModalSelecionarCliente(null)}
          onSelecionar={(cliente) => {
            setForm(f => ({
              ...f,
              [modalSelecionarCliente === 'locatario' ? 'locatario_id' : 'locador_id']: cliente.id,
            }))
          }}
          onAdicionarNovo={() => {
            const tipo = modalSelecionarCliente
            setModalSelecionarCliente(null)
            setModalCadastro(tipo)
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

export default function ContratosPage() {
  const router = useRouter()
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [imoveis, setImoveis] = useState<SelectOpt[]>([])
  const [clientes, setClientes] = useState<SelectOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [formInicial, setFormInicial] = useState<Record<string,string>|null>(null)
  const [sucesso, setSucesso] = useState('')
  const [erroExclusao, setErroExclusao] = useState('')

  useEffect(() => { buscarTudo() }, [])

  async function buscarTudo() {
    setLoading(true)
    const [cont, imov, cli] = await Promise.all([
      supabase.from('contratos').select(`*, imovel:imoveis(titulo), locatario:clientes!contratos_locatario_id_fkey(nome), locador:clientes!contratos_locador_id_fkey(nome)`).order('numero'),
      supabase.from('imoveis').select('id, codigo, titulo, tipo, categoria, finalidade, endereco, bairro, valor_aluguel, valor_condominio, valor_iptu, taxa_administracao').order('titulo'),
      supabase.from('clientes').select('id, nome, cpf, telefone, tipo').order('nome'),
    ])
    if (cont.data) setContratos(cont.data)
    if (imov.data) setImoveis(imov.data)
    if (cli.data) setClientes(cli.data)
    setLoading(false)
  }

  async function recarregarClientes() {
    const { data } = await supabase.from('clientes').select('id, nome, cpf, telefone, tipo').order('nome')
    if (data) setClientes(data)
  }

  function abrirNovo() {
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

  function abrirEdicao(c: Contrato) {
    setFormInicial({
      id: c.id, numero: c.numero||'', tipo: c.tipo||'locacao_residencial',
      imovel_id: c.imovel_id||'', locatario_id: c.locatario_id||'', locador_id: c.locador_id||'',
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
    })
  }

  async function salvar(dados: Record<string,string>, irParaPdf?: boolean) {
    const inicioDate = new Date(dados.data_inicio)
    const proximoReajuste = new Date(inicioDate)
    proximoReajuste.setFullYear(proximoReajuste.getFullYear() + 1)

    const payload = {
      numero: dados.numero, tipo: dados.tipo,
      imovel_id: dados.imovel_id, locatario_id: dados.locatario_id, locador_id: dados.locador_id,
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
      organization_id: ORG_ID,
    }

    let contratoId = dados.id
    let error

    if (dados.id) {
      const res = await supabase.from('contratos').update(payload).eq('id', dados.id)
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
          organization_id: ORG_ID,
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
          organization_id: ORG_ID,
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

    setFormInicial(null)
    setSucesso(dados.id ? 'Contrato atualizado!' : `Contrato criado! ${!dados.id ? `${mesesContrato(dados.data_inicio, dados.data_fim)} cobranças geradas.` : ''}${caucaoVal > 0 && parcelasNum > 1 ? ` Caução parcelado em ${parcelasNum}x lançado no financeiro.` : ''}`)
    buscarTudo()

    if (irParaPdf && contratoId) {
      router.push(`/contratos/${contratoId}/pdf`)
      return
    }

    setTimeout(() => setSucesso(''), 4000)
  }

  async function excluir(id: string, numero: string) {
    if (!confirm(`Excluir contrato #${numero}?\n\nIsso também vai apagar todas as cobranças, lançamentos e demandas vinculados a ele. Essa ação não pode ser desfeita.`)) return

    setErroExclusao('')

    const { error: erroCobrancas } = await supabase.from('cobrancas').delete().eq('contrato_id', id)
    if (erroCobrancas) {
      setErroExclusao(`Erro ao apagar cobranças do contrato: ${erroCobrancas.message}`)
      return
    }

    const { error: erroLancamentos } = await supabase.from('lancamentos').delete().eq('contrato_id', id)
    if (erroLancamentos) {
      setErroExclusao(`Erro ao apagar lançamentos do contrato: ${erroLancamentos.message}`)
      return
    }

    const { error: erroDemandas } = await supabase.from('demandas').delete().eq('contrato_id', id)
    if (erroDemandas) {
      setErroExclusao(`Erro ao apagar demandas do contrato: ${erroDemandas.message}`)
      return
    }

    const { error: erroContrato } = await supabase.from('contratos').delete().eq('id', id)
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
    buscarTudo()
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
            <button className="btn btn-primary" onClick={abrirNovo}><Plus size={14} />Novo contrato</button>
          </div>

          {sucesso && <div style={{ background: '#1a2e1f', border: '0.5px solid #2d4a35', color: '#3fb950' }} className="px-4 py-3 rounded-lg mb-4 text-sm">{sucesso}</div>}
          {erroExclusao && <div style={{ background: '#2e1717', border: '0.5px solid #4a2424', color: '#ef4444' }} className="px-4 py-3 rounded-lg mb-4 text-sm">{erroExclusao}</div>}

          {formInicial !== null && (
            <FormContrato key={formInicial.id||'novo'} inicial={formInicial}
              imoveis={imoveis} clientes={clientes}
              onSalvar={salvar} onCancelar={() => setFormInicial(null)}
              onClienteCriado={recarregarClientes} />
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
                      <tr key={c.id} style={{ borderBottom: '0.5px solid #1c2128' }} className="hover:bg-[#161b22]">
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
                        <td className="px-2.5 py-2.5 whitespace-nowrap">
                          <div className="flex gap-1.5">
                            <button className="btn btn-sm flex-shrink-0" onClick={() => abrirEdicao(c)}><Edit2 size={12} />Editar</button>
                            <Link href={`/contratos/${c.id}/pdf`} className="btn btn-sm whitespace-nowrap flex-shrink-0" style={{ background: '#22c55e', color: '#fff', padding: '4px 8px' }}><FileDown size={12} />Gerar Contrato</Link>
                            <button className="btn btn-sm flex-shrink-0" style={{ color: '#ef4444' }} onClick={() => excluir(c.id, c.numero)}><X size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
