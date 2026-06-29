'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { supabase } from '@/lib/supabase'
import { Calculator, Edit2, X } from 'lucide-react'

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

type Org = { nome: string; logo_url?: string; cnpj?: string; creci?: string; cidade?: string; endereco?: string; telefone?: string }

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

  // Caução editável
  const [editandoCaucao, setEditandoCaucao] = useState(false)
  const [caucaoEditado, setCaucaoEditado] = useState('')
  const caucaoValor = editandoCaucao && caucaoEditado !== ''
    ? parseFloat(caucaoEditado.replace(',', '.')) || 0
    : (contratoSel?.valor_caucao || 0)

  // Assinaturas
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
    let multaValor = 0
    let avisoPrevioValor = 0

    if (parte === 'locatario') {
      const mesesTotais = mesesDecorridos(contratoSel.data_inicio) + mesesRest
      const multaPct = mesesRest > 0 ? (mesesRest / mesesTotais) : 1
      multaValor = contratoSel.multa_rescisao_locatario * valorMensal * multaPct
      if (!avisoPrevio) avisoPrevioValor = valorMensal
      const totalDevido = proporcional + multaValor + avisoPrevioValor
      const saldo = totalDevido - caucaoValor
      return { proporcional, multaValor, avisoPrevioValor, caucaoValor, total: saldo, quemPaga: 'locatário' }
    } else if (parte === 'locador') {
      multaValor = contratoSel.multa_rescisao_locador * valorMensal
      return { proporcional: 0, multaValor, avisoPrevioValor: 0, caucaoValor, total: multaValor + caucaoValor, quemPaga: 'locador' }
    } else {
      return { proporcional, multaValor: 0, avisoPrevioValor: 0, caucaoValor, total: caucaoValor - proporcional, quemPaga: 'imobiliária' }
    }
  }

  const resultado = calcular()

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

    // ── CABEÇALHO ──
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

    // ── DADOS DO CONTRATO ──
    doc.setFillColor(230, 230, 230)
    doc.rect(ML, y, MR - ML, 6, 'F')
    doc.setFontSize(9).setFont('helvetica', 'bold')
    doc.text('Dados do Contrato', W / 2, y + 4, { align: 'center' })
    y += 9

    const im = contratoSel.imovel
    const enderecoImovel = im ? `${im.endereco || ''}, ${im.numero || ''} — ${im.bairro || ''}, ${im.cidade || ''}/${im.estado || ''}` : '—'

    const linhas = [
      ['Imóvel:', enderecoImovel],
      ['Locador:', getNome(contratoSel.locador)],
      ['Locatário:', getNome(contratoSel.locatario)],
      ['Data de entrada:', new Date(contratoSel.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')],
      ['Data de rescisão:', new Date(dataRescisao + 'T12:00:00').toLocaleDateString('pt-BR')],
      ['Término original do contrato:', new Date(contratoSel.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')],
      ['Rescisão por:', parte === 'locatario' ? 'Locatário' : parte === 'locador' ? 'Locador' : 'Mútuo acordo'],
    ]

    // Calcular dias cumpridos e a cumprir
    const inicioDate = new Date(contratoSel.data_inicio + 'T00:00:00')
    const rescisaoDate = new Date(dataRescisao + 'T00:00:00')
    const fimDate = new Date(contratoSel.data_fim + 'T00:00:00')
    const diasCumpridos = Math.ceil((rescisaoDate.getTime() - inicioDate.getTime()) / (1000 * 60 * 60 * 24))
    const diasACumprir = Math.max(0, Math.ceil((fimDate.getTime() - rescisaoDate.getTime()) / (1000 * 60 * 60 * 24)))

    linhas.push(['Dias cumpridos:', `${diasCumpridos} dias`])
    linhas.push(['Dias a cumprir:', `${diasACumprir} dias`])

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

    // ── RESULTADO ──
    doc.setFillColor(230, 230, 230)
    doc.rect(ML, y, MR - ML, 6, 'F')
    doc.setFontSize(9).setFont('helvetica', 'bold')
    doc.text('Resultado da Rescisão', W / 2, y + 4, { align: 'center' })
    y += 9

    const linhasResultado: [string, string, string][] = []
    const valorMensal = contratoSel.valor_atual || contratoSel.valor_mensal
    linhasResultado.push(['Valor mensal atual', formatVal(valorMensal), 'normal'])
    linhasResultado.push(['Caução depositada', formatVal(caucaoValor), 'normal'])
    if (resultado.proporcional > 0) linhasResultado.push(['Aluguel proporcional', `+ ${formatVal(resultado.proporcional)}`, 'red'])
    if (resultado.multaValor > 0) linhasResultado.push(['Multa rescisória', `+ ${formatVal(resultado.multaValor)}`, 'red'])
    if (resultado.avisoPrevioValor > 0) linhasResultado.push(['Aviso prévio não cumprido', `+ ${formatVal(resultado.avisoPrevioValor)}`, 'red'])
    if (resultado.caucaoValor > 0) linhasResultado.push(['Caução a devolver', `− ${formatVal(resultado.caucaoValor)}`, 'green'])

    doc.setFontSize(9)
    for (const [label, valor, cor] of linhasResultado) {
      doc.setFont('helvetica', 'normal').setTextColor(80)
      doc.text(label, ML, y)
      if (cor === 'red') doc.setTextColor(180, 0, 0)
      else if (cor === 'green') doc.setTextColor(0, 130, 0)
      else doc.setTextColor(0)
      doc.setFont('helvetica', 'bold')
      doc.text(valor, MR, y, { align: 'right' })
      doc.setTextColor(0)
      y += 6
    }

    // Total
    y += 2
    doc.setDrawColor(0).line(ML, y, MR, y)
    y += 5
    doc.setFontSize(11).setFont('helvetica', 'bold')
    const totalLabel = resultado.total > 0 ? `Total a pagar pelo ${resultado.quemPaga}` : `Total a receber pelo ${resultado.quemPaga === 'locatário' ? 'locatário' : 'locatário'}`
    doc.text(totalLabel, ML, y)
    doc.setTextColor(resultado.total > 0 ? 180 : 0, resultado.total > 0 ? 0 : 130, 0)
    doc.text(`${resultado.total < 0 ? '− ' : ''}${formatVal(Math.abs(resultado.total))}`, MR, y, { align: 'right' })
    doc.setTextColor(0)
    y += 8

    // Base legal
    doc.setFontSize(7).setFont('helvetica', 'italic').setTextColor(100)
    doc.text('Base legal: Lei 8.245/91 — Art. 4º (rescisão antecipada) e Art. 6º (aviso prévio de 30 dias). Este cálculo é uma estimativa.', ML, y)
    doc.setTextColor(0)
    y += 8

    // ── ASSINATURAS ──
    if (y > 220) { doc.addPage(); y = 15 }

    doc.setDrawColor(200).line(ML, y, MR, y)
    y += 8

    const cidade = org.cidade || im?.cidade || 'São Paulo'
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

    // Rodapé
    doc.setFontSize(7).setTextColor(150)
    doc.text(`${org.nome} — CNPJ: ${(orgData as any)?.cnpj || ''} — CRECI: ${(orgData as any)?.creci || ''}`, W / 2, 287, { align: 'center' })

    doc.save(`rescisao-contrato-${contratoSel.numero}-${dataRescisao}.pdf`)
    setGerandoPdf(false)
  }

  return (
    <AppLayout>
      <Topbar titulo="Calculadora de rescisão" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-6">
          {/* Seleção */}
          <div className="card">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Calculator size={15} className="text-blue-500" />Selecione o contrato
            </h2>
            {loading ? (
              <div className="text-sm text-gray-400">Carregando...</div>
            ) : contratos.length === 0 ? (
              <div className="text-sm text-gray-400">Nenhum contrato ativo</div>
            ) : (
              <div className="space-y-2">
                {contratos.map(c => {
                  const dias = diasRestantes(c.data_fim)
                  return (
                    <div key={c.id} onClick={() => { setContratoSel(c); setEditandoCaucao(false); setCaucaoEditado('') }}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${contratoSel?.id === c.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">#{c.numero} — {getTitulo(c.imovel)}</div>
                          <div className="text-xs text-gray-400">{getNome(c.locatario)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">{formatVal(c.valor_atual || c.valor_mensal)}</div>
                          <div className={`text-xs ${dias < 0 ? 'text-red-500' : dias < 30 ? 'text-yellow-500' : 'text-gray-400'}`}>
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

          {/* Calculadora */}
          <div>
            {!contratoSel ? (
              <div className="card text-center py-16 text-gray-400">
                <Calculator size={36} className="mx-auto mb-3 opacity-30" />
                <div className="font-medium text-gray-500">Selecione um contrato</div>
              </div>
            ) : (
              <>
                <div className="card mb-4">
                  <h2 className="text-sm font-semibold mb-3">Parâmetros da rescisão</h2>
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
                            className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${parte === p.val ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="label">Data da rescisão</label>
                      <input className="input" type="date" value={dataRescisao} onChange={e => setDataRescisao(e.target.value)} />
                    </div>

                    {/* Caução editável */}
                    <div>
                      <label className="label">Caução depositada</label>
                      <div className="flex items-center gap-2">
                        {editandoCaucao ? (
                          <>
                            <span className="text-sm text-gray-400">R$</span>
                            <input className="input flex-1" value={caucaoEditado}
                              onChange={e => setCaucaoEditado(e.target.value)}
                              placeholder={(contratoSel.valor_caucao || 0).toFixed(2)} autoFocus />
                            <button onClick={() => { setEditandoCaucao(false); setCaucaoEditado('') }}
                              className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                          </>
                        ) : (
                          <>
                            <span className="input flex-1 bg-gray-50 text-gray-700">{formatVal(caucaoValor)}</span>
                            <button onClick={() => { setEditandoCaucao(true); setCaucaoEditado((contratoSel.valor_caucao || 0).toFixed(2)) }}
                              className="text-gray-300 hover:text-blue-500 transition-colors" title="Editar caução">
                              <Edit2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                      {editandoCaucao && <p className="text-[10px] text-orange-500 mt-1">⚠ Valor editado manualmente para este cálculo</p>}
                    </div>

                    {parte === 'locatario' && (
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={!avisoPrevio} onChange={e => setAvisoPrevio(!e.target.checked)} />
                        Aviso prévio não cumprido ({contratoSel.aviso_previo_dias} dias)
                      </label>
                    )}
                  </div>
                </div>

                {resultado && (
                  <div className="card mb-4">
                    <h2 className="text-sm font-semibold mb-3">Resultado da rescisão</h2>

                    <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs text-gray-600 space-y-1">
                      <div className="flex justify-between"><span>Valor mensal atual</span><span className="font-medium">{formatVal(contratoSel.valor_atual || contratoSel.valor_mensal)}</span></div>
                      <div className="flex justify-between"><span>Caução depositada</span><span className="font-medium">{formatVal(caucaoValor)}</span></div>
                      <div className="flex justify-between"><span>Multa contratual</span><span className="font-medium">{parte === 'locatario' ? contratoSel.multa_rescisao_locatario : contratoSel.multa_rescisao_locador} aluguéis</span></div>
                      <div className="flex justify-between"><span>Dias restantes no contrato</span><span className="font-medium">{Math.max(0, diasRestantes(contratoSel.data_fim))} dias</span></div>
                    </div>

                    <div className="space-y-1 mb-4">
                      {resultado.proporcional > 0 && (
                        <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
                          <span className="text-gray-500">Aluguel proporcional</span>
                          <span className="text-red-500 font-medium">+ {formatVal(resultado.proporcional)}</span>
                        </div>
                      )}
                      {resultado.multaValor > 0 && (
                        <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
                          <span className="text-gray-500">Multa rescisória</span>
                          <span className="text-red-500 font-medium">+ {formatVal(resultado.multaValor)}</span>
                        </div>
                      )}
                      {resultado.avisoPrevioValor > 0 && (
                        <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
                          <span className="text-gray-500">Aviso prévio não cumprido</span>
                          <span className="text-red-500 font-medium">+ {formatVal(resultado.avisoPrevioValor)}</span>
                        </div>
                      )}
                      {resultado.caucaoValor > 0 && (
                        <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
                          <span className="text-gray-500">Caução a devolver</span>
                          <span className="text-green-600 font-medium">− {formatVal(resultado.caucaoValor)}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-3 border-t-2 border-gray-200">
                        <span className="font-semibold text-sm">
                          {resultado.total > 0 ? `Total a pagar pelo ${resultado.quemPaga}` : `Total a receber pelo locatário`}
                        </span>
                        <span className={`font-bold text-lg ${resultado.total > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {resultado.total < 0 ? '− ' : ''}{formatVal(Math.abs(resultado.total))}
                        </span>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 mb-4">
                      <strong>Base legal:</strong> Lei 8.245/91 — Art. 4º (rescisão antecipada) e Art. 6º (aviso prévio de 30 dias). Este cálculo é uma estimativa. Confirme com assessoria jurídica.
                    </div>

                    {/* Testemunhas */}
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-xs font-semibold text-gray-500 mb-3">Testemunhas (para o PDF)</p>
                      <div className="grid grid-cols-2 gap-3">
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
    </AppLayout>
  )
}
