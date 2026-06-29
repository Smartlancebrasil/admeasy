'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { supabase } from '@/lib/supabase'
import { Plus, X, DollarSign, TrendingUp, TrendingDown, Clock, CheckCircle, AlertCircle } from 'lucide-react'

type Cobranca = {
  id: string
  mes_referencia: string
  valor_aluguel: number
  taxa_administracao_pct: number
  valor_taxa_adm: number
  valor_repasse: number
  data_vencimento: string
  data_pagamento?: string
  status_cobranca: string
  data_repasse_prevista?: string
  data_repasse_realizada?: string
  status_repasse: string
  contrato?: { numero: string; imovel?: { titulo: string } }
  locatario?: { nome: string }
  locador?: { nome: string }
}

type Contrato = {
  id: string
  numero: string
  valor_mensal: number
  taxa_administracao: number
  dia_vencimento: number
  imovel?: { titulo: string } | { titulo: string }[]
  locatario?: { nome: string } | { nome: string }[]
  locador?: { nome: string } | { nome: string }[]
}

function getNome(val?: { nome: string } | { nome: string }[]): string {
  if (!val) return '—'
  if (Array.isArray(val)) return val[0]?.nome || '—'
  return val.nome || '—'
}

function getTitulo(val?: { titulo: string } | { titulo: string }[]): string {
  if (!val) return '—'
  if (Array.isArray(val)) return val[0]?.titulo || '—'
  return val.titulo || '—'
}

function formatVal(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

function formatDate(date?: string) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date + 'T00:00:00'))
}

const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function FinanceiroPage() {
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [filtroMes, setFiltroMes] = useState(() => {
    const hoje = new Date()
    return `${meses[hoje.getMonth()].toLowerCase()}/${hoje.getFullYear()}`
  })
  const [abaAtiva, setAbaAtiva] = useState<'fluxo'|'cobrancas'|'repasses'>('fluxo')

  const [form, setForm] = useState({
    contrato_id: '',
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    dia_vencimento: 10,
    taxa_adm_pct: 10,
    valor_aluguel: '',
  })

  const [contratoSel, setContratoSel] = useState<Contrato | null>(null)

  useEffect(() => { buscarCobrancas(); buscarContratos() }, [])

  async function buscarCobrancas() {
    setLoading(true)
    const { data } = await supabase
      .from('cobrancas')
      .select(`*, contrato:contratos(numero, imovel:imoveis(titulo)), locatario:clientes!cobrancas_locatario_id_fkey(nome), locador:clientes!cobrancas_locador_id_fkey(nome)`)
      .order('data_vencimento', { ascending: true })
    if (data) setCobrancas(data)
    setLoading(false)
  }

  async function buscarContratos() {
    const { data } = await supabase
      .from('contratos')
      .select(`id, numero, valor_mensal, taxa_administracao, dia_vencimento, imovel:imoveis(titulo), locatario:clientes!contratos_locatario_id_fkey(nome), locador:clientes!contratos_locador_id_fkey(nome)`)
      .eq('status', 'ativo')
    if (data) setContratos(data)
  }

  function selecionarContrato(id: string) {
    const c = contratos.find(x => x.id === id)
    setContratoSel(c || null)
    if (c) {
      setForm(f => ({
        ...f,
        contrato_id: id,
        taxa_adm_pct: c.taxa_administracao || 10,
        dia_vencimento: c.dia_vencimento || 10,
        valor_aluguel: String(c.valor_mensal || ''),
      }))
    }
  }

  async function gerarCobranca(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro('')

    if (!contratoSel) { setErro('Selecione um contrato'); setSalvando(false); return }

    const valor = parseFloat(form.valor_aluguel)
    const taxaPct = form.taxa_adm_pct
    const valorTaxa = valor * (taxaPct / 100)
    const valorRepasse = valor - valorTaxa

    const mesNome = meses[form.mes - 1].toLowerCase()
    const mesRef = `${mesNome}/${form.ano}`
    const competencia = `${form.ano}-${String(form.mes).padStart(2,'0')}-01`
    const dataVenc = `${form.ano}-${String(form.mes).padStart(2,'0')}-${String(form.dia_vencimento).padStart(2,'0')}`

    // Data de repasse = 2 dias após o vencimento
    const dataRepasse = new Date(dataVenc + 'T00:00:00')
    dataRepasse.setDate(dataRepasse.getDate() + 2)
    const dataRepasseStr = dataRepasse.toISOString().split('T')[0]

    const payload = {
      contrato_id: form.contrato_id,
      locatario_id: contratoSel.locatario ? (await supabase.from('contratos').select('locatario_id').eq('id', form.contrato_id).single()).data?.locatario_id : null,
      locador_id: contratoSel.locador ? (await supabase.from('contratos').select('locador_id').eq('id', form.contrato_id).single()).data?.locador_id : null,
      mes_referencia: mesRef,
      competencia,
      valor_aluguel: valor,
      taxa_administracao_pct: taxaPct,
      valor_taxa_adm: valorTaxa,
      valor_repasse: valorRepasse,
      data_vencimento: dataVenc,
      status_cobranca: 'pendente',
      data_repasse_prevista: dataRepasseStr,
      status_repasse: 'aguardando',
    }

    const { error } = await supabase.from('cobrancas').insert([payload])
    if (error) {
      setErro('Erro: ' + error.message)
    } else {
      setSucesso(`Cobrança de ${mesRef} gerada!`)
      setShowForm(false)
      buscarCobrancas()
      setTimeout(() => setSucesso(''), 3000)
    }
    setSalvando(false)
  }

  async function marcarPago(id: string) {
    const hoje = new Date().toISOString().split('T')[0]
    await supabase.from('cobrancas').update({
      status_cobranca: 'pago',
      data_pagamento: hoje,
      status_repasse: 'aguardando',
    }).eq('id', id)
    buscarCobrancas()
  }

  async function marcarRepassado(id: string) {
    const hoje = new Date().toISOString().split('T')[0]
    await supabase.from('cobrancas').update({
      status_repasse: 'repassado',
      data_repasse_realizada: hoje,
    }).eq('id', id)
    buscarCobrancas()
  }

  // Métricas
  const totalReceber = cobrancas.filter(c => c.status_cobranca === 'pendente').reduce((s, c) => s + c.valor_aluguel, 0)
  const totalRecebido = cobrancas.filter(c => c.status_cobranca === 'pago').reduce((s, c) => s + c.valor_aluguel, 0)
  const totalTaxaAdm = cobrancas.filter(c => c.status_cobranca === 'pago').reduce((s, c) => s + c.valor_taxa_adm, 0)
  const totalRepassar = cobrancas.filter(c => c.status_cobranca === 'pago' && c.status_repasse === 'aguardando').reduce((s, c) => s + c.valor_repasse, 0)

  // Agrupar por dia de vencimento para fluxo de caixa
  const hoje = new Date()
  const proximos30 = cobrancas
    .filter(c => {
      const venc = new Date(c.data_vencimento + 'T00:00:00')
      const diff = (venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
      return diff >= -5 && diff <= 30
    })
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))

  const statusIcon = (st: string) => {
    if (st === 'pago') return <CheckCircle size={14} className="text-green-500" />
    if (st === 'em_atraso') return <AlertCircle size={14} className="text-red-500" />
    return <Clock size={14} className="text-yellow-500" />
  }

  const statusCobrancaBadge: Record<string, string> = {
    pendente: 'badge badge-yellow',
    pago: 'badge badge-green',
    em_atraso: 'badge badge-red',
    cancelado: 'badge badge-gray',
  }

  const statusRepasseBadge: Record<string, string> = {
    aguardando: 'badge badge-yellow',
    repassado: 'badge badge-green',
    cancelado: 'badge badge-gray',
  }

  return (
    <AppLayout>
      <Topbar titulo="Financeiro — Fluxo de caixa">
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancelar' : 'Gerar cobrança'}
        </button>
      </Topbar>

      <div className="flex-1 overflow-y-auto p-6">
        {sucesso && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">{sucesso}</div>}

        {/* MÉTRICAS */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="card">
            <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Clock size={12} />A receber</div>
            <div className="text-xl font-semibold text-yellow-600">{formatVal(totalReceber)}</div>
            <div className="text-xs text-gray-400 mt-1">{cobrancas.filter(c => c.status_cobranca === 'pendente').length} cobranças pendentes</div>
          </div>
          <div className="card">
            <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><TrendingUp size={12} />Recebido</div>
            <div className="text-xl font-semibold text-green-600">{formatVal(totalRecebido)}</div>
            <div className="text-xs text-gray-400 mt-1">{cobrancas.filter(c => c.status_cobranca === 'pago').length} pagamentos confirmados</div>
          </div>
          <div className="card">
            <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><DollarSign size={12} />Taxa de adm.</div>
            <div className="text-xl font-semibold text-blue-600">{formatVal(totalTaxaAdm)}</div>
            <div className="text-xs text-gray-400 mt-1">Receita da imobiliária</div>
          </div>
          <div className="card">
            <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><TrendingDown size={12} />A repassar</div>
            <div className="text-xl font-semibold text-orange-600">{formatVal(totalRepassar)}</div>
            <div className="text-xs text-gray-400 mt-1">{cobrancas.filter(c => c.status_repasse === 'aguardando' && c.status_cobranca === 'pago').length} repasses pendentes</div>
          </div>
        </div>

        {/* FORM NOVA COBRANÇA */}
        {showForm && (
          <div className="card mb-6">
            <h2 className="text-sm font-semibold mb-4">Gerar cobrança mensal</h2>
            <form onSubmit={gerarCobranca}>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Contrato *</label>
                  <select className="input" required value={form.contrato_id} onChange={e => selecionarContrato(e.target.value)}>
                    <option value="">Selecionar contrato</option>
                    {contratos.map(c => (
                      <option key={c.id} value={c.id}>#{c.numero} — {getTitulo(c.imovel)} · {getNome(c.locatario)}</option>
                    ))}
                  </select>
                </div>
                {contratoSel && (
                  <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                    <strong>Locador:</strong> {getNome(contratoSel.locador)} · <strong>Valor base:</strong> {formatVal(contratoSel.valor_mensal)}
                  </div>
                )}
                <div>
                  <label className="label">Mês de referência</label>
                  <select className="input" value={form.mes} onChange={e => setForm({...form, mes: parseInt(e.target.value)})}>
                    {meses.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Ano</label>
                  <input className="input" type="number" value={form.ano} onChange={e => setForm({...form, ano: parseInt(e.target.value)})} />
                </div>
                <div>
                  <label className="label">Valor do aluguel (R$)</label>
                  <input className="input" type="number" required value={form.valor_aluguel} onChange={e => setForm({...form, valor_aluguel: e.target.value})} placeholder="0,00" />
                </div>
                <div>
                  <label className="label">Dia de vencimento</label>
                  <input className="input" type="number" min="1" max="28" value={form.dia_vencimento} onChange={e => setForm({...form, dia_vencimento: parseInt(e.target.value)})} />
                </div>
                <div>
                  <label className="label">Taxa de administração (%)</label>
                  <input className="input" type="number" step="0.5" value={form.taxa_adm_pct} onChange={e => setForm({...form, taxa_adm_pct: parseFloat(e.target.value)})} />
                </div>
                <div>
                  <label className="label">Prévia do repasse ao locador</label>
                  <div className="input bg-gray-50 text-green-700 font-medium">
                    {form.valor_aluguel ? formatVal(parseFloat(form.valor_aluguel) * (1 - form.taxa_adm_pct / 100)) : '—'}
                  </div>
                </div>
              </div>
              {erro && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg mt-3">{erro}</div>}
              <div className="flex gap-2 mt-4">
                <button type="submit" disabled={salvando} className="btn btn-primary">
                  {salvando ? 'Gerando...' : 'Gerar cobrança'}
                </button>
                <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* ABAS */}
        <div className="flex gap-0 border-b border-gray-200 mb-4">
          {(['fluxo','cobrancas','repasses'] as const).map(aba => (
            <button key={aba} onClick={() => setAbaAtiva(aba)}
              className={`px-4 py-2 text-sm border-b-2 transition-all ${abaAtiva === aba ? 'border-blue-500 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {aba === 'fluxo' ? 'Fluxo de caixa' : aba === 'cobrancas' ? 'Cobranças' : 'Repasses'}
            </button>
          ))}
        </div>

        {/* FLUXO DE CAIXA */}
        {abaAtiva === 'fluxo' && (
          <div>
            <div className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">Próximos 30 dias — entradas previstas</div>
            {proximos30.length === 0 ? (
              <div className="card text-center py-10 text-gray-400">
                <DollarSign size={32} className="mx-auto mb-2 opacity-30" />
                <div className="font-medium text-gray-500">Nenhuma cobrança nos próximos 30 dias</div>
                <div className="text-sm mt-1">Clique em "Gerar cobrança" para criar cobranças mensais</div>
              </div>
            ) : (
              <div className="space-y-2">
                {proximos30.map(c => {
                  const venc = new Date(c.data_vencimento + 'T00:00:00')
                  const dias = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
                  const atrasado = dias < 0 && c.status_cobranca === 'pendente'
                  return (
                    <div key={c.id} className={`card py-3 px-4 flex items-center gap-4 ${atrasado ? 'border-red-200 bg-red-50' : ''}`}>
                      <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-center justify-center flex-shrink-0">
                        <div className="text-lg font-bold text-gray-700 leading-none">{venc.getDate()}</div>
                        <div className="text-[10px] text-gray-400">{meses[venc.getMonth()].slice(0,3)}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900">{getTitulo(c.contrato?.imovel) || '—'}</div>
                        <div className="text-xs text-gray-400">{getNome(c.locatario)} · {c.mes_referencia}</div>
                        {atrasado && <div className="text-xs text-red-600 font-medium">{Math.abs(dias)} dias em atraso</div>}
                        {!atrasado && dias >= 0 && dias <= 7 && <div className="text-xs text-yellow-600">Vence em {dias} dias</div>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-semibold text-gray-900">{formatVal(c.valor_aluguel)}</div>
                        <div className="text-xs text-gray-400">Taxa: {formatVal(c.valor_taxa_adm)} · Repasse: {formatVal(c.valor_repasse)}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {statusIcon(c.status_cobranca)}
                        <span className={statusCobrancaBadge[c.status_cobranca] || 'badge badge-gray'}>
                          {c.status_cobranca === 'pendente' ? 'Pendente' : c.status_cobranca === 'pago' ? 'Pago' : 'Atraso'}
                        </span>
                        {c.status_cobranca === 'pendente' && (
                          <button className="btn btn-success text-xs py-1 px-2" onClick={() => marcarPago(c.id)}>
                            Confirmar pagamento
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* COBRANÇAS */}
        {abaAtiva === 'cobrancas' && (
          <div className="card p-0 overflow-hidden">
            {loading ? (
              <div className="text-center py-10 text-gray-400 text-sm">Carregando...</div>
            ) : cobrancas.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">Nenhuma cobrança cadastrada</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Imóvel / Locatário</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Referência</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Vencimento</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Aluguel</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Taxa adm.</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Repasse</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {cobrancas.map(c => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 text-sm">{getTitulo(c.contrato?.imovel) || '—'}</div>
                        <div className="text-xs text-gray-400">{getNome(c.locatario)}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 capitalize">{c.mes_referencia}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDate(c.data_vencimento)}</td>
                      <td className="px-4 py-3 font-medium text-sm">{formatVal(c.valor_aluguel)}</td>
                      <td className="px-4 py-3 text-xs">
                        <div className="text-blue-600 font-medium">{formatVal(c.valor_taxa_adm)}</div>
                        <div className="text-gray-400">{c.taxa_administracao_pct}%</div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">{formatVal(c.valor_repasse)}</td>
                      <td className="px-4 py-3">
                        <span className={statusCobrancaBadge[c.status_cobranca] || 'badge badge-gray'}>
                          {c.status_cobranca === 'pendente' ? 'Pendente' : c.status_cobranca === 'pago' ? 'Pago' : c.status_cobranca}
                        </span>
                        {c.data_pagamento && <div className="text-xs text-gray-400 mt-1">{formatDate(c.data_pagamento)}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {c.status_cobranca === 'pendente' && (
                          <button className="btn btn-success text-xs py-1 px-2" onClick={() => marcarPago(c.id)}>Pago</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* REPASSES */}
        {abaAtiva === 'repasses' && (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Locador</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Imóvel</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Referência</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Aluguel</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Taxa adm.</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Repasse líquido</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Prev. repasse</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {cobrancas.filter(c => c.status_cobranca === 'pago').map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-sm">{getNome(c.locador) || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{getTitulo(c.contrato?.imovel) || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 capitalize">{c.mes_referencia}</td>
                    <td className="px-4 py-3 text-sm">{formatVal(c.valor_aluguel)}</td>
                    <td className="px-4 py-3 text-xs text-blue-600 font-medium">− {formatVal(c.valor_taxa_adm)}</td>
                    <td className="px-4 py-3 font-semibold text-green-600">{formatVal(c.valor_repasse)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(c.data_repasse_prevista)}</td>
                    <td className="px-4 py-3">
                      <span className={statusRepasseBadge[c.status_repasse] || 'badge badge-gray'}>
                        {c.status_repasse === 'aguardando' ? 'Aguardando' : c.status_repasse === 'repassado' ? 'Repassado' : c.status_repasse}
                      </span>
                      {c.data_repasse_realizada && <div className="text-xs text-gray-400 mt-1">{formatDate(c.data_repasse_realizada)}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {c.status_repasse === 'aguardando' && (
                        <button className="btn btn-primary text-xs py-1 px-2" onClick={() => marcarRepassado(c.id)}>Repassado</button>
                      )}
                    </td>
                  </tr>
                ))}
                {cobrancas.filter(c => c.status_cobranca === 'pago').length === 0 && (
                  <tr><td colSpan={9} className="text-center py-10 text-gray-400 text-sm">Nenhum repasse pendente — confirme pagamentos primeiro</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
