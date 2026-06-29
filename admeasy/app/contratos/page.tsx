'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { supabase } from '@/lib/supabase'
import { FileText, Plus, X, AlertTriangle } from 'lucide-react'

type Contrato = {
  id: string
  numero: string
  tipo: string
  data_inicio: string
  data_fim: string
  valor_mensal: number
  valor_atual?: number
  indice_reajuste: string
  status: string
  imovel?: { titulo: string; bairro?: string }
  locatario?: { nome: string }
  locador?: { nome: string }
}

type Cliente = { id: string; nome: string; tipo: string }
type Imovel = { id: string; titulo: string; bairro?: string }

function diasRestantes(dataFim: string) {
  const hoje = new Date()
  const fim = new Date(dataFim)
  return Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

function statusContrato(dataFim: string, status: string) {
  if (status === 'encerrado' || status === 'rescindido') return status
  const dias = diasRestantes(dataFim)
  if (dias < 0) return 'encerrado'
  if (dias <= 15) return 'vencendo'
  if (dias <= 30) return 'atencao'
  return 'ativo'
}

const statusBadge: Record<string, string> = {
  ativo: 'badge badge-green',
  vencendo: 'badge badge-red',
  atencao: 'badge badge-yellow',
  encerrado: 'badge badge-gray',
  rescindido: 'badge badge-gray',
  pendente: 'badge badge-yellow',
}

const statusLabel: Record<string, string> = {
  ativo: 'Ativo',
  vencendo: 'Vencendo',
  atencao: 'Atenção',
  encerrado: 'Encerrado',
  rescindido: 'Rescindido',
  pendente: 'Pendente',
}

function formatVal(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date + 'T00:00:00'))
}

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const [form, setForm] = useState({
    numero: '', tipo: 'locacao_residencial',
    imovel_id: '', locatario_id: '', locador_id: '',
    data_inicio: '', data_fim: '',
    valor_mensal: '', valor_caucao: '',
    indice_reajuste: 'igpm', mes_reajuste: '1',
    multa_rescisao_locatario: '3', multa_rescisao_locador: '3',
    aviso_previo_dias: '30',
    tipo_garantia: 'caucao', status: 'ativo', observacoes: '',
  })

  useEffect(() => {
    buscarContratos()
    buscarClientes()
    buscarImoveis()
  }, [])

  async function buscarContratos() {
    setLoading(true)
    const { data } = await supabase
      .from('contratos')
      .select(`*, imovel:imoveis(titulo, bairro), locatario:clientes!contratos_locatario_id_fkey(nome), locador:clientes!contratos_locador_id_fkey(nome)`)
      .order('created_at', { ascending: false })
    if (data) setContratos(data)
    setLoading(false)
  }

  async function buscarClientes() {
    const { data } = await supabase.from('clientes').select('id, nome, tipo').order('nome')
    if (data) setClientes(data)
  }

  async function buscarImoveis() {
    const { data } = await supabase.from('imoveis').select('id, titulo, bairro').order('titulo')
    if (data) setImoveis(data)
  }

  async function salvarContrato(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro('')

    const inicioDate = new Date(form.data_inicio)
    const proximoReajuste = new Date(inicioDate)
    proximoReajuste.setFullYear(proximoReajuste.getFullYear() + 1)

    const payload = {
      numero: form.numero,
      tipo: form.tipo,
      imovel_id: form.imovel_id,
      locatario_id: form.locatario_id,
      locador_id: form.locador_id,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim,
      data_assinatura: form.data_inicio,
      valor_mensal: parseFloat(form.valor_mensal),
      valor_atual: parseFloat(form.valor_mensal),
      valor_caucao: form.valor_caucao ? parseFloat(form.valor_caucao) : null,
      indice_reajuste: form.indice_reajuste,
      mes_reajuste: parseInt(form.mes_reajuste),
      ultimo_reajuste: null,
      proximo_reajuste: proximoReajuste.toISOString().split('T')[0],
      multa_rescisao_locatario: parseFloat(form.multa_rescisao_locatario),
      multa_rescisao_locador: parseFloat(form.multa_rescisao_locador),
      aviso_previo_dias: parseInt(form.aviso_previo_dias),
      tipo_garantia: form.tipo_garantia,
      status: form.status,
      observacoes: form.observacoes,
    }

    const { error } = await supabase.from('contratos').insert([payload])

    if (error) {
      setErro('Erro ao salvar: ' + error.message)
    } else {
      setSucesso('Contrato criado com sucesso!')
      setShowForm(false)
      buscarContratos()
      setTimeout(() => setSucesso(''), 3000)
    }
    setSalvando(false)
  }

  const locatarios = clientes.filter(c => ['locatario', 'comprador', 'lead'].includes(c.tipo))
  const locadores = clientes.filter(c => ['locador', 'vendedor'].includes(c.tipo))

  const vencendo = contratos.filter(c => {
    const st = statusContrato(c.data_fim, c.status)
    return st === 'vencendo' || st === 'atencao'
  })

  return (
    <AppLayout>
      <Topbar titulo="Contratos">
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancelar' : 'Novo contrato'}
        </button>
      </Topbar>

      <div className="flex-1 overflow-y-auto p-6">
        {sucesso && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">{sucesso}</div>
        )}

        {/* Alertas vencimento */}
        {vencendo.length > 0 && !showForm && (
          <div className="card mb-4 border-yellow-200 bg-yellow-50">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={15} className="text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">{vencendo.length} contrato(s) vencendo em breve</span>
            </div>
            {vencendo.map(c => {
              const dias = diasRestantes(c.data_fim)
              return (
                <div key={c.id} className="text-xs text-yellow-700 py-1 border-t border-yellow-200 first:border-0">
                  #{c.numero} — {c.imovel?.titulo} · {c.locatario?.nome} · vence em {dias} dias ({formatDate(c.data_fim)})
                </div>
              )
            })}
          </div>
        )}

        {/* FORMULÁRIO */}
        {showForm && (
          <div className="card mb-6">
            <h2 className="text-sm font-semibold mb-4">Novo contrato de locação</h2>
            <form onSubmit={salvarContrato}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Número do contrato *</label>
                  <input className="input" required value={form.numero} onChange={e => setForm({...form, numero: e.target.value})} placeholder="Ex: 001/2024" />
                </div>
                <div>
                  <label className="label">Tipo</label>
                  <select className="input" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
                    <option value="locacao_residencial">Locação residencial</option>
                    <option value="locacao_comercial">Locação comercial</option>
                    <option value="compra_venda">Compra e venda</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Imóvel *</label>
                  <select className="input" required value={form.imovel_id} onChange={e => setForm({...form, imovel_id: e.target.value})}>
                    <option value="">Selecionar imóvel</option>
                    {imoveis.map(i => <option key={i.id} value={i.id}>{i.titulo}{i.bairro ? ` — ${i.bairro}` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Locatário *</label>
                  <select className="input" required value={form.locatario_id} onChange={e => setForm({...form, locatario_id: e.target.value})}>
                    <option value="">Selecionar locatário</option>
                    {locatarios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    {clientes.filter(c => !['locador','vendedor'].includes(c.tipo)).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Locador (proprietário) *</label>
                  <select className="input" required value={form.locador_id} onChange={e => setForm({...form, locador_id: e.target.value})}>
                    <option value="">Selecionar locador</option>
                    {locadores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Data de início *</label>
                  <input className="input" type="date" required value={form.data_inicio} onChange={e => setForm({...form, data_inicio: e.target.value})} />
                </div>
                <div>
                  <label className="label">Data de fim *</label>
                  <input className="input" type="date" required value={form.data_fim} onChange={e => setForm({...form, data_fim: e.target.value})} />
                </div>
                <div>
                  <label className="label">Valor mensal (R$) *</label>
                  <input className="input" type="number" required value={form.valor_mensal} onChange={e => setForm({...form, valor_mensal: e.target.value})} placeholder="0,00" />
                </div>
                <div>
                  <label className="label">Caução (R$)</label>
                  <input className="input" type="number" value={form.valor_caucao} onChange={e => setForm({...form, valor_caucao: e.target.value})} placeholder="0,00" />
                </div>
                <div>
                  <label className="label">Índice de reajuste</label>
                  <select className="input" value={form.indice_reajuste} onChange={e => setForm({...form, indice_reajuste: e.target.value})}>
                    <option value="igpm">IGP-M (FGV)</option>
                    <option value="ipca">IPCA (IBGE)</option>
                    <option value="inpc">INPC (IBGE)</option>
                    <option value="ivar">IVAR (FGV)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Mês do reajuste anual</label>
                  <select className="input" value={form.mes_reajuste} onChange={e => setForm({...form, mes_reajuste: e.target.value})}>
                    {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m,i) => (
                      <option key={i} value={i+1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Multa locatário (nº aluguéis)</label>
                  <input className="input" type="number" step="0.5" value={form.multa_rescisao_locatario} onChange={e => setForm({...form, multa_rescisao_locatario: e.target.value})} />
                </div>
                <div>
                  <label className="label">Multa locador (nº aluguéis)</label>
                  <input className="input" type="number" step="0.5" value={form.multa_rescisao_locador} onChange={e => setForm({...form, multa_rescisao_locador: e.target.value})} />
                </div>
                <div>
                  <label className="label">Aviso prévio (dias)</label>
                  <input className="input" type="number" value={form.aviso_previo_dias} onChange={e => setForm({...form, aviso_previo_dias: e.target.value})} />
                </div>
                <div>
                  <label className="label">Garantia</label>
                  <select className="input" value={form.tipo_garantia} onChange={e => setForm({...form, tipo_garantia: e.target.value})}>
                    <option value="caucao">Caução</option>
                    <option value="fiador">Fiador</option>
                    <option value="seguro_fianca">Seguro fiança</option>
                    <option value="titulo_capitalizacao">Título de capitalização</option>
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                    <option value="ativo">Ativo</option>
                    <option value="pendente">Pendente</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Observações</label>
                  <textarea className="input" rows={3} value={form.observacoes} onChange={e => setForm({...form, observacoes: e.target.value})} placeholder="Cláusulas especiais, acordos, pet, reforma..." />
                </div>
              </div>
              {erro && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg mt-3">{erro}</div>}
              <div className="flex gap-2 mt-4">
                <button type="submit" disabled={salvando} className="btn btn-primary">
                  {salvando ? 'Salvando...' : 'Criar contrato'}
                </button>
                <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* TABELA */}
        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Carregando contratos...</div>
          ) : contratos.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText size={36} className="mx-auto mb-2 opacity-30" />
              <div className="font-medium text-gray-500">Nenhum contrato cadastrado</div>
              <div className="text-sm mt-1">Clique em "Novo contrato" para começar</div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">#</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Imóvel</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Locatário</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Locador</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Início</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Vencimento</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Valor</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Índice</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {contratos.map((c) => {
                  const st = statusContrato(c.data_fim, c.status)
                  const dias = diasRestantes(c.data_fim)
                  return (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 text-xs font-mono">#{c.numero}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 text-sm">{c.imovel?.titulo || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{c.locatario?.nome || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{c.locador?.nome || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(c.data_inicio)}</td>
                      <td className="px-4 py-3 text-xs">
                        <div className={st === 'vencendo' ? 'text-red-600 font-semibold' : st === 'atencao' ? 'text-yellow-600 font-medium' : 'text-gray-500'}>
                          {formatDate(c.data_fim)}
                        </div>
                        {dias > 0 && dias <= 60 && <div className="text-[10px] text-gray-400">{dias} dias</div>}
                      </td>
                      <td className="px-4 py-3 font-medium text-sm">{formatVal(c.valor_atual || c.valor_mensal)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 uppercase">{c.indice_reajuste}</td>
                      <td className="px-4 py-3">
                        <span className={statusBadge[st] || 'badge badge-gray'}>{statusLabel[st] || st}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button className="btn text-xs py-1 px-2.5">Ver</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
