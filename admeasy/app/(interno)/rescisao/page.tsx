'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { Calculator, Edit2, X, TrendingUp } from 'lucide-react'

type Contrato = {
  id: string
  numero: string
  valor_mensal: number
  valor_atual: number
  valor_caucao?: number
  multa_rescisao_locatario: number
  multa_rescisao_locador: number
  aviso_previo_dias: number
  data_inicio: string
  data_fim: string
  imovel?: any
  locatario?: any
  locador?: any
}

type Org = { nome: string; logo_url?: string; cnpj?: string; creci?: string; cidade?: string }

function formatVal(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}
function getTitulo(val: any): string {
  if (!val) return '—'
  if (Array.isArray(val)) return val[0]?.titulo || '—'
  return val.titulo || '—'
}
function getNome(val: any): string {
  if (!val) return '—'
  if (Array.isArray(val)) return val[0]?.nome || '—'
  return val.nome || '—'
}
function diasRestantes(dataFim: string) {
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const fim = new Date(dataFim + 'T00:00:00')
  return Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}
function mesesDecorridos(dataInicio: string) {
  const inicio = new Date(dataInicio + 'T00:00:00')
  const hoje = new Date()
  return Math.floor((hoje.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24 * 30))
}
function dataExtenso(dateStr: string) {
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  const d = new Date(dateStr + 'T12:00:00')
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`
}

export default function RescisaoPage() {
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)
  const [contratoSel, setContratoSel] = useState<Contrato | null>(null)
  const [parte, setParte] = useState<'locatario' | 'locador' | 'mutuo'>('locatario')
  const [dataRescisao, setDataRescisao] = useState(new Date().toISOString().split('T')[0])
  const [avisoPrevio, setAvisoPrevio] = useState(true)
  const [gerandoPdf, setGerandoPdf] = useState(false)

  const [editandoCaucao, setEditandoCaucao] = useState(false)
  const [atualizandoGarantia, setAtualizandoGarantia] = useState(false)
  const [erroGarantia, setErroGarantia] = useState('')
  const [infoGarantia, setInfoGarantia] = useState<{ percentual: number; meses: number } | null>(null)
  const [caucaoEditado, setCaucaoEditado] = useState('')
  const caucaoValor = editandoCaucao && caucaoEditado !== ''
    ? parseFloat(caucaoEditado.replace(',', '.')) || 0
    : (contratoSel?.valor_caucao || 0)

  const [danosFisicos, setDanosFisicos] = useState('')
  const [danosFisicosDesc, setDanosFisicosDesc] = useState('')
  const [alugueisAtraso, setAlugueisAtraso] = useState('')
  const [outros, setOutros] = useState('')
  const [outrosDesc, setOutrosDesc] = useState('')

  const [testemunha1Nome, setTestemunha1Nome] = useState('')
  const [testemunha1Cpf, setTestemunha1Cpf] = useState('')
  const [testemunha2Nome, setTestemunha2Nome] = useState('')
  const [testemunha2Cpf, setTestemunha2Cpf] = useState('')

  useEffect(() => { buscarContratos() }, [])

  async function buscarContratos() {
    setLoading(true)
    const { data } = await supabase
      .from('contratos')
      .select(`*, imovel:imoveis(titulo, endereco, numero, bairro, cidade, estado), locatario:clientes!contratos_locatario_id_fkey(nome), locador:clientes!contratos_locador_id_fkey(nome)`)
      .in('status', ['ativo', 'pendente'])
      .order('numero')
    if (data) setContratos(data)
    setLoading(false)
  }

  const calcular = () => {
    if (!contratoSel) return null
    const valorMensal = contratoSel.valor_atual || contratoSel.valor_mensal
    const diasRest = diasRestantes(contratoSel.data_fim)
    const mesesRest = Math.max(0, Math.ceil(diasRest / 30))
    const rescisaoDate = new Date(dataRescisao + 'T00:00:00')
    const diaNoMes = rescisaoDate.getDate()
    const diasNoMes = new Date(rescisaoDate.getFullYear(), rescisaoDate.getMonth() + 1, 0).getDate()
    const proporcional = (valorMensal / diasNoMes) * (diasNoMes - diaNoMes + 1)
    const danosFisicosVal = parseFloat(danosFisicos.replace(',', '.')) || 0
    const alugueisAtrasoVal = parseFloat(alugueisAtraso.replace(',', '.')) || 0
    const outrosVal = parseFloat(outros.replace(',', '.')) || 0
    let multaValor = 0
    let avisoPrevioValor = 0

    if (parte === 'locatario') {
      const mesesTotais = mesesDecorridos(contratoSel.data_inicio) + mesesRest
      const multaPct = mesesRest > 0 ? (mesesRest / mesesTotais) : 1
      multaValor = contratoSel.multa_rescisao_locatario * valorMensal * multaPct
      if (!avisoPrevio) avisoPrevioValor = valorMensal
      const totalDevido = proporcional + multaValor + avisoPrevioValor + danosFisicosVal + alugueisAtrasoVal + outrosVal
      const saldo = totalDevido - caucaoValor
      return { proporcional, multaValor, avisoPrevioValor, caucaoValor, danosFisicosVal, alugueisAtrasoVal, outrosVal, total: saldo, quemPaga: 'locatário' }
    } else if (parte === 'locador') {
      multaValor = contratoSel.multa_rescisao_locador * valorMensal
      return { proporcional: 0, multaValor, avisoPrevioValor: 0, caucaoValor, danosFisicosVal, alugueisAtrasoVal, outrosVal, total: multaValor + caucaoValor + danosFisicosVal + alugueisAtrasoVal + outrosVal, quemPaga: 'locador' }
    } else {
      return { proporcional, multaValor: 0, avisoPrevioValor: 0, caucaoValor, danosFisicosVal, alugueisAtrasoVal, outrosVal, total: caucaoValor - proporcional - danosFisicosVal - alugueisAtrasoVal - outrosVal, quemPaga: 'imobiliária' }
    }
  }

  const resultado = calcular()

  async function atualizarGarantia() {
    if (!contratoSel) return
    setAtualizandoGarantia(true)
    setErroGarantia('')
    setInfoGarantia(null)
    try {
      const res = await fetch('/api/poupanca/corrigir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataInicial: contratoSel.data_inicio,
          dataFinal: dataRescisao,
          valor: contratoSel.valor_caucao || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErroGarantia(data.erro || 'Erro ao consultar a rentabilidade da poupança.')
        return
      }
      setEditandoCaucao(true)
      setCaucaoEditado(data.valorCorrigido.toFixed(2))
      setInfoGarantia({ percentual: data.percentualAcumulado, meses: data.meses })
    } catch (err) {
      setErroGarantia('Erro de conexão ao consultar a poupança. Tente novamente.')
    }
    setAtualizandoGarantia(false)
  }

  async function gerarPdf() {
    if (!contratoSel || !resultado) return
    setGerandoPdf(true)

    const { data: orgData } = await supabase.from('organizations').select('*').eq('id', '00000000-0000-0000-0000-000000000001').single()
    const org: Org = orgData || { nome: 'Imobiliária' }

    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    const W = 210
    const ML = 15
    const MR = W - 15
    let y = 15

    if (org.logo_url) {
      try { doc.addImage(org.logo_url, 'JPEG', ML, y, 28, 14) } catch {}
    }
    doc.setFontSize(18).setFont('helvetica', 'bold')
    doc.text('Cálculo de Rescisão Contratual', W / 2, y + 8, { align: 'center' })
    doc.setFontSize(9).setFont('helvetica', 'normal')
    doc.text(org.nome, W / 2, y + 15, { align: 'center' })
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, MR, y + 5, { align: 'right' })
    doc.text(`Contrato: #${contratoSel.numero}`, MR, y + 10, { align: 'right' })
    y += 22

    doc.setDrawColor(200).line(ML, y, MR, y)
    y += 6

    doc.setFillColor(230, 230, 230)
    doc.rect(ML, y, MR - ML, 6, 'F')
    doc.setFontSize(9).setFont('helvetica', 'bold')
    doc.text('Dados do Contrato', W / 2, y + 4, { align: 'center' })
    y += 9

    const im = contratoSel.imovel
    const enderecoImovel = im ? `${im.endereco || ''}, ${im.numero || ''} — ${im.bairro || ''}, ${im.cidade || ''}/${im.estado || ''}` : '—'
    const inicioDate = new Date(contratoSel.data_inicio + 'T00:00:00')
    const rescisaoDate = new Date(dataRescisao + 'T00:00:00')
    const fimDate = new Date(contratoSel.data_fim + 'T00:00:00')
    const diasCumpridos = Math.ceil((rescisaoDate.getTime() - inicioDate.getTime()) / (1000 * 60 * 60 * 24))
    const diasACumprir = Math.max(0, Math.ceil((fimDate.getTime() - rescisaoDate.getTime()) / (1000 * 60 * 60 * 24)))

    const linhas: [string, string][] = [
      ['Imóvel:', enderecoImovel],
      ['Locador:', getNome(contratoSel.locador)],
      ['Locatário:', getNome(contratoSel.locatario)],
      ['Data de entrada:', new Date(contratoSel.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')],
      ['Data de rescisão:', new Date(dataRescisao + 'T12:00:00').toLocaleDateString('pt-BR')],
      ['Término original:', new Date(contratoSel.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')],
      ['Rescisão por:', parte === 'locatario' ? 'Locatário' : parte === 'locador' ? 'Locador' : 'Mútuo acordo'],
      ['Dias cumpridos:', `${diasCumpridos} dias`],
      ['Dias a cumprir:', `${diasACumprir} dias`],
    ]

    doc.setFontSize(9)
    for (const [label, valor] of linhas) {
      doc.setFont('helvetica', 'bold')
      doc.text(label, ML, y)
      doc.setFont('helvetica', 'normal')
      const wrapped = doc.splitTextToSize(valor, MR - ML - 45)
      doc.text(wrapped, ML + 45, y)
      y += wrapped.length * 5
    }
    y += 3

    doc.setFillColor(230, 230, 230)
    doc.rect(ML, y, MR - ML, 6, 'F')
    doc.setFontSize(9).setFont('helvetica', 'bold')
    doc.text('Resultado da Rescisão', W / 2, y + 4, { align: 'center' })
    y += 9

    doc.setFontSize(9)
    const linhasRes: [string, string, string][] = [
      ['Valor mensal atual', formatVal(contratoSel.valor_atual || contratoSel.valor_mensal), 'normal'],
      ['Caução depositada', formatVal(caucaoValor), 'normal'],
    ]
    if (resultado.proporcional > 0) linhasRes.push(['Aluguel proporcional', `+ ${formatVal(resultado.proporcional)}`, 'red'])
    if (resultado.multaValor > 0) linhasRes.push(['Multa rescisória', `+ ${formatVal(resultado.multaValor)}`, 'red'])
    if (resultado.avisoPrevioValor > 0) linhasRes.push(['Aviso prévio não cumprido', `+ ${formatVal(resultado.avisoPrevioValor)}`, 'red'])
    if (resultado.danosFisicosVal > 0) linhasRes.push([`Danos físicos${danosFisicosDesc ? ': ' + danosFisicosDesc : ''}`, `+ ${formatVal(resultado.danosFisicosVal)}`, 'red'])
    if (resultado.alugueisAtrasoVal > 0) linhasRes.push(['Aluguéis em atraso', `+ ${formatVal(resultado.alugueisAtrasoVal)}`, 'red'])
    if (resultado.outrosVal > 0) linhasRes.push([`Outros${outrosDesc ? ': ' + outrosDesc : ''}`, `+ ${formatVal(resultado.outrosVal)}`, 'red'])
    if (resultado.caucaoValor > 0) linhasRes.push(['Caução a devolver', `− ${formatVal(resultado.caucaoValor)}`, 'green'])

    for (const [label, valor, cor] of linhasRes) {
      doc.setFont('helvetica', 'normal').setTextColor(80)
      const lWrapped = doc.splitTextToSize(label, MR - ML - 50)
      doc.text(lWrapped, ML, y)
      if (cor === 'red') doc.setTextColor(180, 0, 0)
      else if (cor === 'green') doc.setTextColor(0, 130, 0)
      else doc.setTextColor(0)
      doc.setFont('helvetica', 'bold')
      doc.text(valor, MR, y, { align: 'right' })
      doc.setTextColor(0)
      y += lWrapped.length * 6
    }

    y += 2
    doc.setDrawColor(0).line(ML, y, MR, y)
    y += 5
    doc.setFontSize(11).setFont('helvetica', 'bold')
    const totalLabel = resultado.total > 0 ? `Total a pagar pelo ${resultado.quemPaga}` : `Total a receber pelo locatário`
    doc.text(totalLabel, ML, y)
    doc.setTextColor(resultado.total > 0 ? 180 : 0, resultado.total > 0 ? 0 : 130, 0)
    doc.text(`${resultado.total < 0 ? '− ' : ''}${formatVal(Math.abs(resultado.total))}`, MR, y, { align: 'right' })
    doc.setTextColor(0)
    y += 8

    doc.setFontSize(7).setFont('helvetica', 'italic').setTextColor(100)
    doc.text('Base legal: Lei 8.245/91 — Art. 4º (rescisão antecipada) e Art. 6º (aviso prévio de 30 dias). Este cálculo é uma estimativa.', ML, y)
    doc.setTextColor(0)
    y += 10

    if (y > 220) { doc.addPage(); y = 15 }
    doc.setDrawColor(200).line(ML, y, MR, y)
    y += 8

    const cidade = (orgData as any)?.cidade || im?.cidade || 'São Paulo'
    doc.setFontSize(9).setFont('helvetica', 'normal')
    doc.text(`${cidade}, ${dataExtenso(dataRescisao)}`, MR, y, { align: 'right' })
    y += 12

    const colW = (MR - ML - 5) / 2
    const assinaturas = [
      { label: 'Locatário(a)', nome: getNome(contratoSel.locatario) },
      { label: 'Locador(a)', nome: getNome(contratoSel.locador) },
      { label: 'Administradora', nome: org.nome },
      { label: 'Testemunha 1', nome: testemunha1Nome ? `CPF: ${testemunha1Cpf}\nNome: ${testemunha1Nome}` : 'CPF:\nNome:' },
      { label: 'Testemunha 2', nome: testemunha2Nome ? `CPF: ${testemunha2Cpf}\nNome: ${testemunha2Nome}` : 'CPF:\nNome:' },
    ]

    for (let i = 0; i < assinaturas.length; i += 2) {
      if (y > 255) { doc.addPage(); y = 15 }
      const a1 = assinaturas[i]
      const a2 = assinaturas[i + 1]
      doc.setDrawColor(0).line(ML, y, ML + colW, y)
      if (a2) doc.line(ML + colW + 5, y, MR, y)
      y += 4
      doc.setFontSize(8).setFont('helvetica', 'normal')
      doc.text(`${a1.label}: ${a1.nome}`, ML, y)
      if (a2) doc.text(`${a2.label}: ${a2.nome}`, ML + colW + 5, y)
      y += 18
    }

    doc.setFontSize(7).setTextColor(150)
    doc.text(`${org.nome} — CNPJ: ${(orgData as any)?.cnpj || ''} — CRECI: ${(orgData as any)?.creci || ''}`, W / 2, 287, { align: 'center' })

    doc.save(`rescisao-contrato-${contratoSel.numero}-${dataRescisao}.pdf`)
    setGerandoPdf(false)
  }

  return (
    <AppLayout>
      <div style={{ background: '#0d1117', minHeight: '100vh' }} className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-[1600px] mx-auto">

          <h1 style={{ color: '#f4f4f3' }} className="text-lg font-medium mb-5">Calculadora de rescisão</h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h2 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Calculator size={15} style={{ color: '#5b9bf5' }} />Selecione o contrato
              </h2>
              {loading ? (
                <div style={{ color: '#8b8d98' }} className="text-sm">Carregando...</div>
              ) : contratos.length === 0 ? (
                <div style={{ color: '#8b8d98' }} className="text-sm">Nenhum contrato ativo</div>
              ) : (
                <div className="space-y-2">
                  {contratos.map(c => {
                    const dias = diasRestantes(c.data_fim)
                    const sel = contratoSel?.id === c.id
                    return (
                      <div key={c.id} onClick={() => { setContratoSel(c); setEditandoCaucao(false); setCaucaoEditado('') }}
                        style={sel ? { border: '0.5px solid #2563eb', background: '#16243a' } : { border: '0.5px solid #2a2f3a' }}
                        className="p-3 rounded-lg cursor-pointer transition-all hover:border-gray-500">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <div className="min-w-0">
                            <div style={{ color: '#f4f4f3' }} className="text-sm font-medium truncate">#{c.numero} — {getTitulo(c.imovel)}</div>
                            <div style={{ color: '#8b8d98' }} className="text-xs truncate">{getNome(c.locatario)}</div>
                          </div>
                          <div className="sm:text-right flex-shrink-0">
                            <div style={{ color: '#f4f4f3' }} className="text-sm font-semibold">{formatVal(c.valor_atual || c.valor_mensal)}</div>
                            <div style={{ color: dias < 0 ? '#ef4444' : dias < 30 ? '#f59e0b' : '#8b8d98' }} className="text-xs">
                              {dias < 0 ? `${Math.abs(dias)}d vencido` : `${dias}d restantes`}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              {!contratoSel ? (
                <div className="card text-center py-16" style={{ color: '#8b8d98' }}>
                  <Calculator size={36} className="mx-auto mb-3 opacity-30" />
                  <div style={{ color: '#c3c2b7' }} className="font-medium">Selecione um contrato</div>
                </div>
              ) : (
                <>
                  <div className="card mb-4">
                    <h2 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-3">Parâmetros da rescisão</h2>
                    <div className="space-y-3">
                      <div>
                        <label className="label">Quem está rescindindo?</label>
                        <div className="flex gap-2">
                          {[
                            { val: 'locatario', label: 'Locatário' },
                            { val: 'locador', label: 'Locador' },
                            { val: 'mutuo', label: 'Mútuo acordo' },
                          ].map(p => (
                            <button key={p.val} onClick={() => setParte(p.val as any)}
                              style={parte === p.val ? { background: '#2563eb', color: '#fff', border: '0.5px solid #2563eb' } : { border: '0.5px solid #2a2f3a', color: '#a8aab5' }}
                              className="flex-1 py-2 rounded-lg text-xs font-medium transition-all">
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="label">Data da rescisão</label>
                        <input className="input" type="date" value={dataRescisao} onChange={e => setDataRescisao(e.target.value)} />
                      </div>

                      <div>
                        <label className="label">Caução depositada</label>
                        <div className="flex items-center gap-2">
                          {editandoCaucao ? (
                            <>
                              <span style={{ color: '#8b8d98' }} className="text-sm">R$</span>
                              <input className="input flex-1" value={caucaoEditado}
                                onChange={e => setCaucaoEditado(e.target.value)}
                                placeholder={(contratoSel.valor_caucao || 0).toFixed(2)} autoFocus />
                              <button onClick={() => { setEditandoCaucao(false); setCaucaoEditado('') }}
                                style={{ color: '#5b5e6b' }} className="hover:text-gray-300"><X size={14} /></button>
                            </>
                          ) : (
                            <>
                              <span className="input flex-1" style={{ background: '#0d1117', color: '#c3c2b7' }}>{formatVal(caucaoValor)}</span>
                              <button onClick={() => { setEditandoCaucao(true); setCaucaoEditado((contratoSel.valor_caucao || 0).toFixed(2)) }}
                                style={{ color: '#5b5e6b' }} className="hover:text-blue-400 transition-colors" title="Editar caução">
                                <Edit2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                        {editandoCaucao && <p style={{ color: '#f59e0b' }} className="text-[10px] mt-1">⚠ Valor editado manualmente para este cálculo</p>}
                        <button onClick={atualizarGarantia} disabled={atualizandoGarantia}
                          style={{ border: '0.5px solid #1e3a5f', color: '#5b9bf5' }}
                          className="text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 mt-2 disabled:opacity-50">
                          <TrendingUp size={12} />{atualizandoGarantia ? 'Consultando poupança...' : 'Atualizar garantia'}
                        </button>
                        {erroGarantia && <p style={{ color: '#ef4444' }} className="text-[10px] mt-1">{erroGarantia}</p>}
                        {infoGarantia && !erroGarantia && (
                          <p style={{ color: '#3fb950' }} className="text-[10px] mt-1">
                            Corrigido pela poupança: +{infoGarantia.percentual.toFixed(2).replace('.', ',')}% acumulado ({infoGarantia.meses} meses)
                          </p>
                        )}
                        {!infoGarantia && !erroGarantia && (
                          <p style={{ color: '#5b5e6b' }} className="text-[10px] mt-1">
                            Corrige a caução pela rentabilidade acumulada da poupança, do início do contrato até a data da rescisão.
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="label">Danos físicos (R$)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input className="input" type="number" step="0.01" min="0"
                            value={danosFisicos} onChange={e => setDanosFisicos(e.target.value)}
                            placeholder="0,00" />
                          <input className="input" value={danosFisicosDesc}
                            onChange={e => setDanosFisicosDesc(e.target.value)}
                            placeholder="Descrição (ex: pintura, vidro...)" />
                        </div>
                      </div>

                      <div>
                        <label className="label">Aluguéis em atraso (R$)</label>
                        <input className="input" type="number" step="0.01" min="0"
                          value={alugueisAtraso} onChange={e => setAlugueisAtraso(e.target.value)}
                          placeholder="0,00" />
                      </div>

                      <div>
                        <label className="label">Outros (R$)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input className="input" type="number" step="0.01" min="0"
                            value={outros} onChange={e => setOutros(e.target.value)}
                            placeholder="0,00" />
                          <input className="input" value={outrosDesc}
                            onChange={e => setOutrosDesc(e.target.value)}
                            placeholder="Descrição..." />
                        </div>
                      </div>

                      {parte === 'locatario' && (
                        <label style={{ color: '#c3c2b7' }} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={!avisoPrevio} onChange={e => setAvisoPrevio(!e.target.checked)} />
                          Aviso prévio não cumprido ({contratoSel.aviso_previo_dias} dias)
                        </label>
                      )}
                    </div>
                  </div>

                  {resultado && (
                    <div className="card mb-4">
                      <h2 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-3">Resultado da rescisão</h2>

                      <div style={{ background: '#0d1117', border: '0.5px solid #2a2f3a' }} className="rounded-lg p-3 mb-4 text-xs space-y-1">
                        <div className="flex justify-between" style={{ color: '#8b8d98' }}><span>Valor mensal atual</span><span style={{ color: '#f4f4f3' }} className="font-medium">{formatVal(contratoSel.valor_atual || contratoSel.valor_mensal)}</span></div>
                        <div className="flex justify-between" style={{ color: '#8b8d98' }}><span>Caução depositada</span><span style={{ color: '#f4f4f3' }} className="font-medium">{formatVal(caucaoValor)}</span></div>
                        <div className="flex justify-between" style={{ color: '#8b8d98' }}><span>Multa contratual</span><span style={{ color: '#f4f4f3' }} className="font-medium">{parte === 'locatario' ? contratoSel.multa_rescisao_locatario : contratoSel.multa_rescisao_locador} aluguéis</span></div>
                        <div className="flex justify-between" style={{ color: '#8b8d98' }}><span>Dias restantes no contrato</span><span style={{ color: '#f4f4f3' }} className="font-medium">{Math.max(0, diasRestantes(contratoSel.data_fim))} dias</span></div>
                      </div>

                      <div className="space-y-1 mb-4">
                        <div style={{ borderBottom: '0.5px solid #1c2128' }} className="flex justify-between py-2 text-sm">
                          <span style={{ color: '#8b8d98' }}>Aluguel proporcional</span>
                          <span style={{ color: resultado.proporcional > 0 ? '#ef4444' : '#8b8d98' }} className="font-medium">+ {formatVal(resultado.proporcional)}</span>
                        </div>
                        <div style={{ borderBottom: '0.5px solid #1c2128' }} className="flex justify-between py-2 text-sm">
                          <span style={{ color: '#8b8d98' }}>Multa rescisória</span>
                          <span style={{ color: resultado.multaValor > 0 ? '#ef4444' : '#8b8d98' }} className="font-medium">+ {formatVal(resultado.multaValor)}</span>
                        </div>
                        <div style={{ borderBottom: '0.5px solid #1c2128' }} className="flex justify-between py-2 text-sm">
                          <span style={{ color: '#8b8d98' }}>Aviso prévio não cumprido</span>
                          <span style={{ color: resultado.avisoPrevioValor > 0 ? '#ef4444' : '#8b8d98' }} className="font-medium">+ {formatVal(resultado.avisoPrevioValor)}</span>
                        </div>
                        <div style={{ borderBottom: '0.5px solid #1c2128' }} className="flex justify-between py-2 text-sm">
                          <span style={{ color: '#8b8d98' }}>Danos físicos{danosFisicosDesc ? `: ${danosFisicosDesc}` : ''}</span>
                          <span style={{ color: resultado.danosFisicosVal > 0 ? '#ef4444' : '#8b8d98' }} className="font-medium">+ {formatVal(resultado.danosFisicosVal)}</span>
                        </div>
                        <div style={{ borderBottom: '0.5px solid #1c2128' }} className="flex justify-between py-2 text-sm">
                          <span style={{ color: '#8b8d98' }}>Aluguéis em atraso</span>
                          <span style={{ color: resultado.alugueisAtrasoVal > 0 ? '#ef4444' : '#8b8d98' }} className="font-medium">+ {formatVal(resultado.alugueisAtrasoVal)}</span>
                        </div>
                        <div style={{ borderBottom: '0.5px solid #1c2128' }} className="flex justify-between py-2 text-sm">
                          <span style={{ color: '#8b8d98' }}>Outros{outrosDesc ? `: ${outrosDesc}` : ''}</span>
                          <span style={{ color: resultado.outrosVal > 0 ? '#ef4444' : '#8b8d98' }} className="font-medium">+ {formatVal(resultado.outrosVal)}</span>
                        </div>
                        <div style={{ borderBottom: '0.5px solid #1c2128' }} className="flex justify-between py-2 text-sm">
                          <span style={{ color: '#8b8d98' }}>Caução a devolver</span>
                          <span style={{ color: resultado.caucaoValor > 0 ? '#3fb950' : '#8b8d98' }} className="font-medium">− {formatVal(resultado.caucaoValor)}</span>
                        </div>
                        <div style={{ borderTop: '2px solid #2a2f3a' }} className="flex justify-between py-3">
                          <span style={{ color: '#f4f4f3' }} className="font-semibold text-sm">
                            {resultado.total > 0 ? `Total a pagar pelo ${resultado.quemPaga}` : `Total a receber pelo locatário`}
                          </span>
                          <span style={{ color: resultado.total > 0 ? '#ef4444' : '#3fb950' }} className="font-bold text-lg">
                            {resultado.total < 0 ? '− ' : ''}{formatVal(Math.abs(resultado.total))}
                          </span>
                        </div>
                      </div>

                      <div style={{ background: '#16243a', border: '0.5px solid #1e3a5f', color: '#7daee8' }} className="rounded-lg p-3 text-xs mb-4">
                        <strong>Base legal:</strong> Lei 8.245/91 — Art. 4º (rescisão antecipada) e Art. 6º (aviso prévio de 30 dias). Este cálculo é uma estimativa. Confirme com assessoria jurídica.
                      </div>

                      <div style={{ borderTop: '0.5px solid #2a2f3a' }} className="pt-4">
                        <p style={{ color: '#8b8d98' }} className="text-xs font-semibold mb-3">Testemunhas (para o PDF)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="label">Testemunha 1 — Nome</label>
                            <input className="input" value={testemunha1Nome} onChange={e => setTestemunha1Nome(e.target.value)} />
                          </div>
                          <div>
                            <label className="label">Testemunha 1 — CPF</label>
                            <input className="input" value={testemunha1Cpf} onChange={e => setTestemunha1Cpf(e.target.value)} />
                          </div>
                          <div>
                            <label className="label">Testemunha 2 — Nome</label>
                            <input className="input" value={testemunha2Nome} onChange={e => setTestemunha2Nome(e.target.value)} />
                          </div>
                          <div>
                            <label className="label">Testemunha 2 — CPF</label>
                            <input className="input" value={testemunha2Cpf} onChange={e => setTestemunha2Cpf(e.target.value)} />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <button onClick={gerarPdf} disabled={gerandoPdf} className="btn btn-primary flex-1">
                          📄 {gerandoPdf ? 'Gerando PDF...' : 'Gerar cálculo PDF'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
