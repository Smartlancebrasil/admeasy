'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import {
  Building2, FileText, TrendingUp, AlertTriangle, Wallet,
  CalendarClock, Scale, Percent
} from 'lucide-react'
import Chart from 'chart.js/auto'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

function formatVal(val: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0) }
function formatValCompact(val: number) {
  if (Math.abs(val) >= 1000) return `R$ ${(val / 1000).toFixed(1)}k`
  return formatVal(val)
}
function diasEntre(data: string) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const d = new Date(data + 'T00:00:00')
  return Math.ceil((d.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}
function getNome(val: any) {
  if (!val) return '—'
  if (Array.isArray(val)) return val[0]?.nome || val[0]?.titulo || '—'
  return val.nome || val.titulo || '—'
}
function mesLabel(mesStr: string) {
  const [, mes] = mesStr.split('-')
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return nomes[parseInt(mes) - 1]
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)

  const [totalImoveis, setTotalImoveis] = useState(0)
  const [imoveisAlugados, setImoveisAlugados] = useState(0)
  const [imoveisDisponiveis, setImoveisDisponiveis] = useState(0)
  const [imoveisAnalise, setImoveisAnalise] = useState(0)
  const [contratosAtivos, setContratosAtivos] = useState(0)

  const [cobrancasPagas, setCobrancasPagas] = useState<any[]>([])
  const [cobrancasAtrasadas, setCobrancasAtrasadas] = useState<any[]>([])
  const [cobrancasProximas, setCobrancasProximas] = useState<any[]>([])
  const [cobrancasPendentesTotal, setCobrancasPendentesTotal] = useState(0)

  const [taxaAdmTotal, setTaxaAdmTotal] = useState(0)
  const [taxaAdmTicketMedio, setTaxaAdmTicketMedio] = useState(0)
  const [fluxoCaixa, setFluxoCaixa] = useState({ entradas: 0, saidas: 0, saldo: 0 })
  const [taxaInadimplencia, setTaxaInadimplencia] = useState(0)

  const [contratosVencidos, setContratosVencidos] = useState<any[]>([])
  const [contratosAVencer, setContratosAVencer] = useState<any[]>([])

  const [processosAtivos, setProcessosAtivos] = useState(0)
  const [processosValorTotal, setProcessosValorTotal] = useState(0)

  const [evolucaoCarteira, setEvolucaoCarteira] = useState<{ mes: string; imoveis: number; receita: number }[]>([])

  const evoChartRef = useRef<HTMLCanvasElement>(null)
  const statusChartRef = useRef<HTMLCanvasElement>(null)
  const chartInstances = useRef<Chart[]>([])

  useEffect(() => { carregarTudo() }, [])

  useEffect(() => {
    if (loading) return
    chartInstances.current.forEach(c => c.destroy())
    chartInstances.current = []

    if (evoChartRef.current) {
      const c = new Chart(evoChartRef.current, {
        type: 'line',
        data: {
          labels: evolucaoCarteira.map(m => mesLabel(m.mes)),
          datasets: [
            { label: 'Receita', data: evolucaoCarteira.map(m => m.receita), borderColor: '#2a78d6', backgroundColor: 'rgba(42,120,214,0.1)', fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 },
            { label: 'Contratos', data: evolucaoCarteira.map(m => m.imoveis), borderColor: '#1baf7a', backgroundColor: 'rgba(27,175,122,0.08)', fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2, yAxisID: 'y1' },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1f2430', titleColor: '#fff', bodyColor: '#c3c2b7' } },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#8b8d98', font: { size: 10 } } },
            y: { display: false },
            y1: { display: false, position: 'right' },
          },
        },
      })
      chartInstances.current.push(c)
    }

    if (statusChartRef.current) {
      const c = new Chart(statusChartRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Alugados', 'Disponíveis', 'Em análise'],
          datasets: [{ data: [imoveisAlugados, imoveisDisponiveis, imoveisAnalise], backgroundColor: ['#2a78d6', '#1baf7a', '#eda100'], borderColor: '#161b22', borderWidth: 3 }],
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false } } },
      })
      chartInstances.current.push(c)
    }

    return () => { chartInstances.current.forEach(c => c.destroy()) }
  }, [loading, evolucaoCarteira, imoveisAlugados, imoveisDisponiveis, imoveisAnalise])

  async function carregarTudo() {
    setLoading(true)
    const hoje = new Date()
    const mesAtual = hoje.toISOString().slice(0, 7)

    const { data: imoveis } = await supabase.from('imoveis').select('id, status').eq('organization_id', ORG_ID)
    if (imoveis) {
      setTotalImoveis(imoveis.length)
      setImoveisAlugados(imoveis.filter(i => i.status === 'alugado').length)
      setImoveisDisponiveis(imoveis.filter(i => i.status === 'disponivel').length)
      setImoveisAnalise(imoveis.filter(i => i.status === 'em_analise').length)
    }

    const { data: contratos } = await supabase
      .from('contratos')
      .select('id, numero, data_fim, data_inicio, status, valor_atual, valor_mensal, taxa_administracao, imovel:imoveis(titulo), locatario:clientes!contratos_locatario_id_fkey(nome)')
      .eq('organization_id', ORG_ID)

    if (contratos) {
      const ativos = contratos.filter(c => c.status === 'ativo')
      setContratosAtivos(ativos.length)

      const somaTaxas = ativos.reduce((acc, c) => {
        const valor = c.valor_atual || c.valor_mensal || 0
        const taxaPct = c.taxa_administracao || 10
        return acc + (valor * taxaPct / 100)
      }, 0)
      setTaxaAdmTicketMedio(ativos.length > 0 ? somaTaxas / ativos.length : 0)

      const vencidos = contratos.filter(c => c.status === 'ativo' && diasEntre(c.data_fim) < 0)
      setContratosVencidos(vencidos)

      const aVencer = contratos.filter(c => {
        const dias = diasEntre(c.data_fim)
        return c.status === 'ativo' && dias >= 0 && dias <= 30
      }).sort((a, b) => diasEntre(a.data_fim) - diasEntre(b.data_fim))
      setContratosAVencer(aVencer)

      const meses: { mes: string; imoveis: number; receita: number }[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
        const mesStr = d.toISOString().slice(0, 7)
        const contratosNoMes = contratos.filter(c => {
          const inicio = new Date(c.data_inicio)
          return inicio <= new Date(d.getFullYear(), d.getMonth() + 1, 0) && (c.status === 'ativo' || c.status === 'encerrado')
        })
        const receitaMes = contratosNoMes.reduce((acc, c) => acc + (c.valor_atual || c.valor_mensal || 0), 0)
        meses.push({ mes: mesStr, imoveis: contratosNoMes.length, receita: receitaMes })
      }
      setEvolucaoCarteira(meses)
    }

    const { data: cobrancas } = await supabase
      .from('cobrancas')
      .select('*, contrato:contratos(numero, imovel:imoveis(titulo), locatario:clientes!contratos_locatario_id_fkey(nome))')
      .eq('organization_id', ORG_ID)
      .gte('data_vencimento', mesAtual + '-01')

    if (cobrancas) {
      const pagas = cobrancas.filter(c => c.status_cobranca === 'pago')
      const pendentes = cobrancas.filter(c => c.status_cobranca === 'pendente')
      const atrasadas = pendentes.filter(c => diasEntre(c.data_vencimento) < 0)
      const proximas = pendentes.filter(c => {
        const dias = diasEntre(c.data_vencimento)
        return dias >= 0 && dias <= 5
      }).sort((a, b) => diasEntre(a.data_vencimento) - diasEntre(b.data_vencimento))

      setCobrancasPagas(pagas)
      setCobrancasAtrasadas(atrasadas)
      setCobrancasProximas(proximas)
      setCobrancasPendentesTotal(pendentes.length)

      const somaTaxas = cobrancas.reduce((acc, c) => acc + (c.valor_taxa_adm || 0), 0)
      setTaxaAdmTotal(somaTaxas)

      const totalCobrancas = cobrancas.length
      setTaxaInadimplencia(totalCobrancas > 0 ? (atrasadas.length / totalCobrancas) * 100 : 0)
    }

    const { data: lancamentos } = await supabase.from('lancamentos').select('tipo, valor, status').eq('organization_id', ORG_ID)
    if (lancamentos) {
      const pagos = lancamentos.filter(l => l.status === 'pago' || l.status === 'recebido' || l.status === 'concluido')
      const entradas = pagos.filter(l => l.tipo === 'receita').reduce((acc, l) => acc + (l.valor || 0), 0)
      const saidas = pagos.filter(l => l.tipo === 'despesa').reduce((acc, l) => acc + (l.valor || 0), 0)
      setFluxoCaixa({ entradas, saidas, saldo: entradas - saidas })
    }

    const { data: processos } = await supabase.from('processos_judiciais').select('status, valor_causa').eq('organization_id', ORG_ID)
    if (processos) {
      const ativos = processos.filter(p => p.status === 'em_andamento' || p.status === 'suspenso')
      setProcessosAtivos(ativos.length)
      setProcessosValorTotal(ativos.reduce((acc, p) => acc + (p.valor_causa || 0), 0))
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center" style={{ background: '#0d1117', minHeight: '100vh' }}>
          <span className="text-gray-400 text-sm">Carregando dashboard...</span>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div style={{ background: '#0d1117', minHeight: '100vh' }} className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">

          <h1 style={{ color: '#f4f4f3' }} className="text-lg font-medium mb-5">Dashboard</h1>

          {/* Alertas */}
          {(cobrancasAtrasadas.length > 0 || contratosVencidos.length > 0 || processosAtivos > 0) && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {cobrancasAtrasadas.length > 0 && (
                <div style={{ background: '#2e1717', border: '0.5px solid #4a2424' }} className="rounded-xl p-3.5">
                  <div className="flex items-center gap-2 mb-1.5"><AlertTriangle size={13} style={{ color: '#ef4444' }} /><span style={{ color: '#fca5a5' }} className="text-xs font-medium">{cobrancasAtrasadas.length} aluguel(éis) em atraso</span></div>
                  {cobrancasAtrasadas.slice(0, 2).map((c, i) => (
                    <div key={i} style={{ color: '#c3c2b7' }} className="text-[11px] py-0.5">{getNome(c.contrato?.locatario)} — {formatVal(c.valor_aluguel)}</div>
                  ))}
                </div>
              )}
              {contratosVencidos.length > 0 && (
                <div style={{ background: '#2e1717', border: '0.5px solid #4a2424' }} className="rounded-xl p-3.5">
                  <div className="flex items-center gap-2 mb-1.5"><CalendarClock size={13} style={{ color: '#ef4444' }} /><span style={{ color: '#fca5a5' }} className="text-xs font-medium">{contratosVencidos.length} contrato(s) vencido(s)</span></div>
                  {contratosVencidos.slice(0, 2).map((c, i) => (
                    <div key={i} style={{ color: '#c3c2b7' }} className="text-[11px] py-0.5">#{c.numero} — {getNome(c.imovel)}</div>
                  ))}
                </div>
              )}
              {processosAtivos > 0 && (
                <div style={{ background: '#2e2515', border: '0.5px solid #4a3a1f' }} className="rounded-xl p-3.5">
                  <div className="flex items-center gap-2 mb-1.5"><Scale size={13} style={{ color: '#f59e0b' }} /><span style={{ color: '#fcd34d' }} className="text-xs font-medium">{processosAtivos} processo(s) ativo(s)</span></div>
                  <div style={{ color: '#c3c2b7' }} className="text-[11px]">Valor em causa: {formatVal(processosValorTotal)}</div>
                  <Link href="/processos-judiciais" style={{ color: '#fcd34d' }} className="text-[10px] hover:underline">Ver processos →</Link>
                </div>
              )}
            </div>
          )}

          {/* Cards principais */}
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-xl p-3.5">
              <div style={{ color: '#8b8d98' }} className="flex items-center gap-1.5 text-[11px] mb-1.5"><Wallet size={12} />Saldo em conta</div>
              <div style={{ color: fluxoCaixa.saldo >= 0 ? '#3fb950' : '#ef4444' }} className="text-xl font-medium">{formatVal(fluxoCaixa.saldo)}</div>
              <div className="flex gap-2.5 mt-1.5 text-[10px]">
                <span style={{ color: '#3fb950' }}>↑ {formatValCompact(fluxoCaixa.entradas)}</span>
                <span style={{ color: '#ef4444' }}>↓ {formatValCompact(fluxoCaixa.saidas)}</span>
              </div>
            </div>
            <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-xl p-3.5">
              <div style={{ color: '#8b8d98' }} className="flex items-center gap-1.5 text-[11px] mb-1.5"><TrendingUp size={12} />Taxa de adm. (mês)</div>
              <div style={{ color: '#f4f4f3' }} className="text-xl font-medium">{formatVal(taxaAdmTotal)}</div>
              <div style={{ color: '#8b8d98' }} className="text-[10px] mt-1.5">Ticket médio: {formatVal(taxaAdmTicketMedio)}</div>
            </div>
            <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-xl p-3.5">
              <div style={{ color: '#8b8d98' }} className="flex items-center gap-1.5 text-[11px] mb-1.5"><Percent size={12} />Inadimplência</div>
              <div style={{ color: taxaInadimplencia > 10 ? '#ef4444' : taxaInadimplencia > 0 ? '#f59e0b' : '#3fb950' }} className="text-xl font-medium">{taxaInadimplencia.toFixed(1)}%</div>
              <div style={{ color: '#8b8d98' }} className="text-[10px] mt-1.5">{cobrancasAtrasadas.length} de {cobrancasPagas.length + cobrancasPendentesTotal} cobranças</div>
            </div>
            <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-xl p-3.5">
              <div style={{ color: '#8b8d98' }} className="flex items-center gap-1.5 text-[11px] mb-1.5"><FileText size={12} />Contratos ativos</div>
              <div style={{ color: '#f4f4f3' }} className="text-xl font-medium">{contratosAtivos}</div>
              <div style={{ color: contratosAVencer.length > 0 ? '#f59e0b' : '#8b8d98' }} className="text-[10px] mt-1.5">{contratosAVencer.length > 0 ? `${contratosAVencer.length} vencendo em 30d` : 'Todos em dia'}</div>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-[1.4fr_1fr] gap-3 mb-3">
            <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-xl p-4">
              <div className="flex items-center justify-between mb-2.5">
                <p style={{ color: '#f4f4f3' }} className="text-xs font-medium">Evolução da carteira</p>
                <span style={{ color: '#8b8d98' }} className="text-[11px]">últimos 6 meses</span>
              </div>
              <div style={{ position: 'relative', height: '160px' }}>
                <canvas ref={evoChartRef} />
              </div>
            </div>
            <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-xl p-4">
              <p style={{ color: '#f4f4f3' }} className="text-xs font-medium mb-2.5">Imóveis por status</p>
              <div style={{ position: 'relative', height: '140px' }} className="mb-2">
                <canvas ref={statusChartRef} />
              </div>
              <div className="flex flex-col gap-1 text-[11px]" style={{ color: '#c3c2b7' }}>
                <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: 2, background: '#2a78d6' }} />Alugados {imoveisAlugados}</span>
                <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: 2, background: '#1baf7a' }} />Disponíveis {imoveisDisponiveis}</span>
                <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: 2, background: '#eda100' }} />Em análise {imoveisAnalise}</span>
              </div>
            </div>
          </div>

          {/* Painéis inferiores */}
          <div className="grid grid-cols-2 gap-3">
            <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-xl p-4">
              <div className="flex items-center justify-between mb-2.5">
                <p style={{ color: '#f4f4f3' }} className="text-xs font-medium">Cobranças do mês</p>
                <Link href="/financeiro" style={{ color: '#3987e5' }} className="text-[11px] hover:underline">Ver financeiro →</Link>
              </div>
              <div className="flex flex-col gap-1.5">
                {cobrancasProximas.slice(0, 2).map((c, i) => (
                  <div key={'p' + i} style={{ background: '#2e2515' }} className="flex justify-between items-center px-2.5 py-2 rounded-lg">
                    <span style={{ color: '#c3c2b7' }} className="text-[11px]">{getNome(c.contrato?.locatario)} · #{c.contrato?.numero}</span>
                    <span style={{ color: '#f59e0b' }} className="text-[11px] font-medium">Vence em {diasEntre(c.data_vencimento)}d</span>
                  </div>
                ))}
                {cobrancasAtrasadas.slice(0, 2).map((c, i) => (
                  <div key={'a' + i} style={{ background: '#2e1717' }} className="flex justify-between items-center px-2.5 py-2 rounded-lg">
                    <span style={{ color: '#c3c2b7' }} className="text-[11px]">{getNome(c.contrato?.locatario)} · #{c.contrato?.numero}</span>
                    <span style={{ color: '#ef4444' }} className="text-[11px] font-medium">{Math.abs(diasEntre(c.data_vencimento))}d atraso</span>
                  </div>
                ))}
                {cobrancasPagas.slice(0, 2).map((c, i) => (
                  <div key={'g' + i} style={{ background: '#1a2e1f' }} className="flex justify-between items-center px-2.5 py-2 rounded-lg">
                    <span style={{ color: '#c3c2b7' }} className="text-[11px]">{getNome(c.contrato?.locatario)} · #{c.contrato?.numero}</span>
                    <span style={{ color: '#3fb950' }} className="text-[11px] font-medium">Pago</span>
                  </div>
                ))}
                {cobrancasProximas.length === 0 && cobrancasAtrasadas.length === 0 && cobrancasPagas.length === 0 && (
                  <p style={{ color: '#8b8d98' }} className="text-[11px] text-center py-4">Nenhuma cobrança este mês</p>
                )}
              </div>
            </div>

            <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-xl p-4">
              <div className="flex items-center justify-between mb-2.5">
                <p style={{ color: '#f4f4f3' }} className="text-xs font-medium">Contratos vencendo</p>
                <Link href="/contratos" style={{ color: '#3987e5' }} className="text-[11px] hover:underline">Ver todos →</Link>
              </div>
              <div className="flex flex-col gap-1.5">
                {contratosVencidos.slice(0, 2).map((c, i) => (
                  <div key={'v' + i} style={{ background: '#2e1717' }} className="flex justify-between items-center px-2.5 py-2 rounded-lg">
                    <span style={{ color: '#c3c2b7' }} className="text-[11px]">#{c.numero} · {getNome(c.imovel)}</span>
                    <span style={{ color: '#ef4444' }} className="text-[11px] font-medium">vencido {Math.abs(diasEntre(c.data_fim))}d</span>
                  </div>
                ))}
                {contratosAVencer.slice(0, 3).map((c, i) => (
                  <div key={'av' + i} style={{ background: diasEntre(c.data_fim) <= 15 ? '#2e2515' : '#161b22', border: diasEntre(c.data_fim) <= 15 ? 'none' : '0.5px solid #2a2f3a' }} className="flex justify-between items-center px-2.5 py-2 rounded-lg">
                    <span style={{ color: '#c3c2b7' }} className="text-[11px]">#{c.numero} · {getNome(c.imovel)}</span>
                    <span style={{ color: diasEntre(c.data_fim) <= 15 ? '#f59e0b' : '#8b8d98' }} className="text-[11px] font-medium">{diasEntre(c.data_fim)}d restantes</span>
                  </div>
                ))}
                {contratosVencidos.length === 0 && contratosAVencer.length === 0 && (
                  <p style={{ color: '#8b8d98' }} className="text-[11px] text-center py-4">Nenhum contrato vencendo nos próximos 30 dias</p>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  )
}
