'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { supabase } from '@/lib/supabase'
import {
  Building2, FileText, Users, TrendingUp, AlertTriangle, CheckCircle2,
  Wallet, ArrowUpRight, ArrowDownRight, CalendarClock, Scale, Percent, BarChart3
} from 'lucide-react'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

function formatVal(val: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0) }
function formatValCompact(val: number) {
  if (Math.abs(val) >= 1000) return `R$ ${(val / 1000).toFixed(1)}k`
  return formatVal(val)
}
function formatDate(d: string) { return new Intl.DateTimeFormat('pt-BR').format(new Date(d + 'T00:00:00')) }
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
  const [ano, mes] = mesStr.split('-')
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return nomes[parseInt(mes) - 1]
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)

  const [totalImoveis, setTotalImoveis] = useState(0)
  const [imoveisAlugados, setImoveisAlugados] = useState(0)
  const [imoveisDisponiveis, setImoveisDisponiveis] = useState(0)
  const [totalClientes, setTotalClientes] = useState(0)
  const [contratosAtivos, setContratosAtivos] = useState(0)

  const [cobrancasPagas, setCobrancasPagas] = useState<any[]>([])
  const [cobrancasPendentes, setCobrancasPendentes] = useState<any[]>([])
  const [cobrancasAtrasadas, setCobrancasAtrasadas] = useState<any[]>([])
  const [cobrancasProximas, setCobrancasProximas] = useState<any[]>([])

  const [taxaAdmTotal, setTaxaAdmTotal] = useState(0)
  const [taxaAdmTicketMedio, setTaxaAdmTicketMedio] = useState(0)
  const [fluxoCaixa, setFluxoCaixa] = useState({ entradas: 0, saidas: 0, saldo: 0 })
  const [ticketMedio, setTicketMedio] = useState(0)
  const [taxaInadimplencia, setTaxaInadimplencia] = useState(0)

  const [contratosVencidos, setContratosVencidos] = useState<any[]>([])
  const [contratosAVencer, setContratosAVencer] = useState<any[]>([])

  const [processosAtivos, setProcessosAtivos] = useState(0)
  const [processosValorTotal, setProcessosValorTotal] = useState(0)

  const [evolucaoCarteira, setEvolucaoCarteira] = useState<{ mes: string; imoveis: number; receita: number }[]>([])

  useEffect(() => { carregarTudo() }, [])

  async function carregarTudo() {
    setLoading(true)
    const hoje = new Date()
    const mesAtual = hoje.toISOString().slice(0, 7)

    const { data: imoveis } = await supabase.from('imoveis').select('id, status, created_at').eq('organization_id', ORG_ID)
    if (imoveis) {
      setTotalImoveis(imoveis.length)
      setImoveisAlugados(imoveis.filter(i => i.status === 'alugado').length)
      setImoveisDisponiveis(imoveis.filter(i => i.status === 'disponivel').length)
    }

    const { count: clientesCount } = await supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('organization_id', ORG_ID)
    setTotalClientes(clientesCount || 0)

    const { data: contratos } = await supabase
      .from('contratos')
      .select('id, numero, data_fim, data_inicio, status, valor_atual, valor_mensal, taxa_administracao, imovel:imoveis(titulo), locatario:clientes!contratos_locatario_id_fkey(nome)')
      .eq('organization_id', ORG_ID)

    if (contratos) {
      const ativos = contratos.filter(c => c.status === 'ativo')
      setContratosAtivos(ativos.length)

      const somaValores = ativos.reduce((acc, c) => acc + (c.valor_atual || c.valor_mensal || 0), 0)
      setTicketMedio(ativos.length > 0 ? somaValores / ativos.length : 0)

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

      // Evolução da carteira — últimos 6 meses
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
      setCobrancasPendentes(pendentes.filter(c => diasEntre(c.data_vencimento) >= 0))
      setCobrancasAtrasadas(atrasadas)
      setCobrancasProximas(proximas)

      const somaTaxas = cobrancas.reduce((acc, c) => acc + (c.valor_taxa_adm || 0), 0)
      setTaxaAdmTotal(somaTaxas)

      // Taxa de inadimplência = atrasadas / total cobranças do mês
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

    // Processos judiciais
    const { data: processos } = await supabase.from('processos_judiciais').select('status, valor_causa').eq('organization_id', ORG_ID)
    if (processos) {
      const ativos = processos.filter(p => p.status === 'em_andamento' || p.status === 'suspenso')
      setProcessosAtivos(ativos.length)
      setProcessosValorTotal(ativos.reduce((acc, p) => acc + (p.valor_causa || 0), 0))
    }

    setLoading(false)
  }

  if (loading) return <AppLayout><Topbar titulo="Dashboard" /><div className="p-6 text-gray-400">Carregando...</div></AppLayout>

  const maxReceita = Math.max(...evolucaoCarteira.map(m => m.receita), 1)
  const maxImoveis = Math.max(...evolucaoCarteira.map(m => m.imoveis), 1)

  return (
    <AppLayout>
      <Topbar titulo="Dashboard" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Alertas críticos */}
        {(cobrancasAtrasadas.length > 0 || contratosVencidos.length > 0 || processosAtivos > 0) && (
          <div className="grid grid-cols-3 gap-4">
            {cobrancasAtrasadas.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2"><AlertTriangle size={14} className="text-red-600" /><span className="text-sm font-semibold text-red-800">{cobrancasAtrasadas.length} em atraso</span></div>
                {cobrancasAtrasadas.slice(0, 2).map((c, i) => (
                  <div key={i} className="text-xs text-red-600 py-0.5">{getNome(c.contrato?.locatario)} — {formatVal(c.valor_aluguel)}</div>
                ))}
              </div>
            )}
            {contratosVencidos.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2"><CalendarClock size={14} className="text-red-600" /><span className="text-sm font-semibold text-red-800">{contratosVencidos.length} contrato(s) vencido(s)</span></div>
                {contratosVencidos.slice(0, 2).map((c, i) => (
                  <div key={i} className="text-xs text-red-600 py-0.5">#{c.numero} — {getNome(c.imovel)}</div>
                ))}
              </div>
            )}
            {processosAtivos > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2"><Scale size={14} className="text-orange-600" /><span className="text-sm font-semibold text-orange-800">{processosAtivos} processo(s) ativo(s)</span></div>
                <div className="text-xs text-orange-600">Valor total em causa: {formatVal(processosValorTotal)}</div>
                <Link href="/processos-judiciais" className="text-[10px] text-orange-700 hover:underline">Ver processos →</Link>
              </div>
            )}
          </div>
        )}

        {/* Cards principais */}
        <div className="grid grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><Building2 size={13} />Imóveis</div>
            <div className="text-2xl font-semibold">{totalImoveis}</div>
            <div className="text-xs text-gray-400 mt-1">{imoveisAlugados} alugados · {imoveisDisponiveis} disponíveis</div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><FileText size={13} />Contratos ativos</div>
            <div className="text-2xl font-semibold">{contratosAtivos}</div>
            <div className="text-xs text-gray-400 mt-1">{contratosVencidos.length > 0 ? `${contratosVencidos.length} vencido(s)` : 'Todos em dia'}</div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><TrendingUp size={13} />Taxa adm. (mês)</div>
            <div className="text-2xl font-semibold text-green-600">{formatVal(taxaAdmTotal)}</div>
            <div className="text-xs text-gray-400 mt-1">Ticket médio: {formatVal(taxaAdmTicketMedio)}</div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><Users size={13} />Clientes</div>
            <div className="text-2xl font-semibold">{totalClientes}</div>
            <div className="text-xs text-gray-400 mt-1">Cadastrados no sistema</div>
          </div>
        </div>

        {/* Linha 2: financeiro */}
        <div className="grid grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><Wallet size={13} />Saldo (fluxo de caixa)</div>
            <div className={`text-xl font-semibold ${fluxoCaixa.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatVal(fluxoCaixa.saldo)}</div>
            <div className="flex gap-3 mt-2 text-xs">
              <span className="flex items-center gap-1 text-green-600"><ArrowUpRight size={11} />{formatValCompact(fluxoCaixa.entradas)}</span>
              <span className="flex items-center gap-1 text-red-500"><ArrowDownRight size={11} />{formatValCompact(fluxoCaixa.saidas)}</span>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><TrendingUp size={13} />Ticket médio aluguel</div>
            <div className="text-xl font-semibold">{formatVal(ticketMedio)}</div>
            <div className="text-xs text-gray-400 mt-1">Valor médio dos contratos ativos</div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><Percent size={13} />Taxa de inadimplência</div>
            <div className={`text-xl font-semibold ${taxaInadimplencia > 10 ? 'text-red-600' : taxaInadimplencia > 0 ? 'text-yellow-600' : 'text-green-600'}`}>{taxaInadimplencia.toFixed(1)}%</div>
            <div className="text-xs text-gray-400 mt-1">{cobrancasAtrasadas.length} de {cobrancasPagas.length + cobrancasPendentes.length + cobrancasAtrasadas.length} cobranças</div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><CheckCircle2 size={13} />Pagos este mês</div>
            <div className="text-xl font-semibold text-green-600">{cobrancasPagas.length}</div>
            <div className="text-xs text-gray-400 mt-1">cobranças recebidas</div>
          </div>
        </div>

        {/* Evolução da carteira */}
        <div className="card">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><BarChart3 size={14} className="text-blue-500" />Evolução da carteira (últimos 6 meses)</h3>
          <div className="grid grid-cols-6 gap-3">
            {evolucaoCarteira.map((m, i) => (
              <div key={i} className="text-center">
                <div className="h-24 flex items-end justify-center gap-1 mb-2">
                  <div className="bg-blue-200 rounded-t w-4" style={{ height: `${(m.imoveis / maxImoveis) * 90 + 5}px` }} title={`${m.imoveis} contratos`} />
                  <div className="bg-green-300 rounded-t w-4" style={{ height: `${(m.receita / maxReceita) * 90 + 5}px` }} title={formatVal(m.receita)} />
                </div>
                <div className="text-[10px] text-gray-400">{mesLabel(m.mes)}</div>
                <div className="text-[10px] font-medium text-gray-600">{m.imoveis}</div>
                <div className="text-[9px] text-green-600">{formatValCompact(m.receita)}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-200 rounded-sm inline-block" />Contratos ativos</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-300 rounded-sm inline-block" />Receita mensal</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* Painel de cobranças */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Wallet size={14} className="text-blue-500" />Painel de cobranças</h3>
              <Link href="/financeiro" className="text-xs text-blue-600 hover:underline">Ver financeiro →</Link>
            </div>

            {cobrancasProximas.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-medium text-yellow-600 uppercase tracking-wide mb-1.5">Vence em até 5 dias</p>
                {cobrancasProximas.map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 text-xs">
                    <div><span className="font-medium text-gray-700">{getNome(c.contrato?.locatario)}</span><span className="text-gray-400 ml-1.5">#{c.contrato?.numero}</span></div>
                    <div className="text-right"><span className="font-medium">{formatVal(c.valor_aluguel)}</span><span className="text-yellow-600 ml-1.5">{diasEntre(c.data_vencimento)}d</span></div>
                  </div>
                ))}
              </div>
            )}

            {cobrancasAtrasadas.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-medium text-red-600 uppercase tracking-wide mb-1.5">Em atraso</p>
                {cobrancasAtrasadas.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 text-xs">
                    <div><span className="font-medium text-gray-700">{getNome(c.contrato?.locatario)}</span><span className="text-gray-400 ml-1.5">#{c.contrato?.numero}</span></div>
                    <div className="text-right"><span className="font-medium text-red-600">{formatVal(c.valor_aluguel)}</span><span className="text-red-500 ml-1.5">{Math.abs(diasEntre(c.data_vencimento))}d atraso</span></div>
                  </div>
                ))}
              </div>
            )}

            {cobrancasPagas.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-green-600 uppercase tracking-wide mb-1.5">Pagos este mês</p>
                {cobrancasPagas.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 text-xs">
                    <div><span className="font-medium text-gray-700">{getNome(c.contrato?.locatario)}</span><span className="text-gray-400 ml-1.5">#{c.contrato?.numero}</span></div>
                    <div className="text-right"><span className="font-medium text-green-600">{formatVal(c.valor_aluguel)}</span>{c.data_pagamento && <span className="text-gray-400 ml-1.5">{formatDate(c.data_pagamento)}</span>}</div>
                  </div>
                ))}
              </div>
            )}

            {cobrancasProximas.length === 0 && cobrancasAtrasadas.length === 0 && cobrancasPagas.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">Nenhuma cobrança este mês</p>
            )}
          </div>

          {/* Contratos vencendo */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2"><CalendarClock size={14} className="text-orange-500" />Contratos — vencimentos</h3>
              <Link href="/contratos" className="text-xs text-blue-600 hover:underline">Ver todos →</Link>
            </div>

            {contratosVencidos.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-medium text-red-600 uppercase tracking-wide mb-1.5">Vencidos</p>
                {contratosVencidos.map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 text-xs">
                    <div><span className="font-medium text-gray-700">#{c.numero}</span><span className="text-gray-400 ml-1.5">{getNome(c.imovel)}</span></div>
                    <span className="text-red-500">venceu há {Math.abs(diasEntre(c.data_fim))}d</span>
                  </div>
                ))}
              </div>
            )}

            {contratosAVencer.length > 0 ? (
              <div>
                <p className="text-[10px] font-medium text-orange-600 uppercase tracking-wide mb-1.5">A vencer (próximos 30 dias)</p>
                {contratosAVencer.map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 text-xs">
                    <div><span className="font-medium text-gray-700">#{c.numero}</span><span className="text-gray-400 ml-1.5">{getNome(c.imovel)} · {getNome(c.locatario)}</span></div>
                    <span className={diasEntre(c.data_fim) <= 15 ? 'text-red-500 font-medium' : 'text-orange-500'}>{diasEntre(c.data_fim)}d</span>
                  </div>
                ))}
              </div>
            ) : contratosVencidos.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">Nenhum contrato vencendo nos próximos 30 dias</p>
            )}
          </div>
        </div>

        {/* Imóveis por status */}
        <div className="card">
          <h3 className="text-sm font-semibold mb-4">Imóveis por status</h3>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center"><div className="text-xl font-semibold text-blue-700">{imoveisAlugados}</div><div className="text-xs text-blue-500 mt-0.5">Alugados</div></div>
            <div className="bg-green-50 rounded-lg p-3 text-center"><div className="text-xl font-semibold text-green-700">{imoveisDisponiveis}</div><div className="text-xs text-green-500 mt-0.5">Disponíveis</div></div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center"><div className="text-xl font-semibold text-yellow-700">0</div><div className="text-xs text-yellow-500 mt-0.5">Em análise</div></div>
            <div className="bg-gray-50 rounded-lg p-3 text-center"><div className="text-xl font-semibold text-gray-700">0</div><div className="text-xs text-gray-500 mt-0.5">Vendidos</div></div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
