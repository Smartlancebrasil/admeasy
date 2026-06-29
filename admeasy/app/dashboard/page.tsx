'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { supabase } from '@/lib/supabase'
import { Building2, FileText, Wrench, DollarSign, AlertTriangle, TrendingUp } from 'lucide-react'

type Alerta = { tipo: string; msg: string; sub?: string }

function formatVal(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date + 'T00:00:00'))
}

function diasRestantes(dataFim: string) {
  const hoje = new Date()
  const fim = new Date(dataFim + 'T00:00:00')
  return Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [metricas, setMetricas] = useState({
    totalImoveis: 0, imoveisAlugados: 0, imoveisVenda: 0, imoveisDisponiveis: 0,
    totalContratos: 0, contratosAtivos: 0,
    totalClientes: 0,
    receitaMes: 0, taxaAdmMes: 0,
  })
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [vencimentos, setVencimentos] = useState<any[]>([])
  const [imovelStatus, setImovelStatus] = useState<Record<string,number>>({})

  useEffect(() => { carregarDados() }, [])

  async function carregarDados() {
    setLoading(true)
    await Promise.all([
      carregarImoveis(),
      carregarContratos(),
      carregarClientes(),
      carregarFinanceiro(),
    ])
    setLoading(false)
  }

  async function carregarImoveis() {
    const { data } = await supabase.from('imoveis').select('status, finalidade')
    if (!data) return
    const total = data.length
    const alugados = data.filter(i => i.status === 'alugado').length
    const venda = data.filter(i => i.status === 'vendido' || i.finalidade === 'venda').length
    const disponiveis = data.filter(i => i.status === 'disponivel').length
    const statusCount: Record<string,number> = {}
    data.forEach(i => { statusCount[i.status] = (statusCount[i.status] || 0) + 1 })
    setImovelStatus(statusCount)
    setMetricas(m => ({ ...m, totalImoveis: total, imoveisAlugados: alugados, imoveisVenda: venda, imoveisDisponiveis: disponiveis }))
  }

  async function carregarContratos() {
    const { data } = await supabase
      .from('contratos')
      .select('id, numero, status, data_fim, valor_mensal, imovel:imoveis(titulo), locatario:clientes!contratos_locatario_id_fkey(nome)')
      .order('data_fim', { ascending: true })
    if (!data) return

    const ativos = data.filter(c => c.status === 'ativo' || c.status === 'pendente')
    setMetricas(m => ({ ...m, totalContratos: data.length, contratosAtivos: ativos.length }))

    // Vencimentos próximos
    const venc = ativos
      .map(c => ({ ...c, dias: diasRestantes(c.data_fim) }))
      .filter(c => c.dias <= 60)
      .sort((a, b) => a.dias - b.dias)
      .slice(0, 5)
    setVencimentos(venc)

    // Alertas de vencimento
    const al: Alerta[] = []
    venc.filter(c => c.dias <= 15).forEach(c => {
      const imovel = Array.isArray(c.imovel) ? c.imovel[0] : c.imovel
      const locatario = Array.isArray(c.locatario) ? c.locatario[0] : c.locatario
      al.push({
        tipo: c.dias <= 5 ? 'danger' : 'warning',
        msg: `Contrato #${c.numero} vence em ${c.dias} dias`,
        sub: `${imovel?.titulo || ''} · ${locatario?.nome || ''}`,
      })
    })
    setAlertas(al)
  }

  async function carregarClientes() {
    const { count } = await supabase.from('clientes').select('id', { count: 'exact', head: true })
    setMetricas(m => ({ ...m, totalClientes: count || 0 }))
  }

  async function carregarFinanceiro() {
    const inicioMes = new Date()
    inicioMes.setDate(1)
    const inicioStr = inicioMes.toISOString().split('T')[0]

    const { data } = await supabase
      .from('cobrancas')
      .select('valor_aluguel, valor_taxa_adm, status_cobranca')
      .gte('data_vencimento', inicioStr)

    if (!data) return
    const recebido = data.filter(c => c.status_cobranca === 'pago').reduce((s, c) => s + c.valor_aluguel, 0)
    const taxa = data.filter(c => c.status_cobranca === 'pago').reduce((s, c) => s + c.valor_taxa_adm, 0)
    setMetricas(m => ({ ...m, receitaMes: recebido, taxaAdmMes: taxa }))
  }

  const corAlerta: Record<string, string> = {
    danger: 'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    success: 'bg-green-50 border-green-200 text-green-700',
  }

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
                <div className="text-xs text-gray-400 mb-2 flex items-center gap-1.5"><Building2 size={13} />Imóveis cadastrados</div>
                <div className="text-2xl font-semibold">{metricas.totalImoveis}</div>
                <div className="text-xs text-gray-400 mt-1">{metricas.imoveisAlugados} alugados · {metricas.imoveisDisponiveis} disponíveis</div>
              </div>
              <div className="card">
                <div className="text-xs text-gray-400 mb-2 flex items-center gap-1.5"><FileText size={13} />Contratos ativos</div>
                <div className="text-2xl font-semibold">{metricas.contratosAtivos}</div>
                <div className="text-xs text-gray-400 mt-1">{vencimentos.length > 0 ? <span className="text-yellow-600">{vencimentos.filter(v => v.dias <= 30).length} vencem em 30 dias</span> : 'Todos em dia'}</div>
              </div>
              <div className="card">
                <div className="text-xs text-gray-400 mb-2 flex items-center gap-1.5"><TrendingUp size={13} />Receita do mês</div>
                <div className="text-2xl font-semibold text-green-600">{formatVal(metricas.receitaMes)}</div>
                <div className="text-xs text-gray-400 mt-1">Taxa adm: {formatVal(metricas.taxaAdmMes)}</div>
              </div>
              <div className="card">
                <div className="text-xs text-gray-400 mb-2 flex items-center gap-1.5"><Wrench size={13} />Clientes cadastrados</div>
                <div className="text-2xl font-semibold">{metricas.totalClientes}</div>
                <div className="text-xs text-gray-400 mt-1">Locatários, locadores e leads</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              {/* ALERTAS */}
              <div>
                <div className="card mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle size={14} className="text-yellow-500" />
                    <h2 className="text-sm font-semibold">Alertas</h2>
                  </div>
                  {alertas.length === 0 ? (
                    <div className="text-xs text-gray-400 py-2">✓ Nenhum alerta no momento</div>
                  ) : (
                    <div className="space-y-2">
                      {alertas.map((a, i) => (
                        <div key={i} className={`px-3 py-2.5 rounded-lg border text-xs ${corAlerta[a.tipo]}`}>
                          <div className="font-medium">{a.msg}</div>
                          {a.sub && <div className="opacity-75 mt-0.5">{a.sub}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* IMÓVEIS POR STATUS */}
                <div className="card">
                  <h2 className="text-sm font-semibold mb-3">Imóveis por status</h2>
                  {metricas.totalImoveis === 0 ? (
                    <div className="text-xs text-gray-400">Nenhum imóvel cadastrado</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'alugado', label: 'Alugados', cor: 'bg-blue-50 text-blue-700' },
                        { key: 'disponivel', label: 'Disponíveis', cor: 'bg-green-50 text-green-700' },
                        { key: 'em_analise', label: 'Em análise', cor: 'bg-yellow-50 text-yellow-700' },
                        { key: 'vendido', label: 'Vendidos', cor: 'bg-gray-50 text-gray-600' },
                      ].map(s => (
                        <div key={s.key} className={`rounded-lg p-3 text-center ${s.cor}`}>
                          <div className="text-xl font-semibold">{imovelStatus[s.key] || 0}</div>
                          <div className="text-xs mt-0.5">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* VENCIMENTOS */}
              <div className="card">
                <h2 className="text-sm font-semibold mb-3">Contratos — próximos vencimentos</h2>
                {vencimentos.length === 0 ? (
                  <div className="text-xs text-gray-400 py-4 text-center">Nenhum contrato vencendo nos próximos 60 dias</div>
                ) : (
                  <div>
                    {vencimentos.map((c, i) => {
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
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}

