'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { supabase } from '@/lib/supabase'
import { Calculator } from 'lucide-react'

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

export default function RescisaoPage() {
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)
  const [contratoSel, setContratoSel] = useState<Contrato | null>(null)
  const [parte, setParte] = useState<'locatario' | 'locador' | 'mutuo'>('locatario')
  const [dataRescisao, setDataRescisao] = useState(new Date().toISOString().split('T')[0])
  const [avisoPrevio, setAvisoPrevio] = useState(true)

  useEffect(() => { buscarContratos() }, [])

  async function buscarContratos() {
    setLoading(true)
    const { data } = await supabase
      .from('contratos')
      .select(`*, imovel:imoveis(titulo), locatario:clientes!contratos_locatario_id_fkey(nome), locador:clientes!contratos_locador_id_fkey(nome)`)
      .in('status', ['ativo', 'pendente'])
      .order('numero')
    if (data) setContratos(data)
    setLoading(false)
  }

  // Cálculo da rescisão
  const calcular = () => {
    if (!contratoSel) return null

    const valorMensal = contratoSel.valor_atual || contratoSel.valor_mensal
    const diasRest = diasRestantes(contratoSel.data_fim)
    const mesesRest = Math.max(0, Math.ceil(diasRest / 30))

    // Dia da rescisão
    const rescisaoDate = new Date(dataRescisao + 'T00:00:00')
    const diaNoMes = rescisaoDate.getDate()
    const diasNoMes = new Date(rescisaoDate.getFullYear(), rescisaoDate.getMonth() + 1, 0).getDate()
    const proporcional = (valorMensal / diasNoMes) * (diasNoMes - diaNoMes + 1)

    // Multa proporcional (Lei 8.245/91 — proporcional ao tempo restante)
    let multaPct = 0
    let multaValor = 0
    let avisoPrevioValor = 0
    let caucaoDevolver = contratoSel.valor_caucao || 0

    if (parte === 'locatario') {
      // Locatário paga multa proporcional ao tempo restante
      const mesesTotais = mesesDecorridos(contratoSel.data_inicio) + mesesRest
      multaPct = mesesRest > 0 ? (mesesRest / mesesTotais) : 1
      multaValor = contratoSel.multa_rescisao_locatario * valorMensal * multaPct
      if (!avisoPrevio) avisoPrevioValor = valorMensal
      // Caução pode ser abatida
      const totalDevido = proporcional + multaValor + avisoPrevioValor
      const saldo = totalDevido - caucaoDevolver
      return { proporcional, multaValor, avisoPrevioValor, caucaoDevolver, total: saldo, quemPaga: 'locatário', positivo: saldo > 0 }

    } else if (parte === 'locador') {
      // Locador paga multa + devolução de caução
      multaValor = contratoSel.multa_rescisao_locador * valorMensal
      return { proporcional: 0, multaValor, avisoPrevioValor: 0, caucaoDevolver, total: multaValor + caucaoDevolver, quemPaga: 'locador', positivo: true }

    } else {
      // Mútuo acordo — sem multa, devolve caução proporcional
      return { proporcional, multaValor: 0, avisoPrevioValor: 0, caucaoDevolver, total: caucaoDevolver - proporcional, quemPaga: 'imobiliária', positivo: false }
    }
  }

  const resultado = calcular()

  return (
    <AppLayout>
      <Topbar titulo="Calculadora de rescisão" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-6">
          {/* Seleção */}
          <div className="card">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><Calculator size={15} className="text-blue-500" />Selecione o contrato</h2>
            {loading ? (
              <div className="text-sm text-gray-400">Carregando...</div>
            ) : contratos.length === 0 ? (
              <div className="text-sm text-gray-400">Nenhum contrato ativo</div>
            ) : (
              <div className="space-y-2">
                {contratos.map(c => {
                  const dias = diasRestantes(c.data_fim)
                  return (
                    <div key={c.id} onClick={() => setContratoSel(c)}
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
                    {parte === 'locatario' && (
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={!avisoPrevio} onChange={e => setAvisoPrevio(!e.target.checked)} />
                        Aviso prévio não cumprido ({contratoSel.aviso_previo_dias} dias)
                      </label>
                    )}
                  </div>
                </div>

                {resultado && (
                  <div className="card">
                    <h2 className="text-sm font-semibold mb-3">Resultado da rescisão</h2>

                    {/* Info do contrato */}
                    <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs text-gray-600 space-y-1">
                      <div className="flex justify-between"><span>Valor mensal atual</span><span className="font-medium">{formatVal(contratoSel.valor_atual || contratoSel.valor_mensal)}</span></div>
                      <div className="flex justify-between"><span>Caução depositada</span><span className="font-medium">{formatVal(contratoSel.valor_caucao || 0)}</span></div>
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
                      {resultado.caucaoDevolver > 0 && (
                        <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
                          <span className="text-gray-500">Caução a devolver</span>
                          <span className="text-green-600 font-medium">− {formatVal(resultado.caucaoDevolver)}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-3 border-t-2 border-gray-200">
                        <span className="font-semibold text-sm">
                          {resultado.total > 0 ? `Total a pagar pelo ${resultado.quemPaga}` : `Total a receber pelo ${resultado.quemPaga === 'locatário' ? 'locatário' : 'locatário'}`}
                        </span>
                        <span className={`font-bold text-lg ${resultado.total > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {resultado.total < 0 ? '− ' : ''}{formatVal(Math.abs(resultado.total))}
                        </span>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                      <strong>Base legal:</strong> Lei 8.245/91 — Art. 4º (rescisão antecipada) e Art. 6º (aviso prévio de 30 dias). Este cálculo é uma estimativa. Confirme com assessoria jurídica.
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button className="btn btn-primary flex-1">📄 Gerar cálculo PDF</button>
                      <button className="btn">✉️ Enviar às partes</button>
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