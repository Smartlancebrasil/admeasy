'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { supabase } from '@/lib/supabase'
import { Building2, FileText, TrendingUp, AlertTriangle, Users, CheckCircle } from 'lucide-react'
import Link from 'next/link'

function formatVal(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}
function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date + 'T00:00:00'))
}
function diasRestantes(dataFim: string) {
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const fim = new Date(dataFim + 'T00:00:00')
  return Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

type Cobranca = {
  id: string
  mes_referencia: string
  valor_aluguel: number
  data_vencimento: string
  status_cobranca: string
  contrato?: any
  locatario?: any
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [metricas, setMetricas] = useState({
    totalImoveis: 0, imoveisAlugados: 0, imoveisDisponiveis: 0,
    contratosAtivos: 0,
    totalClientes: 0,
    receitaMes: 0, taxaAdmMes: 0, aReceberMes: 0,
  })
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([])
  const [vencimentos, setVencimentos] = useState<any[]>([])
  const [imovelStatus, setImovelStatus] = useState<Record<string,number>>({})

  useEffect(() => { carregarDados() }, [])

  async function carregarDados() {
    setLoading(true)
    await Promise.all([carregarImoveis(), carregarContratos(), carregarClientes(), carregarCobrancas()])
    setLoading(false)
  }

  async function carregarImoveis() {
    const { data } = await supabase.from('imoveis').select('status, finalidade')
    if (!data) return
    const statusCount: Record<string,number> = {}
    data.forEach(i => { statusCount[i.status] = (statusCount[i.status] || 0) + 1 })
    setImovelStatus(statusCount)
    setMetricas(m => ({
      ...m,
      totalImoveis: data.length,
      imoveisAlugados: data.filter(i => i.status === 'alugado').length,
      imoveisDisponiveis: data.filter(i => i.status === 'disponivel').length,
    }))
  }

  async function carregarContratos() {
    const { data } = await supabase
      .from('contratos')
      .select('id, numero, status, data_fim, valor_mensal, imovel:imoveis(titulo), locatario:clientes!contratos_locatario_id_fkey(nome)')
      .order('data_fim', { ascending: true })
    if (!data) return
    const ativos = data.filter(c => c.status === 'ativo' || c.status === 'pendente')
    setMetricas(m => ({ ...m, contratosAtivos: ativos.length }))
    const venc = ativos
      .map(c => ({ ...c, dias: diasRestantes(c.data_fim) }))
      .filter(c => c.dias <= 60)
      .sort((a,b) => a.dias - b.dias)
      .slice(0,5)
    setVencimentos(venc)
  }

  async function carregarClientes() {
    const { count } = await supabase.from('clientes').select('id', { count: 'exact', head: true })
    setMetricas(m => ({ ...m, totalClientes: count || 0 }))
  }

  async function carregarCobrancas() {
    const { data } = await supabase
      .from('cobrancas')
      .select(`id, mes_referencia, valor_aluguel, taxa_administracao_pct, valor_taxa_adm, data_vencimento, status_cobranca,
        contrato:contratos(numero, imovel:imoveis(titulo)),
        locatario:clientes!cobrancas_locatario_id_fkey(nome)`)
      .order('data_vencimento', { ascending: true })
    if (!data) return
    setCobrancas(data)

    const pago = data.filter(c => c.status_cobranca === 'pago')
    const pendente = data.filter(c => c.status_cobranca === 'pendente')
    setMetricas(m => ({
      ...m,
      receitaMes: pago.reduce((s,c) => s + (c as any).valor_taxa_adm, 0),
      aReceberMes: pendente.reduce((s,c) => s + c.valor_aluguel, 0),
    }))
  }

  // Semáforo de inadimplência
  function semaforo(c: Cobranca): 'verde' | 'amarelo' | 'vermelho' | 'pago' {
    if (c.status_cobranca === 'pago') return 'pago'
    const dias = diasRestantes(c.data_vencimento)
    if (dias < 0) return 'vermelho'
    if (dias <= 5) return 'amarelo'
    return 'verde'
  }

  const semCor: Record<string, string> = {
    pago:     'bg-green-500',
    verde:    'bg-green-400',
    amarelo:  'bg-yellow-400',
    vermelho: 'bg-red-500',
  }
  const semBorder: Record<string, string> = {
    pago:     'border-green-200 bg-green-50',
    verde:    'border-green-200 bg-green-50',
    amarelo:  'border-yellow-200 bg-yellow-50',
    vermelho: 'border-red-200 bg-red-50',
  }
  const semLabel: Record<string, string> = {
    pago:     'Pago',
    verde:    'Em dia',
    amarelo:  'Vence em breve',
    vermelho: 'Vencido',
  }

  const inadimplentes = cobrancas.filter(c => semaforo(c) === 'vermelho')
  const alertaAmarelo = cobrancas.filter(c => semaforo(c) === 'amarelo')

  return (
    <AppLayout>
      <Topbar titulo="Dashboard" />
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Carregando dados...</div>
        ) : (
          <>
            {/* MÉTRICAS */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="card">
                <div className="text-xs text-gray-400 mb-2 flex items-center gap-1.5"><Building2 size={13} />Imóveis</div>
                <div className="text-2xl font-semibold">{metricas.totalImoveis}</div>
                <div className="text-xs text-gray-400 mt-1">{metricas.imoveisAlugados} alugados · {metricas.imoveisDisponiveis} disponíveis</div>
              </div>
              <div className="card">
                <div className="text-xs text-gray-400 mb-2 flex items-center gap-1.5"><FileText size={13} />Contratos ativos</div>
                <div className="text-2xl font-semibold">{metricas.contratosAtivos}</div>
                <div className="text-xs mt-1">
                  {inadimplentes.length > 0
                    ? <span className="text-red-600 font-medium">{inadimplentes.length} inadimplente(s)</span>
                    : <span className="text-green-600">Todos em dia</span>}
                </div>
              </div>
              <div className="card">
                <div className="text-xs text-gray-400 mb-2 flex items-center gap-1.5"><TrendingUp size={13} />Taxa adm. recebida</div>
                <div className="text-2xl font-semibold text-green-600">{formatVal(metricas.receitaMes)}</div>
                <div className="text-xs text-gray-400 mt-1">A receber: {formatVal(metricas.aReceberMes)}</div>
              </div>
              <div className="card">
                <div className="text-xs text-gray-400 mb-2 flex items-center gap-1.5"><Users size={13} />Clientes</div>
                <div className="text-2xl font-semibold">{metricas.totalClientes}</div>
                <div className="text-xs text-gray-400 mt-1">Cadastrados no sistema</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5 mb-5">
              {/* SEMÁFORO DE COBRANÇAS */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-yellow-500" />
                    <h2 className="text-sm font-semibold">Painel de cobranças</h2>
                  </div>
                  <Link href="/financeiro" className="text-xs text-blue-600 hover:underline">Ver financeiro →</Link>
                </div>

                {cobrancas.length === 0 ? (
                  <div className="text-xs text-gray-400 py-4 text-center">
                    Nenhuma cobrança gerada ainda.{' '}
                    <Link href="/financeiro" className="text-blue-600 hover:underline">Gerar cobrança</Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cobrancas.map(c => {
                      const sem = semaforo(c)
                      const dias = diasRestantes(c.data_vencimento)
                      const imovel = c.contrato?.imovel
                      const titulo = Array.isArray(imovel) ? imovel[0]?.titulo : imovel?.titulo
                      const locNome = Array.isArray(c.locatario) ? c.locatario[0]?.nome : c.locatario?.nome
                      return (
                        <div key={c.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${semBorder[sem]}`}>
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${semCor[sem]}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-900 truncate">{titulo || '—'} · {locNome || '—'}</div>
                            <div className="text-[10px] text-gray-500">{c.mes_referencia} · Vence {formatDate(c.data_vencimento)}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-xs font-semibold">{formatVal(c.valor_aluguel)}</div>
                            <div className="text-[10px] text-gray-500">
                              {sem === 'pago' ? '✓ Pago'
                                : sem === 'vermelho' ? `${Math.abs(dias)}d atraso`
                                : sem === 'amarelo' ? `${dias}d restantes`
                                : `${dias}d restantes`}
                            </div>
                          </div>
                          <div className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                            sem === 'pago' ? 'bg-green-100 text-green-700'
                            : sem === 'vermelho' ? 'bg-red-100 text-red-700'
                            : sem === 'amarelo' ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                          }`}>{semLabel[sem]}</div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Legenda */}
                <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
                  {[
                    { cor: 'bg-green-500', label: 'Pago / Em dia' },
                    { cor: 'bg-yellow-400', label: 'Vence em ≤5 dias' },
                    { cor: 'bg-red-500', label: 'Vencido' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5 text-[10px] text-gray-500">
                      <div className={`w-2.5 h-2.5 rounded-full ${l.cor}`} />
                      {l.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* VENCIMENTOS DE CONTRATO */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold">Contratos — próximos vencimentos</h2>
                  <Link href="/contratos" className="text-xs text-blue-600 hover:underline">Ver todos →</Link>
                </div>
                {vencimentos.length === 0 ? (
                  <div className="text-xs text-gray-400 py-4 text-center">Nenhum contrato vencendo nos próximos 60 dias</div>
                ) : (
                  vencimentos.map((c, i) => {
                    const imovel = Array.isArray(c.imovel) ? c.imovel[0] : c.imovel
                    const locatario = Array.isArray(c.locatario) ? c.locatario[0] : c.locatario
                    return (
                      <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                        <div>
                          <div className="text-xs font-medium text-gray-900">#{c.numero} — {imovel?.titulo || '—'}</div>
                          <div className="text-xs text-gray-400">{locatario?.nome || '—'}</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xs font-semibold ${c.dias <= 5 ? 'text-red-600' : c.dias <= 15 ? 'text-yellow-600' : c.dias <= 30 ? 'text-orange-500' : 'text-gray-500'}`}>
                            {formatDate(c.data_fim)}
                          </div>
                          <div className="text-[10px] text-gray-400">{c.dias} dias</div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* IMÓVEIS POR STATUS */}
            <div className="card">
              <h2 className="text-sm font-semibold mb-3">Imóveis por status</h2>
              {metricas.totalImoveis === 0 ? (
                <div className="text-xs text-gray-400">Nenhum imóvel cadastrado</div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { key: 'alugado', label: 'Alugados', cor: 'bg-blue-50 text-blue-700' },
                    { key: 'disponivel', label: 'Disponíveis', cor: 'bg-green-50 text-green-700' },
                    { key: 'em_analise', label: 'Em análise', cor: 'bg-yellow-50 text-yellow-700' },
                    { key: 'vendido', label: 'Vendidos', cor: 'bg-gray-50 text-gray-600' },
                  ].map(s => (
                    <div key={s.key} className={`rounded-lg p-3 text-center ${s.cor}`}>
                      <div className="text-2xl font-semibold">{imovelStatus[s.key] || 0}</div>
                      <div className="text-xs mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}