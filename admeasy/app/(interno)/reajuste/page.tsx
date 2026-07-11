'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { useOrganization } from '@/lib/OrganizationContext'
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
  const { organizacao } = useOrganization()
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

  useEffect(() => {
    if (organizacao?.id) buscarContratos(organizacao.id)
  }, [organizacao?.id])

  async function buscarContratos(orgId: string) {
    setLoading(true)
    const { data } = await supabase
      .from('contratos')
      .select(`*, imovel:imoveis(titulo), locatario:clientes!contratos_locatario_id_fkey(nome), locador:clientes!contratos_locador_id_fkey(nome)`)
      .eq('organization_id', orgId)
      .eq('status', 'ativo')
      .order('numero')
    if (data) setContratos(data)
    setLoading(false)
  }

  async function selecionarContrato(c: Contrato) {
    if (!organizacao?.id) return
    setContratoSel(c)
    setIndiceSel(c.indice_reajuste || 'igpm')
    setEditandoValor(false)
    setValorEditado('')
    setShowHistorico(false)
    const { data } = await supabase
      .from('reajustes')
      .select('*')
      .eq('organization_id', organizacao.id)
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
    if (!contratoSel || !organizacao?.id) return
    setAplicando(true)

    const hoje = new Date().toISOString().split('T')[0]
    const proximoAno = new Date()
    proximoAno.setFullYear(proximoAno.getFullYear() + 1)

    await supabase.from('reajustes').insert([{
      contrato_id: contratoSel.id,
      organization_id: organizacao.id,
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
    }).eq('id', contratoSel.id).eq('organization_id', organizacao.id)

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
    buscarContratos(organizacao.id)
    setContratoSel(null)
    setAplicando(false)
    setTimeout(() => setSucesso(''), 4000)
  }

  async function desfazerReajuste(r: Reajuste) {
    if (!organizacao?.id) return
    if (!confirm(`Desfazer reajuste de ${formatVal(r.valor_anterior)} → ${formatVal(r.valor_novo)}? O contrato voltará ao valor anterior.`)) return
    setDesfazendo(r.id)

    await supabase.from('contratos').update({
      valor_atual: r.valor_anterior,
    }).eq('id', r.contrato_id).eq('organization_id', organizacao.id)

    await supabase.from('reajustes').delete().eq('id', r.id).eq('organization_id', organizacao.id)

    await registrarLog({
      acao: 'editou',
      modulo: 'contrato',
      registro_id: r.contrato_id,
      registro_nome: `Contrato #${contratoSel?.numero}`,
      descricao: `Reajuste desfeito — valor revertido para: ${formatVal(r.valor_anterior)}`,
    })

    setSucesso(`Reajuste desfeito! Valor revertido para ${formatVal(r.valor_anterior)}`)
    buscarContratos(organizacao.id)
    if (contratoSel) selecionarContrato({ ...contratoSel, valor_atual: r.valor_anterior })
    setDesfazendo(null)
    setTimeout(() => setSucesso(''), 4000)
  }

  return (
    <AppLayout>
      <div style={{ background: '#0d1117', minHeight: '100vh' }} className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-[1600px] mx-auto">

          <h1 style={{ color: '#f4f4f3' }} className="text-lg font-medium mb-5">Calculadora de reajuste</h1>

          {sucesso && (
            <div style={{ background: '#1a2e1f', border: '0.5px solid #2d4a35', color: '#3fb950' }} className="px-4 py-3 rounded-lg mb-4 text-sm font-medium flex items-center justify-between">
              {sucesso}
              <button onClick={() => setSucesso('')}><X size={14} /></button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h2 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-4 flex items-center gap-2">
                <TrendingUp size={15} style={{ color: '#5b9bf5' }} />Selecione o contrato
              </h2>
              {loading ? (
                <div style={{ color: '#8b8d98' }} className="text-sm">Carregando contratos...</div>
              ) : contratos.length === 0 ? (
                <div style={{ color: '#8b8d98' }} className="text-sm">Nenhum contrato ativo encontrado</div>
              ) : (
                <div className="space-y-2">
                  {contratos.map(c => {
                    const sel = contratoSel?.id === c.id
                    return (
                      <div key={c.id}
                        onClick={() => selecionarContrato(c)}
                        style={sel ? { border: '0.5px solid #2563eb', background: '#16243a' } : { border: '0.5px solid #2a2f3a' }}
                        className="p-3 rounded-lg cursor-pointer transition-all hover:border-gray-500">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <div className="min-w-0">
                            <div style={{ color: '#f4f4f3' }} className="text-sm font-medium truncate">#{c.numero} — {getTitulo(c.imovel)}</div>
                            <div style={{ color: '#8b8d98' }} className="text-xs mt-0.5 truncate">{getNome(c.locatario)} · Índice: {(c.indice_reajuste || 'igpm').toUpperCase()}</div>
                          </div>
                          <div className="sm:text-right flex-shrink-0">
                            <div style={{ color: '#f4f4f3' }} className="text-sm font-semibold">{formatVal(c.valor_atual || c.valor_mensal)}</div>
                            <div style={{ color: '#8b8d98' }} className="text-xs">valor atual</div>
                          </div>
                        </div>
                        {c.proximo_reajuste && (() => {
                          const hoje = new Date(); hoje.setHours(0,0,0,0)
                          const dataReaj = new Date(c.proximo_reajuste + 'T00:00:00')
                          const dias = Math.ceil((dataReaj.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
                          const cor = dias <= 5 ? '#ef4444' : dias <= 30 ? '#f59e0b' : '#3fb950'
                          const label = dias <= 5 ? `⚠ Reajuste em ${dias} dia${dias !== 1 ? 's' : ''}` : `Próximo reajuste em ${dias} dias`
                          return (
                            <div style={{ color: cor, fontWeight: dias <= 5 ? 600 : 400 }} className="text-[10px] mt-1">
                              {label}
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              {!contratoSel ? (
                <div className="card text-center py-16" style={{ color: '#8b8d98' }}>
                  <TrendingUp size={36} className="mx-auto mb-3 opacity-30" />
                  <div style={{ color: '#c3c2b7' }} className="font-medium">Selecione um contrato</div>
                  <div className="text-sm mt-1">para calcular o reajuste</div>
                </div>
              ) : (
                <>
                  <div className="card mb-4">
                    <h2 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-4">Índice de reajuste — acumulado 12 meses</h2>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {indices.map(idx => {
                        const sel = indiceSel === idx.key && !pctCustom
                        return (
                          <div key={idx.key}
                            onClick={() => { setIndiceSel(idx.key); setPctCustom(''); setEditandoValor(false); setValorEditado('') }}
                            style={sel ? { border: '0.5px solid #2563eb', background: '#16243a' } : { border: '0.5px solid #2a2f3a' }}
                            className="p-3 rounded-lg cursor-pointer transition-all hover:border-gray-500">
                            <div style={{ color: '#a8aab5' }} className="text-xs font-medium">{idx.label} <span style={{ color: '#5b5e6b' }}>({idx.fonte})</span></div>
                            <div style={{ color: '#5b9bf5' }} className="text-xl font-semibold mt-1">+{idx.pct.toFixed(2).replace('.', ',')}%</div>
                          </div>
                        )
                      })}
                    </div>
                    <div>
                      <label className="label">Ou informe percentual manual (%)</label>
                      <input className="input" type="number" step="0.01" value={pctCustom}
                        onChange={e => { setPctCustom(e.target.value); setIndiceSel(''); setEditandoValor(false); setValorEditado('') }}
                        placeholder="Ex: 4.50" />
                    </div>
                  </div>

                  <div className="card mb-4">
                    <h2 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-4">Resultado do reajuste</h2>
                    <div className="space-y-2 mb-4">
                      <div style={{ borderBottom: '0.5px solid #1c2128' }} className="flex justify-between py-2 text-sm">
                        <span style={{ color: '#8b8d98' }}>Valor atual</span>
                        <span style={{ color: '#f4f4f3' }} className="font-medium">{formatVal(valorBase)}</span>
                      </div>
                      <div style={{ borderBottom: '0.5px solid #1c2128' }} className="flex justify-between py-2 text-sm">
                        <span style={{ color: '#8b8d98' }}>Índice aplicado</span>
                        <span style={{ color: '#5b9bf5' }} className="font-medium">+{pct.toFixed(2).replace('.', ',')}%</span>
                      </div>
                      <div style={{ borderBottom: '0.5px solid #1c2128' }} className="flex justify-between py-2 text-sm">
                        <span style={{ color: '#8b8d98' }}>Acréscimo mensal</span>
                        <span style={{ color: '#3fb950' }} className="font-medium">+ {formatVal(acrescimo)}</span>
                      </div>

                      <div className="flex justify-between items-center py-3">
                        <span style={{ color: '#f4f4f3' }} className="font-semibold text-base">Novo valor mensal</span>
                        <div className="flex items-center gap-2">
                          {editandoValor ? (
                            <div className="flex items-center gap-2">
                              <span style={{ color: '#8b8d98' }} className="text-sm">R$</span>
                              <input
                                className="input text-right font-bold text-lg w-32 py-1"
                                style={{ color: '#3fb950' }}
                                value={valorEditado}
                                onChange={e => setValorEditado(e.target.value)}
                                placeholder={novoValorCalculado.toFixed(2)}
                                autoFocus
                              />
                              <button onClick={() => { setEditandoValor(false); setValorEditado('') }}
                                style={{ color: '#5b5e6b' }} className="hover:text-gray-300"><X size={14} /></button>
                            </div>
                          ) : (
                            <>
                              <span style={{ color: '#3fb950' }} className="font-bold text-lg">{formatVal(novoValor)}</span>
                              <button
                                onClick={() => { setEditandoValor(true); setValorEditado(novoValorCalculado.toFixed(2)) }}
                                style={{ color: '#5b5e6b' }} className="hover:text-blue-400 transition-colors"
                                title="Editar valor manualmente">
                                <Edit2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {editandoValor && (
                        <p style={{ color: '#f59e0b' }} className="text-[10px]">⚠ Valor editado manualmente — diferente do cálculo automático</p>
                      )}
                    </div>

                    <div style={{ background: '#0d1117', border: '0.5px solid #2a2f3a' }} className="rounded-lg p-3 mb-4">
                      <div style={{ color: '#8b8d98' }} className="text-xs font-medium mb-2">Comparativo entre índices</div>
                      {indices.map(idx => (
                        <div key={idx.key} className="flex justify-between text-xs py-1">
                          <span style={{ color: '#8b8d98' }}>{idx.label} (+{idx.pct.toFixed(2).replace('.', ',')}%)</span>
                          <span style={{ color: '#3fb950' }} className="font-medium">{formatVal(valorBase * (1 + idx.pct / 100))}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button onClick={aplicarReajuste} disabled={aplicando || pct === 0}
                        className="btn btn-primary flex-1">
                        <Check size={14} />{aplicando ? 'Aplicando...' : 'Aplicar reajuste ao contrato'}
                      </button>
                    </div>
                    <p style={{ color: '#5b5e6b' }} className="text-[10px] mt-2">O reajuste será salvo no histórico e o contrato atualizado automaticamente.</p>
                  </div>

                  {historico.length > 0 && (
                    <div className="card">
                      <button
                        onClick={() => setShowHistorico(!showHistorico)}
                        style={{ color: '#f4f4f3' }}
                        className="flex items-center gap-2 text-sm font-semibold w-full text-left">
                        <History size={14} style={{ color: '#8b8d98' }} />
                        Histórico de reajustes ({historico.length})
                        <span style={{ color: '#8b8d98' }} className="ml-auto text-xs">{showHistorico ? '▲' : '▼'}</span>
                      </button>

                      {showHistorico && (
                        <div className="mt-3 space-y-2">
                          {historico.map(r => (
                            <div key={r.id} style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="flex items-center justify-between p-3 rounded-lg">
                              <div>
                                <div style={{ color: '#c3c2b7' }} className="text-xs font-medium">
                                  {new Date(r.data_aplicacao + 'T12:00:00').toLocaleDateString('pt-BR')} — {r.indice} +{r.percentual.toFixed(2).replace('.', ',')}%
                                </div>
                                <div style={{ color: '#8b8d98' }} className="text-xs mt-0.5">
                                  {formatVal(r.valor_anterior)} → <span style={{ color: '#3fb950' }} className="font-medium">{formatVal(r.valor_novo)}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => desfazerReajuste(r)}
                                disabled={desfazendo === r.id}
                                style={{ color: '#f59e0b', border: '0.5px solid #4a3a1f' }}
                                className="btn btn-sm hover:bg-[#2e2515]"
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
      </div>
    </AppLayout>
  )
}
