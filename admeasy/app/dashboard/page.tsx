'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { supabase } from '@/lib/supabase'
import {
  Building2, FileText, Users, TrendingUp, AlertTriangle, CheckCircle2,
  Clock, Wallet, ArrowUpRight, ArrowDownRight, CalendarClock
} from 'lucide-react'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

function formatVal(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}
function formatDate(d: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(d + 'T00:00:00'))
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

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)

  // Métricas básicas
  const [totalImoveis, setTotalImoveis] = useState(0)
  const [imoveisAlugados, setImoveisAlugados] = useState(0)
  const [imoveisDisponiveis, setImoveisDisponiveis] = useState(0)
  const [totalClientes, setTotalClientes] = useState(0)
  const [contratosAtivos, setContratosAtivos] = useState(0)

  // Cobranças
  const [cobrancasPagas, setCobrancasPagas] = useState<any[]>([])
  const [cobrancasPendentes, setCobrancasPendentes] = useState<any[]>([])
  const [cobrancasAtrasadas, setCobrancasAtrasadas] = useState<any[]>([])
  const [cobrancasProximas, setCobrancasProximas] = useState<any[]>([])

  // Financeiro
  const [taxaAdmTotal, setTaxaAdmTotal] = useState(0)
  const [fluxoCaixa, setFluxoCaixa] = useState({ entradas: 0, saidas: 0, saldo: 0 })
  const [ticketMedio, setTicketMedio] = useState(0)

  // Contratos
  const [contratosVencidos, setContratosVencidos] = useState<any[]>([])
  const [contratosAVencer, setContratosAVencer] = useState<any[]>([])

  useEffect(() => { carregarTudo() }, [])

  async function carregarTudo() {
    setLoading(true)
    const hoje = new Date()
    const hojeStr = hoje.toISOString().split('T')[0]
    const em5Dias = new Date(hoje); em5Dias.setDate(em5Dias.getDate() + 5)
    const em30Dias = new Date(hoje); em30Dias.setDate(em30Dias.getDate() + 30)
    const mesAtual = hoje.toISOString().slice(0, 7) // YYYY-MM

    // Imóveis
    const { data: imoveis } = await supabase.from('imoveis').select('id, status').eq('organization_id', ORG_ID)
    if (imoveis) {
      setTotalImoveis(imoveis.length)
      setImoveisAlugados(imoveis.filter(i => i.status === 'alugado').length)
      setImoveisDisponiveis(imoveis.filter(i => i.status === 'disponivel').length)
    }

    // Clientes
    const { count: clientesCount } = await supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('organization_id', ORG_ID)
    setTotalClientes(clientesCount || 0)

    // Contratos
    const { data: contratos } = await supabase
      .from('contratos')
      .select('id, numero, data_fim, status, valor_atual, valor_mensal, imovel:imoveis(titulo), locatario:clientes!contratos_locatario_id_fkey(nome)')
      .eq('organization_id', ORG_ID)

    if (contratos) {
      const ativos = contratos.filter(c => c.status === 'ativo')
      setContratosAtivos(ativos.length)

      // Ticket médio
      const somaValores = ativos.reduce((acc, c) => acc + (c.valor_atual || c.valor_mensal || 0), 0)
      setTicketMedio(ativos.length > 0 ? somaValores / ativos.length : 0)

      // Contratos vencidos
      const vencidos = contratos.filter(c => c.status === 'ativo' && diasEntre(c.data_fim) < 0)
      setContratosVencidos(vencidos)

      // Contratos a vencer em até 30 dias (1 mês de aviso)
      const aVencer = contratos.filter(c => {
        const dias = diasEntre(c.data_fim)
        return c.status === 'ativo' && dias >= 0 && dias <= 30
      }).sort((a, b) => diasEntre(a.data_fim) - diasEntre(b.data_fim))
      setContratosAVencer(aVencer)
    }

    // Cobranças do mês atual
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

      // Taxa de administração total do mês
      const somaTaxas = cobrancas.reduce((acc, c) => acc + (c.valor_taxa_adm || 0), 0)
      setTaxaAdmTotal(somaTaxas)
    }

    // Fluxo de caixa — lançamentos
    const { data: lancamentos } = await supabase
      .from('lancamentos')
      .select('tipo, valor, status')
      .eq('organization_id', ORG_ID)

    if (lancamentos) {
      const pagos = lancamentos.filter(l => l.status === 'pago' || l.status === 'recebido' || l.status === 'concluido')
      const entradas = pagos.filter(l => l.tipo === 'receita').reduce((acc, l) => acc + (l.valor || 0), 0)
      const saidas = pagos.filter(l => l.tipo === 'despesa').reduce((acc, l) => acc + (l.valor || 0), 0)
      setFluxoCaixa({ entradas, saidas, saldo: entradas - saidas })
    }

    setLoading(false)
  }

  if (loading) {
    return <AppLayout><Topbar titulo="Dashboard" /><div className="p-6 text-gray-400">Carregando...</div></AppLayout>
  }

  return (
    <AppLayout>
      <Topbar titulo="Dashboard" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Alertas críticos */}
        {(cobrancasAtrasadas.length > 0 || contratosVencidos.length > 0) && (
          <div className="grid grid-cols-2 gap-4">
            {cobrancasAtrasadas.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={15} className="text-red-600" />
                  <span className="text-sm font-semibold text-red-800">{cobrancasAtrasadas.length} aluguel(éis) em atraso</span>
                </div>
                {cobrancasAtrasadas.slice(0, 3).map((c, i) => (
                  <div key={i} className="text-xs text-red-600 py-0.5">
                    {getNome(c.contrato?.locatario)} — {formatVal(c.valor_aluguel)} — vencido há {Math.abs(diasEntre(c.data_vencimento))}d
                  </div>
                ))}
              </div>
            )}
            {contratosVencidos.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarClock size={15} className="text-red-600" />
                  <span className="text-sm font-semibold text-red-800">{contratosVencidos.length} contrato(s) vencido(s)</span>
                </div>
                {contratosVencidos.slice(0, 3).map((c, i) => (
                  <div key={i} className="text-xs text-red-600 py-0.5">
                    #{c.numero} — {getNome(c.imovel)} — venceu há {Math.abs(diasEntre(c.data_fim))}d
                  </div>
                ))}
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
            <div className="text-xs text-gray-400 mt-1">Receita da administradora</div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><Users size={13} />Clientes</div>
            <div className="text-2xl font-semibold">{totalClientes}</div>
            <div className="text-xs text-gray-400 mt-1">Cadastrados no sistema</div>
          </div>
        </div>

        {/* Fluxo de caixa + Ticket médio */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><Wallet size={13} />Saldo (fluxo de caixa)</div>
            <div className={`text-2xl font-semibold ${fluxoCaixa.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatVal(fluxoCaixa.saldo)}</div>
            <div className="flex gap-3 mt-2 text-xs">
              <span className="flex items-center gap-1 text-green-600"><ArrowUpRight size={11} />{formatVal(fluxoCaixa.entradas)}</span>
              <span className="flex items-center gap-1 text-red-500"><ArrowDownRight size={11} />{formatVal(fluxoCaixa.saidas)}</span>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><TrendingUp size={13} />Ticket médio</div>
            <div className="text-2xl font-semibold">{formatVal(ticketMedio)}</div>
            <div className="text-xs text-gray-400 mt-1">Valor médio dos aluguéis ativos</div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><CheckCircle2 size={13} />Pagos este mês</div>
            <div className="text-2xl font-semibold text-green-600">{cobrancasPagas.length}</div>
            <div className="text-xs text-gray-400 mt-1">de {cobrancasPagas.length + cobrancasPendentes.length + cobrancasAtrasadas.length} cobranças</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* Painel de cobranças */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Wallet size={14} className="text-blue-500" />Painel de cobranças</h3>
              <Link href="/financeiro" className="text-xs text-blue-600 hover:underline">Ver financeiro →</Link>
            </div>

            {/* Próximos a vencer (5 dias) */}
            {cobrancasProximas.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-medium text-yellow-600 uppercase tracking-wide mb-1.5">Vence em até 5 dias</p>
                {cobrancasProximas.map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 text-xs">
                    <div>
                      <span className="font-medium text-gray-700">{getNome(c.contrato?.locatario)}</span>
                      <span className="text-gray-400 ml-1.5">#{c.contrato?.numero}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">{formatVal(c.valor_aluguel)}</span>
                      <span className="text-yellow-600 ml-1.5">{diasEntre(c.data_vencimento)}d</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Atrasados */}
            {cobrancasAtrasadas.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-medium text-red-600 uppercase tracking-wide mb-1.5">Em atraso</p>
                {cobrancasAtrasadas.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 text-xs">
                    <div>
                      <span className="font-medium text-gray-700">{getNome(c.contrato?.locatario)}</span>
                      <span className="text-gray-400 ml-1.5">#{c.contrato?.numero}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium text-red-600">{formatVal(c.valor_aluguel)}</span>
                      <span className="text-red-500 ml-1.5">{Math.abs(diasEntre(c.data_vencimento))}d atraso</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagos */}
            {cobrancasPagas.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-green-600 uppercase tracking-wide mb-1.5">Pagos este mês</p>
                {cobrancasPagas.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 text-xs">
                    <div>
                      <span className="font-medium text-gray-700">{getNome(c.contrato?.locatario)}</span>
                      <span className="text-gray-400 ml-1.5">#{c.contrato?.numero}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium text-green-600">{formatVal(c.valor_aluguel)}</span>
                      {c.data_pagamento && <span className="text-gray-400 ml-1.5">{formatDate(c.data_pagamento)}</span>}
                    </div>
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
                    <div>
                      <span className="font-medium text-gray-700">#{c.numero}</span>
                      <span className="text-gray-400 ml-1.5">{getNome(c.imovel)}</span>
                    </div>
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
                    <div>
                      <span className="font-medium text-gray-700">#{c.numero}</span>
                      <span className="text-gray-400 ml-1.5">{getNome(c.imovel)} · {getNome(c.locatario)}</span>
                    </div>
                    <span className={diasEntre(c.data_fim) <= 15 ? 'text-red-500 font-medium' : 'text-orange-500'}>
                      {diasEntre(c.data_fim)}d
                    </span>
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
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-xl font-semibold text-blue-700">{imoveisAlugados}</div>
              <div className="text-xs text-blue-500 mt-0.5">Alugados</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-xl font-semibold text-green-700">{imoveisDisponiveis}</div>
              <div className="text-xs text-green-500 mt-0.5">Disponíveis</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <div className="text-xl font-semibold text-yellow-700">0</div>
              <div className="text-xs text-yellow-500 mt-0.5">Em análise</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-xl font-semibold text-gray-700">0</div>
              <div className="text-xs text-gray-500 mt-0.5">Vendidos</div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
