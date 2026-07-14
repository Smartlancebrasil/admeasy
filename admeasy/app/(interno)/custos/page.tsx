'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { useOrganization } from '@/lib/OrganizationContext'
import { Plus, X, Edit2, Save, Wallet, TrendingUp, TrendingDown, Target } from 'lucide-react'
import { registrarLog } from '@/lib/logs'

type Custo = {
  id: string
  descricao: string
  categoria: string
  valor: number
  data_vencimento: string
  recorrente: boolean
  status: string
}

type ContratoAtivo = {
  id: string
  valor_atual?: number
  valor_mensal?: number
  taxa_administracao?: number
  comissao_seguro_incendio?: number
  comissao_seguro_fianca?: number
}

const categorias = [
  { value: 'aluguel', label: 'Aluguel do escritório' },
  { value: 'salarios', label: 'Salários' },
  { value: 'funcionarios', label: 'Funcionários (encargos, benefícios)' },
  { value: 'internet', label: 'Internet / telefonia' },
  { value: 'pro_labore', label: 'Pró-labore' },
  { value: 'outros', label: 'Outros' },
]

const categoriaLabel: Record<string, string> = Object.fromEntries(categorias.map(c => [c.value, c.label]))

const formVazio = {
  descricao: '', categoria: 'aluguel', valor: '', data_vencimento: '', recorrente: true,
}

function formatVal(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}
function formatDate(date?: string) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date + 'T00:00:00'))
}

/**
 * Fica FORA do componente da página pra não recriar o formulário (e perder
 * o foco dos inputs) a cada render do pai — mesmo padrão já usado nas
 * outras telas do sistema (clientes, fornecedores etc.).
 */
function FormCusto({ inicial, onSalvar, onCancelar }: {
  inicial: typeof formVazio & { id?: string }
  onSalvar: (dados: typeof formVazio & { id?: string }) => Promise<void>
  onCancelar: () => void
}) {
  const [form, setForm] = useState(inicial)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const set = (campo: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [campo]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro('')
    try { await onSalvar(form) } catch (err: any) { setErro(err.message) }
    setSalvando(false)
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ color: '#f4f4f3' }} className="text-sm font-semibold">{inicial.id ? 'Editando custo' : 'Cadastrar custo'}</h2>
        <button onClick={onCancelar} className="btn btn-sm"><X size={13} /></button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="label">Descrição *</label>
            <input className="input" required value={form.descricao} onChange={set('descricao')} placeholder="Ex: Aluguel da sede, Folha de pagamento..." />
          </div>
          <div>
            <label className="label">Categoria *</label>
            <select className="input" value={form.categoria} onChange={set('categoria')}>
              {categorias.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Valor mensal (R$) *</label>
            <input className="input" type="number" step="0.01" required value={form.valor} onChange={set('valor')} placeholder="0,00" />
          </div>
          <div>
            <label className="label">Próximo vencimento *</label>
            <input className="input" type="date" required value={form.data_vencimento} onChange={set('data_vencimento')} />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer" style={{ color: '#a8aab5' }}>
              <input type="checkbox" checked={form.recorrente} onChange={e => setForm(f => ({ ...f, recorrente: e.target.checked }))} className="accent-blue-600" />
              <span className="text-sm">Custo fixo recorrente (todo mês)</span>
            </label>
          </div>
        </div>
        {erro && <div style={{ background: '#2e1717', border: '0.5px solid #4a2424', color: '#ef4444' }} className="text-sm px-3 py-2 rounded-lg mt-3">{erro}</div>}
        <div className="flex gap-2 mt-4">
          <button type="submit" disabled={salvando} className="btn btn-primary">
            <Save size={13} />{salvando ? 'Salvando...' : 'Salvar custo'}
          </button>
          <button type="button" className="btn" onClick={onCancelar}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

export default function CustosPage() {
  const { organizacao } = useOrganization()
  const [custos, setCustos] = useState<Custo[]>([])
  const [contratosAtivos, setContratosAtivos] = useState<ContratoAtivo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Custo | null>(null)

  useEffect(() => {
    if (organizacao?.id) buscarTudo(organizacao.id)
  }, [organizacao?.id])

  async function buscarTudo(orgId: string) {
    setLoading(true)
    const [custosRes, contratosRes] = await Promise.all([
      supabase.from('despesas').select('*').eq('organization_id', orgId).order('data_vencimento', { ascending: true }),
      supabase.from('contratos').select('id, valor_atual, valor_mensal, taxa_administracao, comissao_seguro_incendio, comissao_seguro_fianca').eq('organization_id', orgId).eq('status', 'ativo'),
    ])
    if (custosRes.data) setCustos(custosRes.data)
    if (contratosRes.data) setContratosAtivos(contratosRes.data)
    setLoading(false)
  }

  function abrirNovo() {
    setEditando(null)
    setShowForm(true)
  }

  function abrirEdicao(c: Custo) {
    setEditando(c)
    setShowForm(true)
  }

  function fecharForm() {
    setShowForm(false)
    setEditando(null)
  }

  async function salvar(dados: typeof formVazio & { id?: string }) {
    if (!organizacao?.id) throw new Error('Organização ainda não carregada. Aguarde e tente novamente.')
    const payload = {
      descricao: dados.descricao,
      categoria: dados.categoria,
      valor: parseFloat(dados.valor) || 0,
      data_vencimento: dados.data_vencimento,
      recorrente: !!dados.recorrente,
    }

    if (dados.id) {
      const { error } = await supabase.from('despesas').update(payload).eq('id', dados.id).eq('organization_id', organizacao.id)
      if (error) throw new Error(error.message)
      await registrarLog({ acao: 'editar', modulo: 'custos', registro_id: dados.id, registro_nome: dados.descricao, descricao: `Editou o custo "${dados.descricao}"` })
    } else {
      const { data, error } = await supabase.from('despesas').insert([{ ...payload, status: 'pendente', organization_id: organizacao.id }]).select('id').single()
      if (error) throw new Error(error.message)
      await registrarLog({ acao: 'criar', modulo: 'custos', registro_id: data?.id, registro_nome: dados.descricao, descricao: `Cadastrou o custo "${dados.descricao}"` })
    }
    fecharForm()
    buscarTudo(organizacao.id)
  }

  async function excluir(c: Custo) {
    if (!organizacao?.id) return
    if (!confirm(`Excluir o custo "${c.descricao}"?`)) return
    await supabase.from('despesas').delete().eq('id', c.id).eq('organization_id', organizacao.id)
    await registrarLog({ acao: 'excluir', modulo: 'custos', registro_id: c.id, registro_nome: c.descricao, descricao: `Excluiu o custo "${c.descricao}"` })
    buscarTudo(organizacao.id)
  }

  const custosFixos = custos.filter(c => c.recorrente)
  const totalCustosMensais = custosFixos.reduce((s, c) => s + c.valor, 0)

  // Receita mensal recorrente estimada da imobiliária: comissão de administração
  // + comissão sobre seguro fiança/incêndio dos contratos ativos. Não inclui
  // honorários de locação (são pontuais por contrato novo, não recorrentes).
  const receitaMensalEstimada = contratosAtivos.reduce((acc, c) => {
    const valorAluguel = c.valor_atual || c.valor_mensal || 0
    const taxaPct = c.taxa_administracao || 10
    return acc + (valorAluguel * taxaPct / 100) + (c.comissao_seguro_incendio || 0) + (c.comissao_seguro_fianca || 0)
  }, 0)

  const lucroEstimado = receitaMensalEstimada - totalCustosMensais
  const lucroPct = receitaMensalEstimada > 0 ? (lucroEstimado / receitaMensalEstimada) * 100 : 0
  const ticketMedioReceitaPorContrato = contratosAtivos.length > 0 ? receitaMensalEstimada / contratosAtivos.length : 0
  const contratosNecessarios = ticketMedioReceitaPorContrato > 0 ? Math.ceil(totalCustosMensais / ticketMedioReceitaPorContrato) : 0

  const porCategoria = categorias.map(cat => ({
    ...cat,
    total: custosFixos.filter(c => c.categoria === cat.value).reduce((s, c) => s + c.valor, 0),
  })).filter(c => c.total > 0)

  return (
    <AppLayout>
      <div style={{ background: '#0d1117', minHeight: '100vh' }} className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="max-w-[1400px] mx-auto">

          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 style={{ color: '#f4f4f3' }} className="text-lg font-medium">Custos da imobiliária</h1>
              <p style={{ color: '#8b8d98' }} className="text-[12px] mt-0.5">Custos fixos mensais e quantos contratos são necessários pra cobri-los</p>
            </div>
            <button className="btn btn-primary" onClick={abrirNovo} disabled={!organizacao?.id}><Plus size={14} />Novo custo</button>
          </div>

          {/* MÉTRICAS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="card">
              <div style={{ color: '#8b8d98' }} className="text-xs mb-1 flex items-center gap-1"><TrendingDown size={12} />Custos fixos (mês)</div>
              <div style={{ color: '#ef4444' }} className="text-xl font-semibold">{formatVal(totalCustosMensais)}</div>
              <div style={{ color: '#8b8d98' }} className="text-xs mt-1">{custosFixos.length} custo(s) recorrente(s)</div>
            </div>
            <div className="card">
              <div style={{ color: '#8b8d98' }} className="text-xs mb-1 flex items-center gap-1"><TrendingUp size={12} />Receita mensal estimada</div>
              <div style={{ color: '#3fb950' }} className="text-xl font-semibold">{formatVal(receitaMensalEstimada)}</div>
              <div style={{ color: '#8b8d98' }} className="text-xs mt-1">{contratosAtivos.length} contrato(s) ativo(s)</div>
            </div>
            <div className="card">
              <div style={{ color: '#8b8d98' }} className="text-xs mb-1 flex items-center gap-1"><Wallet size={12} />Lucro estimado (mês)</div>
              <div style={{ color: lucroEstimado >= 0 ? '#3fb950' : '#ef4444' }} className="text-xl font-semibold">{formatVal(lucroEstimado)}</div>
              <div style={{ color: '#8b8d98' }} className="text-xs mt-1">{lucroPct.toFixed(1)}% da receita estimada</div>
            </div>
            <div className="card">
              <div style={{ color: '#8b8d98' }} className="text-xs mb-1 flex items-center gap-1"><Target size={12} />Contratos p/ cobrir custos</div>
              <div style={{ color: contratosNecessarios > contratosAtivos.length ? '#f59e0b' : '#3fb950' }} className="text-xl font-semibold">{contratosNecessarios || '—'}</div>
              <div style={{ color: '#8b8d98' }} className="text-xs mt-1">Você tem {contratosAtivos.length} hoje</div>
            </div>
          </div>

          {porCategoria.length > 0 && (
            <div className="card mb-6">
              <p style={{ color: '#8b8d98' }} className="text-xs font-medium uppercase tracking-wide mb-3">Custos por categoria</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {porCategoria.map(c => (
                  <div key={c.value} style={{ background: '#0d1117', border: '0.5px solid #2a2f3a' }} className="rounded-lg p-2.5">
                    <div style={{ color: '#8b8d98' }} className="text-[10px] truncate">{c.label}</div>
                    <div style={{ color: '#f4f4f3' }} className="text-sm font-semibold mt-0.5">{formatVal(c.total)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showForm && (
            <FormCusto
              inicial={editando ? {
                id: editando.id, descricao: editando.descricao, categoria: editando.categoria,
                valor: editando.valor.toString(), data_vencimento: editando.data_vencimento, recorrente: editando.recorrente,
              } : formVazio}
              onSalvar={salvar}
              onCancelar={fecharForm}
            />
          )}

          <div className="card p-0 overflow-hidden overflow-x-auto">
            {loading ? (
              <div style={{ color: '#8b8d98' }} className="text-center py-12 text-sm">Carregando...</div>
            ) : custos.length === 0 ? (
              <div style={{ color: '#8b8d98' }} className="text-center py-12">
                <Wallet size={32} className="mx-auto mb-2 opacity-30" />
                <div style={{ color: '#c3c2b7' }} className="font-medium">Nenhum custo cadastrado</div>
                <div className="text-sm mt-1">Clique em "Novo custo" pra começar a acompanhar seus custos fixos</div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '0.5px solid #2a2f3a' }}>
                    {['Descrição', 'Categoria', 'Valor', 'Vencimento', 'Tipo', ''].map(h => (
                      <th key={h} style={{ color: '#8b8d98' }} className="text-left px-4 py-3 text-xs font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {custos.map(c => (
                    <tr key={c.id} style={{ borderBottom: '0.5px solid #1c2128' }} className="hover:bg-[#161b22]">
                      <td style={{ color: '#f4f4f3' }} className="px-4 py-3 font-medium">{c.descricao}</td>
                      <td style={{ color: '#8b8d98' }} className="px-4 py-3 text-xs">{categoriaLabel[c.categoria] || c.categoria}</td>
                      <td style={{ color: '#f4f4f3' }} className="px-4 py-3 font-medium">{formatVal(c.valor)}</td>
                      <td style={{ color: '#8b8d98' }} className="px-4 py-3 text-xs">{formatDate(c.data_vencimento)}</td>
                      <td className="px-4 py-3">
                        <span className={c.recorrente ? 'badge badge-blue' : 'badge badge-gray'}>{c.recorrente ? 'Fixo mensal' : 'Avulso'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button className="btn btn-sm" onClick={() => abrirEdicao(c)}><Edit2 size={12} />Editar</button>
                          <button className="btn btn-sm" style={{ color: '#ef4444' }} onClick={() => excluir(c)}><X size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
