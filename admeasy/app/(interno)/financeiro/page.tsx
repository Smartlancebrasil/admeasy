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

type Despesa = {
  id: string
  descricao: string
  valor: number
  data_vencimento: string
  data_pagamento?: string
  status: string
  recorrente: boolean
  fornecedor?: { nome: string }
}

type Contrato = {
  id: string
  numero: string
  valor_mensal: number
  taxa_administracao: number
  dia_vencimento: number
  data_inicio?: string
  honorarios_aplicavel?: boolean
  valor_honorarios?: number
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

function adicionarDias(dataStr: string, dias: number) {
  const d = new Date(dataStr + 'T00:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
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
  const [abaAtiva, setAbaAtiva] = useState<'fluxo'|'cobrancas'|'repasses'|'previsto'>('fluxo')
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [honorariosPendentes, setHonorariosPendentes] = useState<{ contratoId: string; imovel: string; valor: number; dataPrevista: string }[]>([])
  const [showFormDespesa, setShowFormDespesa] = useState(false)
  const [formDespesa, setFormDespesa] = useState({ descricao: '', valor: '', data_vencimento: '', recorrente: false })
  const [salvandoDespesa, setSalvandoDespesa] = useState(false)

  const [form, setForm] = useState({
    contrato_id: '',
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    dia_vencimento: 10,
    taxa_adm_pct: 10,
    valor_aluguel: '',
  })

  const [contratoSel, setContratoSel] = useState<Contrato | null>(null)

  useEffect(() => { buscarCobrancas(); buscarContratos(); buscarDespesas() }, [])

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
      .select(`id, numero, valor_mensal, taxa_administracao, dia_vencimento, data_inicio, honorarios_aplicavel, valor_honorarios, imovel:imoveis(titulo), locatario:clientes!contratos_locatario_id_fkey(nome), locador:clientes!contratos_locador_id_fkey(nome)`)
      .eq('status', 'ativo')
    if (data) {
      setContratos(data)
      await calcularHonorariosPendentes(data)
    }
  }

  async function calcularHonorariosPendentes(contratosAtivos: Contrato[]) {
    const comHonorario = contratosAtivos.filter(c => c.honorarios_aplicavel)
    if (comHonorario.length === 0) { setHonorariosPendentes([]); return }
    const ids = comHonorario.map(c => c.id)
    const { data: cobrancasHon } = await supabase
      .from('cobrancas')
      .select('contrato_id, data_vencimento, status_cobranca')
      .in('contrato_id', ids)
      .order('data_vencimento', { ascending: true })

    const primeiraPorContrato: Record<string, any> = {}
    cobrancasHon?.forEach(c => { if (!primeiraPorContrato[c.contrato_id]) primeiraPorContrato[c.contrato_id] = c })

    const pendentes = comHonorario
      .filter(c => primeiraPorContrato[c.id]?.status_cobranca !== 'pago')
      .map(c => ({
        contratoId: c.id,
        imovel: getTitulo(c.imovel),
        valor: c.valor_honorarios || 0,
        dataPrevista: primeiraPorContrato[c.id]?.data_vencimento || (c.data_inicio ? adicionarDias(c.data_inicio, 30) : ''),
      }))
    setHonorariosPendentes(pendentes)
  }

  async function buscarDespesas() {
    const { data } = await supabase
      .from('despesas')
      .select('*, fornecedor:fornecedores(nome)')
      .order('data_vencimento', { ascending: true })
    if (data) setDespesas(data)
  }

  async function salvarDespesa(e: React.FormEvent) {
    e.preventDefault()
    setSalvandoDespesa(true)
    const { error } = await supabase.from('despesas').insert([{
      descricao: formDespesa.descricao,
      valor: parseFloat(formDespesa.valor) || 0,
      data_vencimento: formDespesa.data_vencimento,
      recorrente: formDespesa.recorrente,
      status: 'pendente',
    }])
    if (!error) {
      setFormDespesa({ descricao: '', valor: '', data_vencimento: '', recorrente: false })
      setShowFormDespesa(false)
      buscarDespesas()
    }
    setSalvandoDespesa(false)
  }

  async function marcarDespesaPaga(id: string) {
    const hoje = new Date().toISOString().split('T')[0]
    await supabase.from('despesas').update({ status: 'pago', data_pagamento: hoje }).eq('id', id)
    buscarDespesas()
  }

  async function selecionarContrato(id: string) {
    const c = contratos.find(x => x.id === id)
    setContratoSel(c || null)
    if (!c) return

    let mesSugerido = form.mes
    let anoSugerido = form.ano
    let diaSugerido = c.dia_vencimento || 10

    // Se ainda não existe nenhuma cobrança pra este contrato, a 1ª data de
    // vencimento é 30 dias após o início do contrato — não o "dia fixo" do mês
    const { count } = await supabase
      .from('cobrancas')
      .select('id', { count: 'exact', head: true })
      .eq('contrato_id', id)

    if ((count || 0) === 0 && c.data_inicio) {
      const dataPrimeira = adicionarDias(c.data_inicio, 30)
      const [ano, mes, dia] = dataPrimeira.split('-').map(Number)
      mesSugerido = mes
      anoSugerido = ano
      diaSugerido = dia
    }

    setForm(f => ({
      ...f,
      contrato_id: id,
      mes: mesSugerido,
      ano: anoSugerido,
      taxa_adm_pct: c.taxa_administracao || 10,
      dia_vencimento: diaSugerido,
      valor_aluguel: String(c.valor_mensal || ''),
    }))
  }

  async function gerarCobranca(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro('')

    if (!contratoSel) { setErro('Selecione um contrato'); setSalvando(false); return }

    const valor = parseFloat(form.valor_aluguel)
    const taxaPct = form.taxa_adm_pct

    // Se o contrato cobra honorários de locação, a 1ª cobrança fica 100%
    // com a imobiliária (nenhum repasse ao proprietário nesse mês)
    let ehPrimeiraCobranca = false
    if (contratoSel.honorarios_aplicavel) {
      const { count } = await supabase
        .from('cobrancas')
        .select('id', { count: 'exact', head: true })
        .eq('contrato_id', form.contrato_id)
      ehPrimeiraCobranca = (count || 0) === 0
    }

    const valorTaxa = ehPrimeiraCobranca ? valor : valor * (taxaPct / 100)
    const valorRepasse = ehPrimeiraCobranca ? 0 : valor - valorTaxa

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

  async function excluirCobranca(id: string) {
    if (!confirm('Excluir esta cobrança? Essa ação não pode ser desfeita.')) return
    const { error } = await supabase.from('cobrancas').delete().eq('id', id)
    if (error) {
      alert('Erro ao excluir: ' + error.message)
    } else {
      buscarCobrancas()
    }
  }

  function ehHonorario(c: Cobranca) {
    return c.valor_repasse === 0 && c.valor_taxa_adm === c.valor_aluguel && c.valor_aluguel > 0
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

  const despesasPendentes = despesas.filter(d => d.status === 'pendente')

  const entradasPrevistas = [
    ...cobrancas.filter(c => c.status_cobranca === 'pendente').map(c => ({
      tipo: 'aluguel' as const,
      descricao: getTitulo(c.contrato?.imovel) || '—',
      subdescricao: getNome(c.locatario),
      valor: c.valor_aluguel,
      data: c.data_vencimento,
    })),
    ...honorariosPendentes.map(h => ({
      tipo: 'honorario' as const,
      descricao: h.imovel,
      subdescricao: 'Honorários de locação',
      valor: h.valor,
      data: h.dataPrevista,
    })),
  ].sort((a, b) => a.data.localeCompare(b.data))

  const saidasPrevistas = [
    ...cobrancas.filter(c => c.status_cobranca === 'pago' && c.status_repasse === 'aguardando').map(c => ({
      tipo: 'repasse' as const,
      descricao: getNome(c.locador),
      subdescricao: getTitulo(c.contrato?.imovel) || '—',
      valor: c.valor_repasse,
      data: c.data_repasse_prevista || c.data_vencimento,
    })),
    ...despesasPendentes.map(d => ({
      tipo: 'despesa' as const,
      id: d.id,
      descricao: d.descricao,
      subdescricao: d.fornecedor?.nome || (d.recorrente ? 'Despesa recorrente' : 'Despesa avulsa'),
      valor: d.valor,
      data: d.data_vencimento,
    })),
  ].sort((a, b) => a.data.localeCompare(b.data))

  const totalEntradasPrevistas = entradasPrevistas.reduce((s, e) => s + e.valor, 0)
  const totalSaidasPrevistas = saidasPrevistas.reduce((s, e) => s + e.valor, 0)
  const saldoPrevisto = totalEntradasPrevistas - totalSaidasPrevistas

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
            {(['fluxo','cobrancas','repasses','previsto'] as const).map(aba => (
              <button key={aba} onClick={() => setAbaAtiva(aba)}
                style={abaAtiva === aba ? { borderBottom: '2px solid #2563eb', color: '#5b9bf5' } : { borderBottom: '2px solid transparent', color: '#8b8d98' }}
                className="px-4 py-2 text-sm font-medium transition-all">
                {aba === 'fluxo' ? 'Fluxo de caixa' : aba === 'cobrancas' ? 'Cobranças' : aba === 'repasses' ? 'Repasses' : 'Previsto'}
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
                          <div style={{ color: '#f4f4f3' }} className="font-medium text-sm flex items-center gap-1.5">
                            {getTitulo(c.contrato?.imovel) || '—'}
                            {ehHonorario(c) && (
                              <span style={{ background: '#3987e522', color: '#5b9bf5' }} className="text-[9px] font-semibold px-1.5 py-0.5 rounded">Honorários</span>
                            )}
                          </div>
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
                          <button
                            className="btn text-xs py-1 px-2"
                            style={{ color: '#ef4444', borderColor: '#4a2424' }}
                            onClick={() => excluirCobranca(c.id)}
                            title="Excluir cobrança"
                          >
                            Excluir
                          </button>
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
                      {['Imóvel / Locatário','Referência','Vencimento','Aluguel','Honorários','Taxa adm.','Repasse','Status',''].map(h => (
                        <th key={h} style={{ color: '#8b8d98' }} className="text-left px-4 py-3 text-xs font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cobrancas.map(c => (
                      <tr key={c.id} style={{ borderBottom: '0.5px solid #1c2128' }} className="hover:bg-[#161b22]">
                        <td className="px-4 py-3">
                          <div style={{ color: '#f4f4f3' }} className="font-medium text-sm flex items-center gap-1.5">
                            {getTitulo(c.contrato?.imovel) || '—'}
                            {ehHonorario(c) && (
                              <span style={{ background: '#3987e522', color: '#5b9bf5' }} className="text-[9px] font-semibold px-1.5 py-0.5 rounded">Honorários</span>
                            )}
                          </div>
                          <div style={{ color: '#8b8d98' }} className="text-xs">{getNome(c.locatario)}</div>
                        </td>
                        <td style={{ color: '#8b8d98' }} className="px-4 py-3 text-xs capitalize">{c.mes_referencia}</td>
                        <td style={{ color: '#8b8d98' }} className="px-4 py-3 text-xs">{formatDate(c.data_vencimento)}</td>
                        <td style={{ color: '#f4f4f3' }} className="px-4 py-3 font-medium text-sm">{formatVal(c.valor_aluguel)}</td>
                        <td className="px-4 py-3 text-xs">
                          {ehHonorario(c)
                            ? <div style={{ color: '#5b9bf5' }} className="font-medium">{formatVal(c.valor_taxa_adm)}</div>
                            : <div style={{ color: '#5b5e6b' }}>—</div>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {ehHonorario(c)
                            ? <div style={{ color: '#5b5e6b' }}>—</div>
                            : <>
                                <div style={{ color: '#5b9bf5' }} className="font-medium">{formatVal(c.valor_taxa_adm)}</div>
                                <div style={{ color: '#8b8d98' }}>{c.taxa_administracao_pct}%</div>
                              </>}
                        </td>
                        <td style={{ color: '#3fb950' }} className="px-4 py-3 text-sm font-medium">{formatVal(c.valor_repasse)}</td>
                        <td className="px-4 py-3">
                          <span className={statusCobrancaBadge[c.status_cobranca] || 'badge badge-gray'}>
                            {c.status_cobranca === 'pendente' ? 'Pendente' : c.status_cobranca === 'pago' ? 'Pago' : c.status_cobranca}
                          </span>
                          {c.data_pagamento && <div style={{ color: '#8b8d98' }} className="text-xs mt-1">{formatDate(c.data_pagamento)}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {c.status_cobranca === 'pendente' && (
                              <button className="btn btn-success text-xs py-1 px-2" onClick={() => marcarPago(c.id)}>Pago</button>
                            )}
                            <button
                              className="btn text-xs py-1 px-2"
                              style={{ color: '#ef4444', borderColor: '#4a2424' }}
                              onClick={() => excluirCobranca(c.id)}
                              title="Excluir cobrança"
                            >
                              Excluir
                            </button>
                          </div>
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
          {/* PREVISTO */}
          {abaAtiva === 'previsto' && (
            <div>
              <div className="grid grid-cols-3 gap-4 mb-5">
                <div className="card">
                  <div style={{ color: '#8b8d98' }} className="text-xs mb-1 flex items-center gap-1"><TrendingUp size={12} />Entradas previstas</div>
                  <div style={{ color: '#3fb950' }} className="text-xl font-semibold">{formatVal(totalEntradasPrevistas)}</div>
                  <div style={{ color: '#8b8d98' }} className="text-xs mt-1">{entradasPrevistas.length} lançamento(s)</div>
                </div>
                <div className="card">
                  <div style={{ color: '#8b8d98' }} className="text-xs mb-1 flex items-center gap-1"><TrendingDown size={12} />Saídas previstas</div>
                  <div style={{ color: '#ef4444' }} className="text-xl font-semibold">{formatVal(totalSaidasPrevistas)}</div>
                  <div style={{ color: '#8b8d98' }} className="text-xs mt-1">{saidasPrevistas.length} lançamento(s)</div>
                </div>
                <div className="card">
                  <div style={{ color: '#8b8d98' }} className="text-xs mb-1 flex items-center gap-1"><DollarSign size={12} />Saldo previsto</div>
                  <div style={{ color: saldoPrevisto >= 0 ? '#3fb950' : '#ef4444' }} className="text-xl font-semibold">{formatVal(saldoPrevisto)}</div>
                  <div style={{ color: '#8b8d98' }} className="text-xs mt-1">Entradas − saídas pendentes</div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <div style={{ color: '#8b8d98' }} className="text-xs font-medium uppercase tracking-wide">Despesas fixas cadastradas</div>
                <button className="btn btn-sm" onClick={() => setShowFormDespesa(!showFormDespesa)}>
                  {showFormDespesa ? <X size={13} /> : <Plus size={13} />}
                  {showFormDespesa ? 'Cancelar' : 'Nova despesa'}
                </button>
              </div>

              {showFormDespesa && (
                <div className="card mb-4">
                  <form onSubmit={salvarDespesa}>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-3">
                        <label className="label">Descrição *</label>
                        <input className="input" required value={formDespesa.descricao} onChange={e => setFormDespesa(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Aluguel do escritório, Internet, Contador..." />
                      </div>
                      <div>
                        <label className="label">Valor (R$) *</label>
                        <input className="input" type="number" step="0.01" required value={formDespesa.valor} onChange={e => setFormDespesa(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
                      </div>
                      <div>
                        <label className="label">Vencimento *</label>
                        <input className="input" type="date" required value={formDespesa.data_vencimento} onChange={e => setFormDespesa(f => ({ ...f, data_vencimento: e.target.value }))} />
                      </div>
                      <div className="flex items-end pb-2">
                        <label className="flex items-center gap-2 cursor-pointer" style={{ color: '#a8aab5' }}>
                          <input type="checkbox" checked={formDespesa.recorrente} onChange={e => setFormDespesa(f => ({ ...f, recorrente: e.target.checked }))} className="accent-blue-600" />
                          <span className="text-sm">Recorrente (mensal)</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button type="submit" disabled={salvandoDespesa} className="btn btn-primary">
                        {salvandoDespesa ? 'Salvando...' : 'Salvar despesa'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div style={{ color: '#8b8d98' }} className="text-xs mb-3 font-medium uppercase tracking-wide">Linha do tempo — próximos lançamentos</div>
              {entradasPrevistas.length === 0 && saidasPrevistas.length === 0 ? (
                <div className="card text-center py-10" style={{ color: '#8b8d98' }}>
                  <DollarSign size={32} className="mx-auto mb-2 opacity-30" />
                  <div style={{ color: '#c3c2b7' }} className="font-medium">Nada previsto por enquanto</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {[
                    ...entradasPrevistas.map(e => ({ ...e, sinal: 1 as const })),
                    ...saidasPrevistas.map(e => ({ ...e, sinal: -1 as const })),
                  ]
                    .sort((a, b) => a.data.localeCompare(b.data))
                    .map((item, i) => (
                      <div key={i} className="card py-3 px-4 flex items-center gap-4">
                        <div style={{ background: '#0d1117', border: '0.5px solid #2a2f3a' }} className="w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                          <div style={{ color: '#c3c2b7' }} className="text-lg font-bold leading-none">{item.data ? new Date(item.data + 'T00:00:00').getDate() : '—'}</div>
                          <div style={{ color: '#8b8d98' }} className="text-[10px]">{item.data ? meses[new Date(item.data + 'T00:00:00').getMonth()].slice(0,3) : ''}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div style={{ color: '#f4f4f3' }} className="font-medium text-sm">{item.descricao}</div>
                          <div style={{ color: '#8b8d98' }} className="text-xs">{item.subdescricao}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div style={{ color: item.sinal > 0 ? '#3fb950' : '#ef4444' }} className="font-semibold">
                            {item.sinal > 0 ? '+ ' : '− '}{formatVal(item.valor)}
                          </div>
                          {item.tipo === 'despesa' && (
                            <button className="btn btn-success text-xs py-1 px-2 mt-1" onClick={() => marcarDespesaPaga((item as any).id)}>Marcar paga</button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
