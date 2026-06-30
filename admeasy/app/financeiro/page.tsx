'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
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

  const totalReceber = cobrancas.filter(c => c.status_cobranca === 'pendente').reduce((s, c) => s + c.valor_aluguel, 0)
  const totalRecebido = cobrancas.filter(c => c.status_cobranca === 'pago').reduce((s, c) => s + c.valor_aluguel, 0)
  const totalTaxaAdm = cobrancas.filter(c => c.status_cobranca === 'pago').reduce((s, c) => s + c.valor_taxa_adm, 0)
  const totalRepassar = cobrancas.filter(c => c.status_cobranca === 'pago' && c.status_repasse === 'aguardando').reduce((s, c) => s + c.valor_repasse, 0)

  const hoje = new Date()
  const proximos30 = cobrancas
    .filter(c => {
      const venc = new Date(c.data_vencimento + 'T00:00:00')
      const diff = (venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
      return diff >= -5 && diff <= 30
    })
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))

  const statusIcon = (st: string) => {
    if (st === 'pago') return <CheckCircle size={14} style={{ color: '#3fb950' }} />
    if (st === 'em_atraso') return <AlertCircle size={14} style={{ color: '#ef4444' }} />
    return <Clock size={14} style={{ color: '#f59e0b' }} />
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
      <div style={{ background: '#0d1117', minHeight: '100vh' }} className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1600px] mx-auto">

          <div className="flex items-center justify-between mb-5">
            <h1 style={{ color: '#f4f4f3' }} className="text-lg font-medium">Financeiro — Fluxo de caixa</h1>
            <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? <X size={14} /> : <Plus size={14} />}
              {showForm ? 'Cancelar' : 'Gerar cobrança'}
            </button>
          </div>

          {sucesso && <div style={{ background: '#1a2e1f', border: '0.5px solid #2d4a35', color: '#3fb950' }} className="px-4 py-3 rounded-lg mb-4 text-sm">{sucesso}</div>}

          {/* MÉTRICAS */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="card">
              <div style={{ color: '#8b8d98' }} className="text-xs mb-1 flex items-center gap-1"><Clock size={12} />A receber</div>
              <div style={{ color: '#f59e0b' }} className="text-xl font-semibold">{formatVal(totalReceber)}</div>
              <div style={{ color: '#8b8d98' }} className="text-xs mt-1">{cobrancas.filter(c => c.status_cobranca === 'pendente').length} cobranças pendentes</div>
            </div>
            <div className="card">
              <div style={{ color: '#8b8d98' }} className="text-xs mb-1 flex items-center gap-1"><TrendingUp size={12} />Recebido</div>
              <div style={{ color: '#3fb950' }} className="text-xl font-semibold">{formatVal(totalRecebido)}</div>
              <div style={{ color: '#8b8d98' }} className="text-xs mt-1">{cobrancas.filter(c => c.status_cobranca === 'pago').length} pagamentos confirmados</div>
            </div>
            <div className="card">
              <div style={{ color: '#8b8d98' }} className="text-xs mb-1 flex items-center gap-1"><DollarSign size={12} />Taxa de adm.</div>
              <div style={{ color: '#5b9bf5' }} className="text-xl font-semibold">{formatVal(totalTaxaAdm)}</div>
              <div style={{ color: '#8b8d98' }} className="text-xs mt-1">Receita da imobiliária</div>
            </div>
            <div className="card">
              <div style={{ color: '#8b8d98' }} className="text-xs mb-1 flex items-center gap-1"><TrendingDown size={12} />A repassar</div>
              <div style={{ color: '#f59e0b' }} className="text-xl font-semibold">{formatVal(totalRepassar)}</div>
              <div style={{ color: '#8b8d98' }} className="text-xs mt-1">{cobrancas.filter(c => c.status_repasse === 'aguardando' && c.status_cobranca === 'pago').length} repasses pendentes</div>
            </div>
          </div>

          {/* FORM NOVA COBRANÇA */}
          {showForm && (
            <div className="card mb-6">
              <h2 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-4">Gerar cobrança mensal</h2>
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
                    <div style={{ background: '#16243a', border: '0.5px solid #1e3a5f', color: '#5b9bf5' }} className="col-span-2 rounded-lg p-3 text-xs">
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
                    <div className="input" style={{ background: '#0d1117', color: '#3fb950', fontWeight: 500 }}>
                      {form.valor_aluguel ? formatVal(parseFloat(form.valor_aluguel) * (1 - form.taxa_adm_pct / 100)) : '—'}
                    </div>
                  </div>
                </div>
                {erro && <div style={{ background: '#2e1717', border: '0.5px solid #4a2424', color: '#ef4444' }} className="text-sm px-3 py-2 rounded-lg mt-3">{erro}</div>}
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
          <div style={{ borderBottom: '0.5px solid #2a2f3a' }} className="flex gap-0 mb-4">
            {(['fluxo','cobrancas','repasses'] as const).map(aba => (
              <button key={aba} onClick={() => setAbaAtiva(aba)}
                style={abaAtiva === aba ? { borderBottom: '2px solid #2563eb', color: '#5b9bf5' } : { borderBottom: '2px solid transparent', color: '#8b8d98' }}
                className="px-4 py-2 text-sm font-medium transition-all">
                {aba === 'fluxo' ? 'Fluxo de caixa' : aba === 'cobrancas' ? 'Cobranças' : 'Repasses'}
              </button>
            ))}
          </div>

          {/* FLUXO DE CAIXA */}
          {abaAtiva === 'fluxo' && (
            <div>
              <div style={{ color: '#8b8d98' }} className="text-xs mb-3 font-medium uppercase tracking-wide">Próximos 30 dias — entradas previstas</div>
              {proximos30.length === 0 ? (
                <div className="card text-center py-10" style={{ color: '#8b8d98' }}>
                  <DollarSign size={32} className="mx-auto mb-2 opacity-30" />
                  <div style={{ color: '#c3c2b7' }} className="font-medium">Nenhuma cobrança nos próximos 30 dias</div>
                  <div className="text-sm mt-1">Clique em "Gerar cobrança" para criar cobranças mensais</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {proximos30.map(c => {
                    const venc = new Date(c.data_vencimento + 'T00:00:00')
                    const dias = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
                    const atrasado = dias < 0 && c.status_cobranca === 'pendente'
                    return (
                      <div key={c.id} className="card py-3 px-4 flex items-center gap-4" style={atrasado ? { borderColor: '#4a2424', background: '#1f1414' } : {}}>
                        <div style={{ background: '#0d1117', border: '0.5px solid #2a2f3a' }} className="w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                          <div style={{ color: '#c3c2b7' }} className="text-lg font-bold leading-none">{venc.getDate()}</div>
                          <div style={{ color: '#8b8d98' }} className="text-[10px]">{meses[venc.getMonth()].slice(0,3)}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div style={{ color: '#f4f4f3' }} className="font-medium text-sm">{getTitulo(c.contrato?.imovel) || '—'}</div>
                          <div style={{ color: '#8b8d98' }} className="text-xs">{getNome(c.locatario)} · {c.mes_referencia}</div>
                          {atrasado && <div style={{ color: '#ef4444' }} className="text-xs font-medium">{Math.abs(dias)} dias em atraso</div>}
                          {!atrasado && dias >= 0 && dias <= 7 && <div style={{ color: '#f59e0b' }} className="text-xs">Vence em {dias} dias</div>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div style={{ color: '#f4f4f3' }} className="font-semibold">{formatVal(c.valor_aluguel)}</div>
                          <div style={{ color: '#8b8d98' }} className="text-xs">Taxa: {formatVal(c.valor_taxa_adm)} · Repasse: {formatVal(c.valor_repasse)}</div>
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
                <div style={{ color: '#8b8d98' }} className="text-center py-10 text-sm">Carregando...</div>
              ) : cobrancas.length === 0 ? (
                <div style={{ color: '#8b8d98' }} className="text-center py-10 text-sm">Nenhuma cobrança cadastrada</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '0.5px solid #2a2f3a' }}>
                      {['Imóvel / Locatário','Referência','Vencimento','Aluguel','Taxa adm.','Repasse','Status',''].map(h => (
                        <th key={h} style={{ color: '#8b8d98' }} className="text-left px-4 py-3 text-xs font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cobrancas.map(c => (
                      <tr key={c.id} style={{ borderBottom: '0.5px solid #1c2128' }} className="hover:bg-[#161b22]">
                        <td className="px-4 py-3">
                          <div style={{ color: '#f4f4f3' }} className="font-medium text-sm">{getTitulo(c.contrato?.imovel) || '—'}</div>
                          <div style={{ color: '#8b8d98' }} className="text-xs">{getNome(c.locatario)}</div>
                        </td>
                        <td style={{ color: '#8b8d98' }} className="px-4 py-3 text-xs capitalize">{c.mes_referencia}</td>
                        <td style={{ color: '#8b8d98' }} className="px-4 py-3 text-xs">{formatDate(c.data_vencimento)}</td>
                        <td style={{ color: '#f4f4f3' }} className="px-4 py-3 font-medium text-sm">{formatVal(c.valor_aluguel)}</td>
                        <td className="px-4 py-3 text-xs">
                          <div style={{ color: '#5b9bf5' }} className="font-medium">{formatVal(c.valor_taxa_adm)}</div>
                          <div style={{ color: '#8b8d98' }}>{c.taxa_administracao_pct}%</div>
                        </td>
                        <td style={{ color: '#3fb950' }} className="px-4 py-3 text-sm font-medium">{formatVal(c.valor_repasse)}</td>
                        <td className="px-4 py-3">
                          <span className={statusCobrancaBadge[c.status_cobranca] || 'badge badge-gray'}>
                            {c.status_cobranca === 'pendente' ? 'Pendente' : c.status_cobranca === 'pago' ? 'Pago' : c.status_cobranca}
                          </span>
                          {c.data_pagamento && <div style={{ color: '#8b8d98' }} className="text-xs mt-1">{formatDate(c.data_pagamento)}</div>}
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
                  <tr style={{ borderBottom: '0.5px solid #2a2f3a' }}>
                    {['Locador','Imóvel','Referência','Aluguel','Taxa adm.','Repasse líquido','Prev. repasse','Status',''].map(h => (
                      <th key={h} style={{ color: '#8b8d98' }} className="text-left px-4 py-3 text-xs font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cobrancas.filter(c => c.status_cobranca === 'pago').map(c => (
                    <tr key={c.id} style={{ borderBottom: '0.5px solid #1c2128' }} className="hover:bg-[#161b22]">
                      <td style={{ color: '#f4f4f3' }} className="px-4 py-3 font-medium text-sm">{getNome(c.locador) || '—'}</td>
                      <td style={{ color: '#8b8d98' }} className="px-4 py-3 text-xs">{getTitulo(c.contrato?.imovel) || '—'}</td>
                      <td style={{ color: '#8b8d98' }} className="px-4 py-3 text-xs capitalize">{c.mes_referencia}</td>
                      <td style={{ color: '#f4f4f3' }} className="px-4 py-3 text-sm">{formatVal(c.valor_aluguel)}</td>
                      <td style={{ color: '#5b9bf5' }} className="px-4 py-3 text-xs font-medium">− {formatVal(c.valor_taxa_adm)}</td>
                      <td style={{ color: '#3fb950' }} className="px-4 py-3 font-semibold">{formatVal(c.valor_repasse)}</td>
                      <td style={{ color: '#8b8d98' }} className="px-4 py-3 text-xs">{formatDate(c.data_repasse_prevista)}</td>
                      <td className="px-4 py-3">
                        <span className={statusRepasseBadge[c.status_repasse] || 'badge badge-gray'}>
                          {c.status_repasse === 'aguardando' ? 'Aguardando' : c.status_repasse === 'repassado' ? 'Repassado' : c.status_repasse}
                        </span>
                        {c.data_repasse_realizada && <div style={{ color: '#8b8d98' }} className="text-xs mt-1">{formatDate(c.data_repasse_realizada)}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {c.status_repasse === 'aguardando' && (
                          <button className="btn btn-primary text-xs py-1 px-2" onClick={() => marcarRepassado(c.id)}>Repassado</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {cobrancas.filter(c => c.status_cobranca === 'pago').length === 0 && (
                    <tr><td colSpan={9} style={{ color: '#8b8d98' }} className="text-center py-10 text-sm">Nenhum repasse pendente — confirme pagamentos primeiro</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
