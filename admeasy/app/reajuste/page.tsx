'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { supabase } from '@/lib/supabase'
import { TrendingUp, Check, Edit2, Undo2, History, X } from 'lucide-react'
import { registrarLog } from '@/lib/logs'

type Contrato = {
  id: string
  numero: string
  valor_mensal: number
  valor_atual: number
  indice_reajuste: string
  data_inicio: string
  proximo_reajuste?: string
  imovel?: any
  locatario?: any
  locador?: any
}

type Reajuste = {
  id: string
  contrato_id: string
  indice: string
  percentual: number
  valor_anterior: number
  valor_novo: number
  data_aplicacao: string
  periodo_referencia: string
}

const indices = [
  { key: 'igpm', label: 'IGP-M', fonte: 'FGV', pct: 4.62 },
  { key: 'ipca', label: 'IPCA', fonte: 'IBGE', pct: 3.89 },
  { key: 'inpc', label: 'INPC', fonte: 'IBGE', pct: 3.71 },
  { key: 'ivar', label: 'IVAR', fonte: 'FGV', pct: 5.14 },
]

function formatVal(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

function getNome(val: any): string {
  if (!val) return '—'
  if (Array.isArray(val)) return val[0]?.nome || '—'
  return val.nome || '—'
}

function getTitulo(val: any): string {
  if (!val) return '—'
  if (Array.isArray(val)) return val[0]?.titulo || '—'
  return val.titulo || '—'
}

export default function ReajustePage() {
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)
  const [contratoSel, setContratoSel] = useState<Contrato | null>(null)
  const [indiceSel, setIndiceSel] = useState('igpm')
  const [pctCustom, setPctCustom] = useState('')
  const [aplicando, setAplicando] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [editandoValor, setEditandoValor] = useState(false)
  const [valorEditado, setValorEditado] = useState('')
  const [historico, setHistorico] = useState<Reajuste[]>([])
  const [showHistorico, setShowHistorico] = useState(false)
  const [desfazendo, setDesfazendo] = useState<string | null>(null)

  useEffect(() => { buscarContratos() }, [])

  async function buscarContratos() {
    setLoading(true)
    const { data } = await supabase
      .from('contratos')
      .select(`*, imovel:imoveis(titulo), locatario:clientes!contratos_locatario_id_fkey(nome), locador:clientes!contratos_locador_id_fkey(nome)`)
      .eq('status', 'ativo')
      .order('numero')
    if (data) setContratos(data)
    setLoading(false)
  }

  async function selecionarContrato(c: Contrato) {
    setContratoSel(c)
    setIndiceSel(c.indice_reajuste || 'igpm')
    setEditandoValor(false)
    setValorEditado('')
    setShowHistorico(false)
    // Busca histórico de reajustes
    const { data } = await supabase
      .from('reajustes')
      .select('*')
      .eq('contrato_id', c.id)
      .order('data_aplicacao', { ascending: false })
    if (data) setHistorico(data)
  }

  const indiceAtual = indices.find(i => i.key === indiceSel)
  const pct = pctCustom ? parseFloat(pctCustom) : (indiceAtual?.pct || 0)
  const valorBase = contratoSel?.valor_atual || contratoSel?.valor_mensal || 0
  const acrescimo = valorBase * (pct / 100)
  const novoValorCalculado = valorBase + acrescimo
  const novoValor = editandoValor && valorEditado ? parseFloat(valorEditado.replace(',', '.')) : novoValorCalculado

  async function aplicarReajuste() {
    if (!contratoSel) return
    setAplicando(true)

    const hoje = new Date().toISOString().split('T')[0]
    const proximoAno = new Date()
    proximoAno.setFullYear(proximoAno.getFullYear() + 1)

    await supabase.from('reajustes').insert([{
      contrato_id: contratoSel.id,
      indice: indiceSel.toUpperCase(),
      percentual: pct,
      valor_anterior: valorBase,
      valor_novo: novoValor,
      data_aplicacao: hoje,
      periodo_referencia: 'Últimos 12 meses',
    }])

    await supabase.from('contratos').update({
      valor_atual: novoValor,
      ultimo_reajuste: hoje,
      proximo_reajuste: proximoAno.toISOString().split('T')[0],
    }).eq('id', contratoSel.id)

    await registrarLog({
      acao: 'editou',
      modulo: 'contrato',
      registro_id: contratoSel.id,
      registro_nome: `Contrato #${contratoSel.numero}`,
      descricao: `Reajuste ${indiceSel.toUpperCase()} +${pct}% aplicado — novo valor: ${formatVal(novoValor)}`,
    })

    setSucesso(`Reajuste aplicado! Novo valor: ${formatVal(novoValor)}`)
    setEditandoValor(false)
    setValorEditado('')
    buscarContratos()
    setContratoSel(null)
    setAplicando(false)
    setTimeout(() => setSucesso(''), 4000)
  }

  async function desfazerReajuste(r: Reajuste) {
    if (!confirm(`Desfazer reajuste de ${formatVal(r.valor_anterior)} → ${formatVal(r.valor_novo)}? O contrato voltará ao valor anterior.`)) return
    setDesfazendo(r.id)

    await supabase.from('contratos').update({
      valor_atual: r.valor_anterior,
    }).eq('id', r.contrato_id)

    await supabase.from('reajustes').delete().eq('id', r.id)

    await registrarLog({
      acao: 'editou',
      modulo: 'contrato',
      registro_id: r.contrato_id,
      registro_nome: `Contrato #${contratoSel?.numero}`,
      descricao: `Reajuste desfeito — valor revertido para: ${formatVal(r.valor_anterior)}`,
    })

    setSucesso(`Reajuste desfeito! Valor revertido para ${formatVal(r.valor_anterior)}`)
    buscarContratos()
    if (contratoSel) selecionarContrato({ ...contratoSel, valor_atual: r.valor_anterior })
    setDesfazendo(null)
    setTimeout(() => setSucesso(''), 4000)
  }

  return (
    <AppLayout>
      <Topbar titulo="Calculadora de reajuste" />
      <div className="flex-1 overflow-y-auto p-6">
        {sucesso && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm font-medium flex items-center justify-between">
            {sucesso}
            <button onClick={() => setSucesso('')}><X size={14} /></button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          {/* Seleção do contrato */}
          <div className="card">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <TrendingUp size={15} className="text-blue-500" />Selecione o contrato
            </h2>
            {loading ? (
              <div className="text-sm text-gray-400">Carregando contratos...</div>
            ) : contratos.length === 0 ? (
              <div className="text-sm text-gray-400">Nenhum contrato ativo encontrado</div>
            ) : (
              <div className="space-y-2">
                {contratos.map(c => (
                  <div key={c.id}
                    onClick={() => selecionarContrato(c)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${contratoSel?.id === c.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">#{c.numero} — {getTitulo(c.imovel)}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{getNome(c.locatario)} · Índice: {(c.indice_reajuste || 'igpm').toUpperCase()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900">{formatVal(c.valor_atual || c.valor_mensal)}</div>
                        <div className="text-xs text-gray-400">valor atual</div>
                      </div>
                    </div>
                    {c.proximo_reajuste && (
                      <div className="text-[10px] text-gray-400 mt-1">
                        Próximo reajuste: {new Intl.DateTimeFormat('pt-BR').format(new Date(c.proximo_reajuste + 'T00:00:00'))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Calculadora */}
          <div>
            {!contratoSel ? (
              <div className="card text-center py-16 text-gray-400">
                <TrendingUp size={36} className="mx-auto mb-3 opacity-30" />
                <div className="font-medium text-gray-500">Selecione um contrato</div>
                <div className="text-sm mt-1">para calcular o reajuste</div>
              </div>
            ) : (
              <>
                <div className="card mb-4">
                  <h2 className="text-sm font-semibold mb-4">Índice de reajuste — acumulado 12 meses</h2>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {indices.map(idx => (
                      <div key={idx.key}
                        onClick={() => { setIndiceSel(idx.key); setPctCustom(''); setEditandoValor(false); setValorEditado('') }}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${indiceSel === idx.key && !pctCustom ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className="text-xs font-medium text-gray-600">{idx.label} <span className="text-gray-400">({idx.fonte})</span></div>
                        <div className="text-xl font-semibold text-blue-600 mt-1">+{idx.pct.toFixed(2).replace('.', ',')}%</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="label">Ou informe percentual manual (%)</label>
                    <input className="input" type="number" step="0.01" value={pctCustom}
                      onChange={e => { setPctCustom(e.target.value); setIndiceSel(''); setEditandoValor(false); setValorEditado('') }}
                      placeholder="Ex: 4.50" />
                  </div>
                </div>

                <div className="card mb-4">
                  <h2 className="text-sm font-semibold mb-4">Resultado do reajuste</h2>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
                      <span className="text-gray-500">Valor atual</span>
                      <span className="font-medium">{formatVal(valorBase)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
                      <span className="text-gray-500">Índice aplicado</span>
                      <span className="font-medium text-blue-600">+{pct.toFixed(2).replace('.', ',')}%</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
                      <span className="text-gray-500">Acréscimo mensal</span>
                      <span className="font-medium text-green-600">+ {formatVal(acrescimo)}</span>
                    </div>

                    {/* Novo valor — editável */}
                    <div className="flex justify-between items-center py-3">
                      <span className="font-semibold text-base">Novo valor mensal</span>
                      <div className="flex items-center gap-2">
                        {editandoValor ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">R$</span>
                            <input
                              className="input text-right font-bold text-green-600 text-lg w-32 py-1"
                              value={valorEditado}
                              onChange={e => setValorEditado(e.target.value)}
                              placeholder={novoValorCalculado.toFixed(2)}
                              autoFocus
                            />
                            <button onClick={() => { setEditandoValor(false); setValorEditado('') }}
                              className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                          </div>
                        ) : (
                          <>
                            <span className="font-bold text-green-600 text-lg">{formatVal(novoValor)}</span>
                            <button
                              onClick={() => { setEditandoValor(true); setValorEditado(novoValorCalculado.toFixed(2)) }}
                              className="text-gray-300 hover:text-blue-500 transition-colors"
                              title="Editar valor manualmente">
                              <Edit2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {editandoValor && (
                      <p className="text-[10px] text-orange-500">⚠ Valor editado manualmente — diferente do cálculo automático</p>
                    )}
                  </div>

                  {/* Comparativo */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="text-xs font-medium text-gray-500 mb-2">Comparativo entre índices</div>
                    {indices.map(idx => (
                      <div key={idx.key} className="flex justify-between text-xs py-1">
                        <span className="text-gray-500">{idx.label} (+{idx.pct.toFixed(2).replace('.', ',')}%)</span>
                        <span className="font-medium text-green-600">{formatVal(valorBase * (1 + idx.pct / 100))}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={aplicarReajuste} disabled={aplicando || pct === 0}
                      className="btn btn-primary flex-1">
                      <Check size={14} />{aplicando ? 'Aplicando...' : 'Aplicar reajuste ao contrato'}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">O reajuste será salvo no histórico e o contrato atualizado automaticamente.</p>
                </div>

                {/* Histórico de reajustes */}
                {historico.length > 0 && (
                  <div className="card">
                    <button
                      onClick={() => setShowHistorico(!showHistorico)}
                      className="flex items-center gap-2 text-sm font-semibold w-full text-left">
                      <History size={14} className="text-gray-400" />
                      Histórico de reajustes ({historico.length})
                      <span className="ml-auto text-gray-400 text-xs">{showHistorico ? '▲' : '▼'}</span>
                    </button>

                    {showHistorico && (
                      <div className="mt-3 space-y-2">
                        {historico.map(r => (
                          <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div>
                              <div className="text-xs font-medium text-gray-700">
                                {new Date(r.data_aplicacao + 'T12:00:00').toLocaleDateString('pt-BR')} — {r.indice} +{r.percentual.toFixed(2).replace('.', ',')}%
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">
                                {formatVal(r.valor_anterior)} → <span className="text-green-600 font-medium">{formatVal(r.valor_novo)}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => desfazerReajuste(r)}
                              disabled={desfazendo === r.id}
                              className="btn btn-sm text-orange-500 border-orange-200 hover:bg-orange-50"
                              title="Desfazer este reajuste">
                              <Undo2 size={12} />{desfazendo === r.id ? '...' : 'Desfazer'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
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
