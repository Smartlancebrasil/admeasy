'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import { useOrganization } from '@/lib/OrganizationContext'
import { supabase } from '@/lib/supabase'
import {
  Building2, TrendingUp, AlertTriangle, Wallet,
  CalendarClock, Scale, Percent, Bell, Info, X
} from 'lucide-react'
import Chart from 'chart.js/auto'

// orgId fixo removido — agora vem do useOrganization() (multi-tenant)

function formatVal(val: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0) }
function formatDataBR(dataStr: string) {
  if (!dataStr) return '—'
  const [ano, mes, dia] = dataStr.split('-')
  return `${dia}/${mes}/${ano}`
}
function adicionarDias(dataStr: string, dias: number) {
  const d = new Date(dataStr + 'T00:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}
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

const mesesNomeCompleto = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

type LinhaPopup = {
  imovel: string
  locatario: string
  valor: number
  dataLabel: string
  data: string
  extraLabel?: string
  extra?: string
  corExtra?: string
}

type PopupKey = 'previstos' | 'recebidos' | 'atraso' | 'repasses' | 'honorarios'

function ModalListaFinanceira({ titulo, subtitulo, linhas, vazio, onFechar }: {
  titulo: string; subtitulo?: string; linhas: LinhaPopup[]; vazio: string; onFechar: () => void
}) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50 }}
      className="flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onFechar}
    >
      <div
        style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }}
        className="rounded-xl p-5 w-full max-w-2xl my-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold">{titulo}</h3>
            {subtitulo && <p style={{ color: '#8b8d98' }} className="text-[11px] mt-0.5">{subtitulo}</p>}
          </div>
          <button onClick={onFechar} style={{ color: '#8b8d98' }} className="hover:text-white transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {linhas.length === 0 ? (
          <p style={{ color: '#8b8d98' }} className="text-[12px] text-center py-8">{vazio}</p>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-[60vh] overflow-y-auto">
            {linhas.map((l, i) => (
              <div key={i} style={{ background: '#0d1117', border: '0.5px solid #1c2128' }} className="flex items-center justify-between px-3 py-2.5 rounded-lg gap-3">
                <div className="min-w-0">
                  <div style={{ color: '#f4f4f3' }} className="text-[12px] font-medium truncate">{l.imovel}</div>
                  <div style={{ color: '#8b8d98' }} className="text-[11px] truncate">{l.locatario}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div style={{ color: '#f4f4f3' }} className="text-[12px] font-medium">{formatVal(l.valor)}</div>
                  <div style={{ color: '#8b8d98' }} className="text-[10px]">{l.dataLabel}: {formatDataBR(l.data)}</div>
                </div>
                {l.extraLabel && (
                  <div className="text-right flex-shrink-0 min-w-[90px]">
                    <div style={{ color: '#8b8d98' }} className="text-[9px]">{l.extraLabel}</div>
                    <div style={{ color: l.corExtra || '#c3c2b7' }} className="text-[11px] font-medium">{l.extra}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { organizacao } = useOrganization()
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
  const [totalPago, setTotalPago] = useState(0)
  const [totalAVencer, setTotalAVencer] = useState(0)
  const [totalAtrasado, setTotalAtrasado] = useState(0)

  const [taxaAdmTotal, setTaxaAdmTotal] = useState(0)
  const [taxaAdmTicketMedio, setTaxaAdmTicketMedio] = useState(0)
  const [fluxoCaixa, setFluxoCaixa] = useState({ entradas: 0, saidas: 0, saldo: 0 })
  const [taxaInadimplencia, setTaxaInadimplencia] = useState(0)
  const [totalAdministrado, setTotalAdministrado] = useState(0)
  const [faturamentoAdmMes, setFaturamentoAdmMes] = useState(0)
  const [repassesMes, setRepassesMes] = useState(0)
  const [honorariosMes, setHonorariosMes] = useState(0)
  const [honorariosPrevisto, setHonorariosPrevisto] = useState(0)
  const [honorariosProximaData, setHonorariosProximaData] = useState('')
  const [honorariosDetalhe, setHonorariosDetalhe] = useState<{
    contratoId: string; imovel: string; locatario: string; dataInicio: string
    valor: number; recebido: boolean; dataRecebimento: string; dataPrevista: string
  }[]>([])

  const [contratosVencidos, setContratosVencidos] = useState<any[]>([])
  const [contratosAVencer, setContratosAVencer] = useState<any[]>([])

  const [processosAtivos, setProcessosAtivos] = useState(0)
  const [processosValorTotal, setProcessosValorTotal] = useState(0)

  const [evolucaoCarteira, setEvolucaoCarteira] = useState<{ mes: string; imoveis: number; receita: number }[]>([])
  const [faturamentoTotal, setFaturamentoTotal] = useState(0)
  const [ticketMedioLocacoes, setTicketMedioLocacoes] = useState(0)
  const [ticketMedioAdm, setTicketMedioAdm] = useState(0)
  const [rankingBairros, setRankingBairros] = useState<{ bairro: string; qtd: number }[]>([])

  // --- Novos states do redesign BI (Fase 1: filtros + cards principais) ---
  const [rawContratos, setRawContratos] = useState<any[]>([])
  const [rawImoveis, setRawImoveis] = useState<any[]>([])
  const [rawCobrancas, setRawCobrancas] = useState<any[]>([])
  const [rawDemandasStatus, setRawDemandasStatus] = useState<{ status: string; arquivada_em: string | null }[]>([])
  const [locadoresMap, setLocadoresMap] = useState<Record<string, string>>({})

  const mesAtualStr = new Date().toISOString().slice(0, 7)
  const [filtroMes, setFiltroMes] = useState(mesAtualStr)
  const [filtroLocador, setFiltroLocador] = useState('')
  const [filtroBairro, setFiltroBairro] = useState('')
  const [filtroStatusImovel, setFiltroStatusImovel] = useState('')
  const [popupAberto, setPopupAberto] = useState<PopupKey | null>(null)
  const [anoSelFiltro, mesSelNumFiltro] = filtroMes.split('-')
  const anoAtualFiltro = new Date().getFullYear()
  const anosDisponiveisFiltro = Array.from({ length: 5 }, (_, i) => String(anoAtualFiltro - 2 + i))

  const evoChartRef = useRef<HTMLCanvasElement>(null)
  const statusChartRef = useRef<HTMLCanvasElement>(null)
  const demandasChartRef = useRef<HTMLCanvasElement>(null)
  const chartInstances = useRef<Chart[]>([])

  // --- Opções de filtro (derivadas dos dados brutos) ---
  const bairrosDisponiveis = useMemo(() => {
    const set = new Set<string>()
    rawImoveis.forEach(im => { if (im.bairro) set.add(im.bairro) })
    return Array.from(set).sort()
  }, [rawImoveis])

  const locadoresDisponiveis = useMemo(() => {
    return Object.entries(locadoresMap).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [locadoresMap])

  // --- Dados filtrados ---
  const imoveisFiltrados = useMemo(() => rawImoveis.filter(im =>
    (!filtroBairro || im.bairro === filtroBairro) &&
    (!filtroStatusImovel || im.status === filtroStatusImovel) &&
    (!filtroLocador || im.proprietario_id === filtroLocador)
  ), [rawImoveis, filtroBairro, filtroStatusImovel, filtroLocador])

  const imovelIdsFiltrados = useMemo(() => new Set(imoveisFiltrados.map(i => i.id)), [imoveisFiltrados])

  const contratosFiltrados = useMemo(() => rawContratos.filter(c => {
    const im = Array.isArray(c.imovel) ? c.imovel[0] : c.imovel
    if ((filtroBairro || filtroStatusImovel) && (!im?.id || !imovelIdsFiltrados.has(im.id))) return false
    if (filtroLocador && c.locador_id !== filtroLocador) return false
    return true
  }), [rawContratos, imovelIdsFiltrados, filtroBairro, filtroStatusImovel, filtroLocador])

  const contratosAtivosFiltrados = useMemo(() => contratosFiltrados.filter(c => c.status === 'ativo'), [contratosFiltrados])
  const contratoIdsFiltrados = useMemo(() => new Set(contratosFiltrados.map(c => c.id)), [contratosFiltrados])

  const cobrancasFiltradas = useMemo(() => rawCobrancas.filter(c => contratoIdsFiltrados.has(c.contrato_id)), [rawCobrancas, contratoIdsFiltrados])

  const valorCobrancaBI = (c: any) => c.valor_total > 0 ? c.valor_total : (c.valor_aluguel || 0)

  const { inicioMesSel, fimMesSel } = useMemo(() => {
    const [ano, mes] = filtroMes.split('-').map(Number)
    return {
      inicioMesSel: `${filtroMes}-01`,
      fimMesSel: new Date(ano, mes, 0).toISOString().slice(0, 10),
    }
  }, [filtroMes])

  const cobrancasDoMesSel = useMemo(() => cobrancasFiltradas.filter(c =>
    c.data_vencimento >= inicioMesSel && c.data_vencimento <= fimMesSel
  ), [cobrancasFiltradas, inicioMesSel, fimMesSel])

  // --- Métricas da Fase 1 ---
  // Total administrado: soma de todos os contratos ativos, independente do mês
  // selecionado — usado só no card "Total administrado" e no ticket médio.
  const totalAdministradoBI = useMemo(() => contratosAtivosFiltrados.reduce((acc, c) => acc + (c.valor_atual || c.valor_mensal || 0), 0), [contratosAtivosFiltrados])

  const pagasNoMesSel = useMemo(() => cobrancasDoMesSel.filter(c => c.status_cobranca === 'pago'), [cobrancasDoMesSel])
  const pendentesNoMesSel = useMemo(() => cobrancasDoMesSel.filter(c => c.status_cobranca === 'pendente'), [cobrancasDoMesSel])
  const atrasadasNoMesSel = useMemo(() => pendentesNoMesSel.filter(c => diasEntre(c.data_vencimento) < 0), [pendentesNoMesSel])

  // Aluguéis previstos a receber no mês selecionado — soma das cobranças do mês
  // (diferente de totalAdministradoBI, que não olha pra mês nenhum).
  const alugueisPrevistosMesBI = useMemo(() => cobrancasDoMesSel.reduce((acc, c) => acc + valorCobrancaBI(c), 0), [cobrancasDoMesSel])

  const valorRecebidoBI = useMemo(() => pagasNoMesSel.reduce((acc, c) => acc + valorCobrancaBI(c), 0), [pagasNoMesSel])
  const valorAtrasadoBI = useMemo(() => atrasadasNoMesSel.reduce((acc, c) => acc + valorCobrancaBI(c), 0), [atrasadasNoMesSel])
  const pctRecebidoBI = alugueisPrevistosMesBI > 0 ? (valorRecebidoBI / alugueisPrevistosMesBI) * 100 : 0
  const taxaInadimplenciaBI = cobrancasDoMesSel.length > 0 ? (atrasadasNoMesSel.length / cobrancasDoMesSel.length) * 100 : 0

  const taxaContratoBI = (contratoId: string) => {
    const c = contratosFiltrados.find(x => x.id === contratoId)
    return c?.taxa_administracao || 10
  }
  const comissaoMesBI = useMemo(() => pagasNoMesSel.reduce((acc, c) => acc + valorCobrancaBI(c) * (taxaContratoBI(c.contrato_id) / 100), 0), [pagasNoMesSel, contratosFiltrados])
  // Repasses pendentes (mês): repasses ainda não feitos referentes a cobranças do
  // mês que estão em aberto (atrasadas ou ainda não vencidas).
  const repassesPendentesMesBI = useMemo(() => pendentesNoMesSel.reduce((acc, c) => acc + (c.valor_repasse || 0), 0), [pendentesNoMesSel])
  const ticketMedioBI = contratosAtivosFiltrados.length > 0 ? totalAdministradoBI / contratosAtivosFiltrados.length : 0

  // --- Linhas dos popups dos cards clicáveis ---
  const linhasPrevistosBI = useMemo<LinhaPopup[]>(() => cobrancasDoMesSel.map(c => ({
    imovel: getNome(c.contrato?.imovel),
    locatario: getNome(c.contrato?.locatario),
    valor: valorCobrancaBI(c),
    dataLabel: 'Vencimento',
    data: c.data_vencimento,
    extraLabel: 'Status',
    extra: c.status_cobranca === 'pago' ? 'Pago' : (diasEntre(c.data_vencimento) < 0 ? 'Atrasado' : 'A vencer'),
    corExtra: c.status_cobranca === 'pago' ? '#3fb950' : (diasEntre(c.data_vencimento) < 0 ? '#ef4444' : '#f59e0b'),
  })), [cobrancasDoMesSel])

  const linhasRecebidosBI = useMemo<LinhaPopup[]>(() => pagasNoMesSel.map(c => ({
    imovel: getNome(c.contrato?.imovel),
    locatario: getNome(c.contrato?.locatario),
    valor: valorCobrancaBI(c),
    dataLabel: 'Pago em',
    data: c.data_pagamento || c.data_vencimento,
  })), [pagasNoMesSel])

  const linhasAtrasoBI = useMemo<LinhaPopup[]>(() => atrasadasNoMesSel.map(c => ({
    imovel: getNome(c.contrato?.imovel),
    locatario: getNome(c.contrato?.locatario),
    valor: valorCobrancaBI(c),
    dataLabel: 'Vencimento',
    data: c.data_vencimento,
    extraLabel: 'Dias em atraso',
    extra: `${Math.abs(diasEntre(c.data_vencimento))}d`,
    corExtra: '#ef4444',
  })), [atrasadasNoMesSel])

  const linhasRepassesBI = useMemo<LinhaPopup[]>(() => pendentesNoMesSel.map(c => {
    const atrasada = diasEntre(c.data_vencimento) < 0
    return {
      imovel: getNome(c.contrato?.imovel),
      locatario: getNome(c.contrato?.locatario),
      valor: c.valor_repasse || 0,
      dataLabel: atrasada ? 'Vencido em' : 'Vence em',
      data: c.data_vencimento,
      extraLabel: 'Situação',
      extra: atrasada ? 'Atrasado' : 'A vencer',
      corExtra: atrasada ? '#ef4444' : '#f59e0b',
    }
  }), [pendentesNoMesSel])

  const linhasHonorariosBI = useMemo<LinhaPopup[]>(() => honorariosDetalhe.map(h => ({
    imovel: h.imovel,
    locatario: h.locatario,
    valor: h.valor,
    dataLabel: 'Locado em',
    data: h.dataInicio,
    extraLabel: h.recebido ? 'Honorário recebido em' : 'Previsão de recebimento',
    extra: formatDataBR(h.recebido ? h.dataRecebimento : h.dataPrevista),
    corExtra: h.recebido ? '#3fb950' : '#f59e0b',
  })), [honorariosDetalhe])

  const alertasBI = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10)
    const daqui30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const atrasadas = cobrancasFiltradas.filter(c => c.status_cobranca === 'pendente' && c.data_vencimento < hoje)
    const valorAtrasadasTotal = atrasadas.reduce((acc, c) => acc + valorCobrancaBI(c), 0)

    const vencendo = contratosAtivosFiltrados.filter(c => c.data_fim >= hoje && c.data_fim <= daqui30)

    const reajustesPendentes = contratosAtivosFiltrados.filter(c => c.proximo_reajuste && c.proximo_reajuste <= hoje)

    let imovelVagoDias = 0
    let imoveisVagosCount = 0
    imoveisFiltrados.filter(im => im.status === 'disponivel').forEach(im => {
      const encerrados = rawContratos.filter(c => {
        const imC = Array.isArray(c.imovel) ? c.imovel[0] : c.imovel
        return imC?.id === im.id && c.status === 'encerrado' && c.data_fim
      })
      if (encerrados.length > 0) {
        const maisRecente = encerrados.reduce((a, b) => (a.data_fim > b.data_fim ? a : b))
        const dias = Math.floor((Date.now() - new Date(maisRecente.data_fim + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
        if (dias >= 30) {
          imoveisVagosCount++
          if (dias > imovelVagoDias) imovelVagoDias = dias
        }
      }
    })

    return { atrasadas, valorAtrasadasTotal, vencendo, reajustesPendentes, imoveisVagosCount, imovelVagoDias }
  }, [cobrancasFiltradas, contratosAtivosFiltrados, imoveisFiltrados, rawContratos])

  const aVencerNoMesSel = useMemo(() => pendentesNoMesSel.filter(c => !atrasadasNoMesSel.includes(c)), [pendentesNoMesSel, atrasadasNoMesSel])
  const valorAVencerBI = useMemo(() => aVencerNoMesSel.reduce((acc, c) => acc + valorCobrancaBI(c), 0), [aVencerNoMesSel])

  const cobrancasTabelaBI = useMemo(() => {
    return [...cobrancasDoMesSel]
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
      .slice(0, 6)
  }, [cobrancasDoMesSel])

  const gestaoContratosBI = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10)
    const vencidos = contratosAtivosFiltrados.filter(c => c.data_fim < hoje)
    const semGarantia = contratosAtivosFiltrados.filter(c => !c.tipo_garantia)
    const semReajuste = contratosAtivosFiltrados.filter(c => c.proximo_reajuste && c.proximo_reajuste <= hoje)
    const tabela = [...contratosFiltrados]
      .filter(c => c.status === 'ativo')
      .sort((a, b) => a.data_fim.localeCompare(b.data_fim))
      .slice(0, 6)
    return { vencidos, semGarantia, semReajuste, tabela }
  }, [contratosAtivosFiltrados, contratosFiltrados])

  const repassesBI = useMemo(() => {
    const hoje = new Date()
    const inicioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10)
    const fimMesAtual = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10)

    const pendentes = cobrancasFiltradas.filter(c => c.status_cobranca === 'pago' && c.status_repasse === 'aguardando')
    const totalARepassar = pendentes.reduce((acc, c) => acc + (c.valor_repasse || 0), 0)

    const repassadosMes = cobrancasFiltradas.filter(c =>
      c.status_repasse === 'repassado' && c.data_repasse_realizada >= inicioMesAtual && c.data_repasse_realizada <= fimMesAtual
    )
    const totalRepassadoMes = repassadosMes.reduce((acc, c) => acc + (c.valor_repasse || 0), 0)

    const tabela = [...pendentes]
      .sort((a, b) => (a.data_repasse_prevista || a.data_vencimento).localeCompare(b.data_repasse_prevista || b.data_vencimento))
      .slice(0, 6)

    return { pendentes, totalARepassar, totalRepassadoMes, tabela }
  }, [cobrancasFiltradas])

  // Fluxo previsto (30 dias): faturamento próprio da imobiliária no mês — soma da
  // comissão de administração + comissão sobre seguro fiança + comissão sobre
  // seguro incêndio + honorários de locação. As comissões de seguro são valores
  // fixos por contrato, contadas quando a cobrança do mês foi paga (mesmo
  // critério já usado pela comissão de administração).
  const contratoPorId = (contratoId: string) => contratosFiltrados.find(x => x.id === contratoId)
  const comissaoSeguroFiancaMesBI = useMemo(() => pagasNoMesSel.reduce((acc, c) => acc + (contratoPorId(c.contrato_id)?.comissao_seguro_fianca || 0), 0), [pagasNoMesSel, contratosFiltrados])
  const comissaoSeguroIncendioMesBI = useMemo(() => pagasNoMesSel.reduce((acc, c) => acc + (contratoPorId(c.contrato_id)?.comissao_seguro_incendio || 0), 0), [pagasNoMesSel, contratosFiltrados])
  const faturamentoProprioMesBI = useMemo(() => ({
    comissaoAdm: comissaoMesBI,
    seguroFianca: comissaoSeguroFiancaMesBI,
    seguroIncendio: comissaoSeguroIncendioMesBI,
    honorarios: honorariosMes,
    total: comissaoMesBI + comissaoSeguroFiancaMesBI + comissaoSeguroIncendioMesBI + honorariosMes,
  }), [comissaoMesBI, honorariosMes])

  // --- Fase 2: status dos imóveis (filtrado) + evolução financeira ---
  const statusImoveisBI = useMemo(() => {
    const alugados = imoveisFiltrados.filter(i => i.status === 'alugado').length
    const disponiveis = imoveisFiltrados.filter(i => i.status === 'disponivel').length
    const analise = imoveisFiltrados.filter(i => i.status === 'em_analise').length
    const total = imoveisFiltrados.length
    const ocupacao = total > 0 ? (alugados / total) * 100 : 0
    return { alugados, disponiveis, analise, total, ocupacao, vacancia: 100 - ocupacao }
  }, [imoveisFiltrados])

  // Contagem de demandas por status (exclui arquivadas, igual à tela de Demandas).
  // Cores fixas combinadas: aberta=azul claro, deferida=verde claro,
  // em_execucao=amarelo, concluida=verde forte, indeferida=vermelho.
  const demandasStatusBI = useMemo(() => {
    const naoArquivadas = rawDemandasStatus.filter(d => !d.arquivada_em)
    const contar = (s: string) => naoArquivadas.filter(d => d.status === s).length
    return {
      aberta: contar('aberta'),
      deferida: contar('deferida'),
      em_execucao: contar('em_execucao'),
      concluida: contar('concluida'),
      indeferida: contar('indeferida'),
      total: naoArquivadas.length,
    }
  }, [rawDemandasStatus])

  const evolucaoCarteiraBI = useMemo(() => {
    const hoje = new Date()
    const meses: { mes: string; receitaPrevista: number; recebido: number; inadimplencia: number; comissao: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const mesStr = d.toISOString().slice(0, 7)
      const inicioM = `${mesStr}-01`
      const fimM = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)

      const contratosNoMes = contratosFiltrados.filter(c => {
        const inicio = new Date(c.data_inicio)
        return inicio <= new Date(d.getFullYear(), d.getMonth() + 1, 0) && (c.status === 'ativo' || c.status === 'encerrado')
      })
      const receitaPrevistaMes = contratosNoMes.reduce((acc, c) => acc + (c.valor_atual || c.valor_mensal || 0), 0)

      const cobrancasNoMes = cobrancasFiltradas.filter(c => c.data_vencimento >= inicioM && c.data_vencimento <= fimM)
      const pagasNoMes = cobrancasNoMes.filter(c => c.status_cobranca === 'pago')
      const pendentesNoMes = cobrancasNoMes.filter(c => c.status_cobranca === 'pendente')
      const recebidoMes = pagasNoMes.reduce((acc, c) => acc + valorCobrancaBI(c), 0)
      const inadimplenciaMes = cobrancasNoMes.length > 0 ? (pendentesNoMes.length / cobrancasNoMes.length) * 100 : 0
      const comissaoMes = pagasNoMes.reduce((acc, c) => acc + valorCobrancaBI(c) * (taxaContratoBI(c.contrato_id) / 100), 0)

      meses.push({ mes: mesStr, receitaPrevista: receitaPrevistaMes, recebido: recebidoMes, inadimplencia: inadimplenciaMes, comissao: comissaoMes })
    }
    return meses
  }, [contratosFiltrados, cobrancasFiltradas])

  useEffect(() => {
    if (organizacao?.id) carregarTudo(organizacao.id)
  }, [organizacao?.id])

  useEffect(() => {
    if (loading) return
    chartInstances.current.forEach(c => c.destroy())
    chartInstances.current = []

    if (evoChartRef.current) {
      const c = new Chart(evoChartRef.current, {
        type: 'line',
        data: {
          labels: evolucaoCarteiraBI.map(m => mesLabel(m.mes)),
          datasets: [
            { label: 'Receita prevista', data: evolucaoCarteiraBI.map(m => m.receitaPrevista), borderColor: '#2a78d6', backgroundColor: 'rgba(42,120,214,0.08)', fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 },
            { label: 'Valor recebido', data: evolucaoCarteiraBI.map(m => m.recebido), borderColor: '#3fb950', backgroundColor: 'rgba(63,185,80,0.08)', fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 },
            { label: 'Comissão', data: evolucaoCarteiraBI.map(m => m.comissao), borderColor: '#1A7FFF', backgroundColor: 'transparent', fill: false, tension: 0.35, pointRadius: 0, borderWidth: 2, borderDash: [4, 3] },
            { label: 'Inadimplência (%)', data: evolucaoCarteiraBI.map(m => m.inadimplencia), borderColor: '#ef4444', backgroundColor: 'transparent', fill: false, tension: 0.35, pointRadius: 0, borderWidth: 2, yAxisID: 'y1' },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          plugins: { legend: { display: true, position: 'bottom', labels: { color: '#8b8d98', boxWidth: 10, font: { size: 10 } } }, tooltip: { backgroundColor: '#1f2430', titleColor: '#fff', bodyColor: '#c3c2b7' } },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#8b8d98', font: { size: 10 } } },
            y: { display: false },
            y1: { display: false, position: 'right', min: 0 },
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
          datasets: [{ data: [statusImoveisBI.alugados, statusImoveisBI.disponiveis, statusImoveisBI.analise], backgroundColor: ['#2a78d6', '#1baf7a', '#eda100'], borderColor: '#161b22', borderWidth: 3 }],
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false } } },
      })
      chartInstances.current.push(c)
    }

    if (demandasChartRef.current) {
      const c = new Chart(demandasChartRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Aguardando decisão', 'Deferida', 'Em execução', 'Concluída', 'Indeferida'],
          datasets: [{
            data: [demandasStatusBI.aberta, demandasStatusBI.deferida, demandasStatusBI.em_execucao, demandasStatusBI.concluida, demandasStatusBI.indeferida],
            backgroundColor: ['#7dd3fc', '#86efac', '#facc15', '#16a34a', '#ef4444'],
            borderColor: '#161b22', borderWidth: 3,
          }],
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false } } },
      })
      chartInstances.current.push(c)
    }

    return () => { chartInstances.current.forEach(c => c.destroy()) }
  }, [loading, evolucaoCarteiraBI, statusImoveisBI, demandasStatusBI])

  async function carregarTudo(orgId: string) {
    setLoading(true)
    const hoje = new Date()
    const mesAtual = hoje.toISOString().slice(0, 7)

    const { data: imoveis } = await supabase.from('imoveis').select('id, status, bairro, proprietario_id').eq('organization_id', orgId)
    if (imoveis) {
      setTotalImoveis(imoveis.length)
      setImoveisAlugados(imoveis.filter(i => i.status === 'alugado').length)
      setImoveisDisponiveis(imoveis.filter(i => i.status === 'disponivel').length)
      setImoveisAnalise(imoveis.filter(i => i.status === 'em_analise').length)
      setRawImoveis(imoveis)
    }

    const { data: contratos } = await supabase
      .from('contratos')
      .select('id, numero, data_fim, data_inicio, status, valor_atual, valor_mensal, taxa_administracao, honorarios_aplicavel, valor_honorarios, comissao_seguro_incendio, comissao_seguro_fianca, locador_id, proximo_reajuste, tipo_garantia, imovel:imoveis(id, titulo, bairro, status), locatario:clientes!contratos_locatario_id_fkey(nome)')
      .eq('organization_id', orgId)

    if (contratos) {
      setRawContratos(contratos)

      const locadorIds = Array.from(new Set(contratos.map(c => c.locador_id).filter(Boolean)))
      if (locadorIds.length > 0) {
        const { data: locadores } = await supabase.from('clientes').select('id, nome').in('id', locadorIds)
        const map: Record<string, string> = {}
        locadores?.forEach(l => { map[l.id] = l.nome })
        setLocadoresMap(map)
      }

      const ativos = contratos.filter(c => c.status === 'ativo')
      setContratosAtivos(ativos.length)

      // Honorários de locação: só conta como "recebido" quando a 1ª cobrança do contrato
      // (a mais antiga) já foi paga — antes disso, fica como "previsto"
      const inicioMesHon = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
      const fimMesHon = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0]
      const contratosComHonorario = contratos.filter(c => c.honorarios_aplicavel)
      const idsHonorario = contratosComHonorario.map(c => c.id)
      let somaHonorariosMes = 0
      let somaHonorariosPrevisto = 0
      let proximaDataHonorario = ''
      const detalheHonorarios: typeof honorariosDetalhe = []
      if (idsHonorario.length > 0) {
        const { data: cobrancasHonorario } = await supabase
          .from('cobrancas')
          .select('contrato_id, data_vencimento, status_cobranca, data_pagamento')
          .in('contrato_id', idsHonorario)
          .order('data_vencimento', { ascending: true })

        const primeiraPorContrato: Record<string, any> = {}
        cobrancasHonorario?.forEach(c => {
          if (!primeiraPorContrato[c.contrato_id]) primeiraPorContrato[c.contrato_id] = c
        })

        contratosComHonorario.forEach(c => {
          const primeira = primeiraPorContrato[c.id]
          const valor = c.valor_honorarios || 0
          const im = Array.isArray(c.imovel) ? c.imovel[0] : c.imovel
          const recebido = primeira?.status_cobranca === 'pago'
          const dataPrevista = primeira?.data_vencimento || (c.data_inicio ? adicionarDias(c.data_inicio, 30) : '')
          if (recebido) {
            const dataRef = primeira.data_pagamento || primeira.data_vencimento
            if (dataRef >= inicioMesHon && dataRef <= fimMesHon) somaHonorariosMes += valor
            detalheHonorarios.push({
              contratoId: c.id, imovel: getNome(im), locatario: getNome(c.locatario),
              dataInicio: c.data_inicio, valor, recebido: true,
              dataRecebimento: dataRef, dataPrevista: '',
            })
          } else {
            somaHonorariosPrevisto += valor
            if (dataPrevista && (!proximaDataHonorario || dataPrevista < proximaDataHonorario)) {
              proximaDataHonorario = dataPrevista
            }
            detalheHonorarios.push({
              contratoId: c.id, imovel: getNome(im), locatario: getNome(c.locatario),
              dataInicio: c.data_inicio, valor, recebido: false,
              dataRecebimento: '', dataPrevista,
            })
          }
        })
      }
      setHonorariosMes(somaHonorariosMes)
      setHonorariosPrevisto(somaHonorariosPrevisto)
      setHonorariosProximaData(proximaDataHonorario)
      setHonorariosDetalhe(detalheHonorarios)

      const somaTaxas = ativos.reduce((acc, c) => {
        const valor = c.valor_atual || c.valor_mensal || 0
        const taxaPct = c.taxa_administracao || 10
        return acc + (valor * taxaPct / 100)
      }, 0)
      setTaxaAdmTicketMedio(ativos.length > 0 ? somaTaxas / ativos.length : 0)

      // Faturamento total (soma de toda a taxa de administracao dos contratos ativos)
      setFaturamentoTotal(somaTaxas)

      // Ticket medio de administracao = faturamento / qtd contratos
      setTicketMedioAdm(ativos.length > 0 ? somaTaxas / ativos.length : 0)

      // Ticket medio das locacoes = soma dos alugueis / qtd contratos
      const somaAlugueis = ativos.reduce((acc, c) => acc + (c.valor_atual || c.valor_mensal || 0), 0)
      setTicketMedioLocacoes(ativos.length > 0 ? somaAlugueis / ativos.length : 0)

      // Total administrado = soma do valor de aluguel de todos os contratos ativos
      setTotalAdministrado(somaAlugueis)

      // Ranking de bairros (contratos ativos)
      const bairrosMap: Record<string, number> = {}
      ativos.forEach(c => {
        const im = Array.isArray(c.imovel) ? c.imovel[0] : c.imovel
        const bairro = im?.bairro || 'Não informado'
        bairrosMap[bairro] = (bairrosMap[bairro] || 0) + 1
      })
      const ranking = Object.entries(bairrosMap)
        .map(([bairro, qtd]) => ({ bairro, qtd }))
        .sort((a, b) => b.qtd - a.qtd)
        .slice(0, 6)
      setRankingBairros(ranking)

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

    // Busca todas as cobrancas pendentes (de qualquer mes, incluindo atrasadas antigas)
    // e pagas/proximas relevantes
    const { data: cobrancas } = await supabase
      .from('cobrancas')
      .select('*, contrato:contratos(numero, taxa_administracao, imovel:imoveis(titulo), locatario:clientes!contratos_locatario_id_fkey(nome))')
      .eq('organization_id', orgId)

    if (cobrancas) {
      setRawCobrancas(cobrancas)
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

      const valorCobranca = (c: any) => c.valor_total > 0 ? c.valor_total : (c.valor_aluguel || 0)

      setTotalPago(pagas.reduce((acc, c) => acc + valorCobranca(c), 0))
      setTotalAVencer(pendentes.filter(c => diasEntre(c.data_vencimento) >= 0).reduce((acc, c) => acc + valorCobranca(c), 0))
      setTotalAtrasado(atrasadas.reduce((acc, c) => acc + valorCobranca(c), 0))

      const totalCobrancas = cobrancas.length
      setTaxaInadimplencia(totalCobrancas > 0 ? (atrasadas.length / totalCobrancas) * 100 : 0)

      // Faturamento da administração e repasses do mês atual, calculados sobre as
      // cobranças cujo vencimento cai dentro do mês corrente
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0]
      const cobrancasDoMes = cobrancas.filter(c => c.data_vencimento >= inicioMes && c.data_vencimento <= fimMes)

      let somaFaturamentoMes = 0
      let somaRepasseMes = 0
      cobrancasDoMes.forEach(c => {
        const valor = valorCobranca(c)
        const taxaPct = c.contrato?.taxa_administracao || 10
        const taxa = valor * taxaPct / 100
        somaFaturamentoMes += taxa
        somaRepasseMes += (valor - taxa)
      })
      setFaturamentoAdmMes(somaFaturamentoMes)
      setRepassesMes(somaRepasseMes)
      setTaxaAdmTotal(somaFaturamentoMes)
    }

    const { data: lancamentos } = await supabase.from('lancamentos').select('tipo, valor, status').eq('organization_id', orgId)
    if (lancamentos) {
      const pagos = lancamentos.filter(l => l.status === 'pago' || l.status === 'recebido' || l.status === 'concluido')
      const entradas = pagos.filter(l => l.tipo === 'receita').reduce((acc, l) => acc + (l.valor || 0), 0)
      const saidas = pagos.filter(l => l.tipo === 'despesa').reduce((acc, l) => acc + (l.valor || 0), 0)
      setFluxoCaixa({ entradas, saidas, saldo: entradas - saidas })
    }

    const { data: processos } = await supabase.from('processos_judiciais').select('status, valor_causa').eq('organization_id', orgId)
    if (processos) {
      const ativos = processos.filter(p => p.status === 'em_andamento' || p.status === 'suspenso')
      setProcessosAtivos(ativos.length)
      setProcessosValorTotal(ativos.reduce((acc, p) => acc + (p.valor_causa || 0), 0))
    }

    const { data: demandasStatus } = await supabase.from('demandas').select('status, arquivada_em').eq('organization_id', orgId)
    if (demandasStatus) setRawDemandasStatus(demandasStatus)

    setLoading(false)
  }

  function gerarRelatorio() {
    window.print()
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
      <div style={{ background: '#0d1117', minHeight: '100vh' }} className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="max-w-[1800px] mx-auto">

          {/* Cabeçalho executivo */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 mb-5">
            <div>
              <h1 style={{ color: '#f4f4f3' }} className="text-lg font-medium">Dashboard Executivo de Aluguéis</h1>
              <p style={{ color: '#8b8d98' }} className="text-[12px] mt-0.5">Visão gerencial da carteira, contratos, cobranças e repasses</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={mesSelNumFiltro}
                onChange={e => setFiltroMes(`${anoSelFiltro}-${e.target.value}`)}
                style={{ background: '#161b22', border: '0.5px solid #2a2f3a', color: '#c3c2b7' }}
                className="rounded-lg px-2.5 py-1.5 text-[11px]"
              >
                {mesesNomeCompleto.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
              </select>
              <select
                value={anoSelFiltro}
                onChange={e => setFiltroMes(`${e.target.value}-${mesSelNumFiltro}`)}
                style={{ background: '#161b22', border: '0.5px solid #2a2f3a', color: '#c3c2b7' }}
                className="rounded-lg px-2.5 py-1.5 text-[11px]"
              >
                {anosDisponiveisFiltro.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select
                value={filtroLocador}
                onChange={e => setFiltroLocador(e.target.value)}
                style={{ background: '#161b22', border: '0.5px solid #2a2f3a', color: '#c3c2b7' }}
                className="rounded-lg px-2.5 py-1.5 text-[11px]"
              >
                <option value="">Todos os proprietários</option>
                {locadoresDisponiveis.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
              <select
                value={filtroBairro}
                onChange={e => setFiltroBairro(e.target.value)}
                style={{ background: '#161b22', border: '0.5px solid #2a2f3a', color: '#c3c2b7' }}
                className="rounded-lg px-2.5 py-1.5 text-[11px]"
              >
                <option value="">Todos os bairros</option>
                {bairrosDisponiveis.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select
                value={filtroStatusImovel}
                onChange={e => setFiltroStatusImovel(e.target.value)}
                style={{ background: '#161b22', border: '0.5px solid #2a2f3a', color: '#c3c2b7' }}
                className="rounded-lg px-2.5 py-1.5 text-[11px]"
              >
                <option value="">Todos os status de imóvel</option>
                <option value="alugado">Alugado</option>
                <option value="disponivel">Disponível</option>
                <option value="em_analise">Em análise</option>
              </select>
              <button
                onClick={gerarRelatorio}
                style={{ background: '#1A7FFF', color: '#fff' }}
                className="rounded-lg px-3 py-1.5 text-[11px] font-medium hover:opacity-90"
              >
                Gerar relatório gerencial
              </button>
            </div>
          </div>

          {/* Cards principais (4) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <div
              onClick={() => setPopupAberto('previstos')}
              style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }}
              className="rounded-xl p-3.5 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div style={{ color: '#8b8d98' }} className="flex items-center gap-1.5 text-[11px] mb-1.5"><TrendingUp size={12} />Aluguéis Previstos a Receber (mês)</div>
              <div style={{ color: '#f4f4f3' }} className="text-xl font-medium">{formatVal(alugueisPrevistosMesBI)}</div>
              <div style={{ color: '#8b8d98' }} className="text-[10px] mt-1.5 mb-1.5">Cobranças com vencimento no mês selecionado</div>
              <div style={{ background: '#0d1117', height: 4, borderRadius: 3 }}>
                <div style={{ background: '#1A7FFF', width: `${Math.min(pctRecebidoBI, 100)}%`, height: 4, borderRadius: 3 }} />
              </div>
            </div>
            <div
              onClick={() => setPopupAberto('recebidos')}
              style={{ background: '#1a2e1f', border: '0.5px solid #2d4a35' }}
              className="rounded-xl p-3.5 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div style={{ color: '#8b8d98' }} className="flex items-center gap-1.5 text-[11px] mb-1.5"><Wallet size={12} />Valor recebido</div>
              <div style={{ color: '#3fb950' }} className="text-xl font-medium">{formatVal(valorRecebidoBI)}</div>
              <div style={{ color: '#8b8d98' }} className="text-[10px] mt-1.5">{pctRecebidoBI.toFixed(1)}% dos aluguéis previstos</div>
            </div>
            <div
              onClick={() => setPopupAberto('atraso')}
              style={{ background: '#2e1717', border: '0.5px solid #4a2424' }}
              className="rounded-xl p-3.5 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div style={{ color: '#8b8d98' }} className="flex items-center gap-1.5 text-[11px] mb-1.5"><CalendarClock size={12} />Valor em aberto</div>
              <div style={{ color: '#ef4444' }} className="text-xl font-medium">{formatVal(valorAtrasadoBI)}</div>
              <div style={{ color: '#8b8d98' }} className="text-[10px] mt-1.5">{atrasadasNoMesSel.length} cobrança(s) vencida(s) e não paga(s)</div>
            </div>
            <div style={{ background: taxaInadimplenciaBI > 5 ? '#2e1717' : '#161b22', border: taxaInadimplenciaBI > 5 ? '0.5px solid #4a2424' : '0.5px solid #2a2f3a' }} className="rounded-xl p-3.5">
              <div style={{ color: '#8b8d98' }} className="flex items-center gap-1.5 text-[11px] mb-1.5"><Percent size={12} />Inadimplência</div>
              <div style={{ color: taxaInadimplenciaBI > 5 ? '#ef4444' : taxaInadimplenciaBI > 0 ? '#f59e0b' : '#3fb950' }} className="text-xl font-medium">{taxaInadimplenciaBI.toFixed(1)}%</div>
              <div style={{ color: '#8b8d98' }} className="text-[10px] mt-1.5">{formatVal(valorAtrasadoBI)} em atraso</div>
            </div>
          </div>

          {/* Indicadores financeiros da imobiliária (6) */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
            <div
              onClick={() => setPopupAberto('repasses')}
              style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }}
              className="rounded-xl p-3.5 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div style={{ color: '#8b8d98' }} className="flex items-center gap-1.5 text-[11px] mb-1.5"><Wallet size={12} />Repasses pendentes (mês)</div>
              <div style={{ color: '#f4f4f3' }} className="text-xl font-medium">{formatVal(repassesPendentesMesBI)}</div>
              <div style={{ color: '#8b8d98' }} className="text-[10px] mt-1.5">{pendentesNoMesSel.length} cobrança(s) aguardando pagamento</div>
            </div>
            <div
              onClick={() => setPopupAberto('honorarios')}
              style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }}
              className="rounded-xl p-3.5 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div style={{ color: '#8b8d98' }} className="flex items-center gap-1.5 text-[11px] mb-1.5"><Wallet size={12} />Honorários de locação (mês)</div>
              {honorariosMes > 0 ? (
                <>
                  <div style={{ color: '#f4f4f3' }} className="text-xl font-medium">{formatVal(honorariosMes)}</div>
                  <div style={{ color: '#8b8d98' }} className="text-[10px] mt-1.5">Recebido este mês</div>
                </>
              ) : honorariosPrevisto > 0 ? (
                <>
                 <div style={{ color: '#f59e0b' }} className="text-xl font-medium">{formatVal(honorariosPrevisto)}</div>
                  <div style={{ color: '#8b8d98' }} className="text-[10px] mt-1.5">Previsto{honorariosProximaData ? ` para ${formatDataBR(honorariosProximaData)}` : ''}, aguardando 1º pagamento</div>

                </>
              ) : (
                <>
                  <div style={{ color: '#5a5f6a' }} className="text-xl font-medium">—</div>
                  <div style={{ color: '#8b8d98' }} className="text-[10px] mt-1.5">Nenhum contrato com honorários pendente</div>
                </>
              )}
            </div>
            <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-xl p-3.5">
              <div style={{ color: '#8b8d98' }} className="flex items-center gap-1.5 text-[11px] mb-1.5"><Building2 size={12} />Ticket médio dos aluguéis</div>
              <div style={{ color: '#f4f4f3' }} className="text-xl font-medium">{formatVal(ticketMedioBI)}</div>
              <div style={{ color: '#8b8d98' }} className="text-[10px] mt-1.5">{contratosAtivosFiltrados.length} contrato(s) ativo(s)</div>
            </div>
            <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-xl p-3.5">
              <div style={{ color: '#8b8d98' }} className="flex items-center gap-1.5 text-[11px] mb-1.5"><Building2 size={12} />Total administrado</div>
              <div style={{ color: '#f4f4f3' }} className="text-xl font-medium">{formatVal(totalAdministradoBI)}</div>
              <div style={{ color: '#8b8d98' }} className="text-[10px] mt-1.5">{contratosAtivosFiltrados.length} contratos ativos</div>
            </div>
            <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-xl p-3.5">
              <div style={{ color: '#8b8d98' }} className="flex items-center gap-1.5 text-[11px] mb-1.5"><Wallet size={12} />Saldo operacional</div>
              <div style={{ color: fluxoCaixa.saldo >= 0 ? '#3fb950' : '#ef4444' }} className="text-xl font-medium">{formatVal(fluxoCaixa.saldo)}</div>
              <div className="flex gap-2.5 mt-1.5 text-[10px]">
                <span style={{ color: '#3fb950' }}>↑ {formatValCompact(fluxoCaixa.entradas)}</span>
                <span style={{ color: '#ef4444' }}>↓ {formatValCompact(fluxoCaixa.saidas)}</span>
              </div>
            </div>
            <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-xl p-3.5">
              <div style={{ color: '#8b8d98' }} className="flex items-center gap-1.5 text-[11px] mb-1.5"><TrendingUp size={12} />Fluxo previsto (30 dias)</div>
              <div style={{ color: '#3fb950' }} className="text-xl font-medium">{formatVal(faturamentoProprioMesBI.total)}</div>
              <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1.5 text-[10px]" style={{ color: '#8b8d98' }}>
                <span>Adm {formatValCompact(faturamentoProprioMesBI.comissaoAdm)}</span>
                <span>Honorários {formatValCompact(faturamentoProprioMesBI.honorarios)}</span>
                {faturamentoProprioMesBI.seguroFianca > 0 && <span>Seguro fiança {formatValCompact(faturamentoProprioMesBI.seguroFianca)}</span>}
                {faturamentoProprioMesBI.seguroIncendio > 0 && <span>Seguro incêndio {formatValCompact(faturamentoProprioMesBI.seguroIncendio)}</span>}
              </div>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.85fr_0.85fr] gap-3 mb-3">
            <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-xl p-4">
              <div className="flex items-center justify-between mb-2.5">
                <p style={{ color: '#f4f4f3' }} className="text-xs font-medium">Evolução financeira da carteira</p>
                <span style={{ color: '#8b8d98' }} className="text-[11px]">últimos 6 meses</span>
              </div>
              <div style={{ position: 'relative', height: '160px' }}>
                <canvas ref={evoChartRef} />
              </div>
            </div>
            <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-xl p-4">
              <p style={{ color: '#f4f4f3' }} className="text-xs font-medium mb-2.5">Status dos imóveis</p>
              <div style={{ position: 'relative', height: '140px' }} className="mb-2">
                <canvas ref={statusChartRef} />
              </div>
              <div className="flex flex-col gap-1 text-[11px] mb-2" style={{ color: '#c3c2b7' }}>
                <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: 2, background: '#2a78d6' }} />Alugados {statusImoveisBI.alugados}</span>
                <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: 2, background: '#1baf7a' }} />Disponíveis {statusImoveisBI.disponiveis}</span>
                <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: 2, background: '#eda100' }} />Em análise {statusImoveisBI.analise}</span>
              </div>
              <div className="flex gap-4 pt-2" style={{ borderTop: '0.5px solid #2a2f3a' }}>
                <div>
                  <div style={{ color: '#3fb950' }} className="text-sm font-medium">{statusImoveisBI.ocupacao.toFixed(0)}%</div>
                  <div style={{ color: '#8b8d98' }} className="text-[10px]">Taxa de ocupação</div>
                </div>
                <div>
                  <div style={{ color: '#f59e0b' }} className="text-sm font-medium">{statusImoveisBI.vacancia.toFixed(0)}%</div>
                  <div style={{ color: '#8b8d98' }} className="text-[10px]">Vacância</div>
                </div>
              </div>
            </div>

            <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-xl p-4">
              <div className="flex items-center justify-between mb-2.5">
                <p style={{ color: '#f4f4f3' }} className="text-xs font-medium">Status das demandas</p>
                <Link href="/demandas" style={{ color: '#3987e5' }} className="text-[11px] hover:underline">Ver todas →</Link>
              </div>
              {demandasStatusBI.total === 0 ? (
                <p style={{ color: '#8b8d98' }} className="text-[11px] text-center py-8">Nenhuma demanda registrada</p>
              ) : (
                <>
                  <div style={{ position: 'relative', height: '140px' }} className="mb-2">
                    <canvas ref={demandasChartRef} />
                  </div>
                  <div className="flex flex-col gap-1 text-[11px]" style={{ color: '#c3c2b7' }}>
                    <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: 2, background: '#7dd3fc' }} />Aguardando decisão {demandasStatusBI.aberta}</span>
                    <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: 2, background: '#86efac' }} />Deferida {demandasStatusBI.deferida}</span>
                    <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: 2, background: '#facc15' }} />Em execução {demandasStatusBI.em_execucao}</span>
                    <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: 2, background: '#16a34a' }} />Concluída {demandasStatusBI.concluida}</span>
                    <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444' }} />Indeferida {demandasStatusBI.indeferida}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Central de alertas inteligentes */}
          {(alertasBI.atrasadas.length > 0 || alertasBI.vencendo.length > 0 || alertasBI.reajustesPendentes.length > 0 || alertasBI.imoveisVagosCount > 0) && (
            <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-xl p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <p style={{ color: '#f4f4f3' }} className="text-xs font-medium flex items-center gap-1.5"><Bell size={13} />Central de alertas inteligentes</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {alertasBI.atrasadas.length > 0 && (
                  <div style={{ background: '#2e1717', border: '0.5px solid #4a2424' }} className="rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5"><AlertTriangle size={13} style={{ color: '#ef4444' }} /><span style={{ color: '#fca5a5' }} className="text-xs font-medium">{alertasBI.atrasadas.length} cobrança(s) atrasada(s)</span></div>
                      <span style={{ background: '#ef444422', color: '#ef4444' }} className="text-[9px] font-semibold px-1.5 py-0.5 rounded">Crítico</span>
                    </div>
                    <div style={{ color: '#c3c2b7' }} className="text-[11px] mb-2">Total em atraso: {formatVal(alertasBI.valorAtrasadasTotal)}</div>
                    <Link href="/financeiro" style={{ color: '#fca5a5' }} className="text-[10px] font-medium hover:underline">Resolver agora →</Link>
                  </div>
                )}
                {alertasBI.vencendo.length > 0 && (
                  <div style={{ background: '#2e2515', border: '0.5px solid #4a3a1f' }} className="rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5"><CalendarClock size={13} style={{ color: '#f59e0b' }} /><span style={{ color: '#fcd34d' }} className="text-xs font-medium">{alertasBI.vencendo.length} contrato(s) vencendo</span></div>
                      <span style={{ background: '#f59e0b22', color: '#f59e0b' }} className="text-[9px] font-semibold px-1.5 py-0.5 rounded">Atenção</span>
                    </div>
                    <div style={{ color: '#c3c2b7' }} className="text-[11px] mb-2">Próximos 30 dias</div>
                    <Link href="/contratos" style={{ color: '#fcd34d' }} className="text-[10px] font-medium hover:underline">Ver contratos →</Link>
                  </div>
                )}
                {alertasBI.reajustesPendentes.length > 0 && (
                  <div style={{ background: '#2e2515', border: '0.5px solid #4a3a1f' }} className="rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5"><Percent size={13} style={{ color: '#f59e0b' }} /><span style={{ color: '#fcd34d' }} className="text-xs font-medium">{alertasBI.reajustesPendentes.length} reajuste(s) pendente(s)</span></div>
                      <span style={{ background: '#f59e0b22', color: '#f59e0b' }} className="text-[9px] font-semibold px-1.5 py-0.5 rounded">Atenção</span>
                    </div>
                    <div style={{ color: '#c3c2b7' }} className="text-[11px] mb-2">Índice vigente não aplicado</div>
                    <Link href="/reajuste" style={{ color: '#fcd34d' }} className="text-[10px] font-medium hover:underline">Aplicar reajustes →</Link>
                  </div>
                )}
                {alertasBI.imoveisVagosCount > 0 && (
                  <div style={{ background: '#16243a', border: '0.5px solid #1e3a5f' }} className="rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5"><Info size={13} style={{ color: '#5b9bf5' }} /><span style={{ color: '#93c5fd' }} className="text-xs font-medium">{alertasBI.imoveisVagosCount} imóvel(is) vago(s)</span></div>
                      <span style={{ background: '#5b9bf522', color: '#5b9bf5' }} className="text-[9px] font-semibold px-1.5 py-0.5 rounded">Info</span>
                    </div>
                    <div style={{ color: '#c3c2b7' }} className="text-[11px] mb-2">Há mais de {alertasBI.imovelVagoDias} dias sem locatário</div>
                    <Link href="/imoveis" style={{ color: '#93c5fd' }} className="text-[10px] font-medium hover:underline">Ver imóveis →</Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Painéis inferiores */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-xl p-4">
              <div className="flex items-center justify-between mb-2.5">
                <p style={{ color: '#f4f4f3' }} className="text-xs font-medium">Cobranças do mês</p>
                <Link href="/financeiro" style={{ color: '#3987e5' }} className="text-[11px] hover:underline">Ver todas →</Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                <div style={{ background: '#1a2e1f' }} className="rounded-lg p-2 text-center">
                  <div style={{ color: '#3fb950' }} className="text-sm font-medium">{formatValCompact(valorRecebidoBI)}</div>
                  <div style={{ color: '#8b8d98' }} className="text-[10px] mt-0.5">Pagas</div>
                </div>
                <div style={{ background: '#2e2515' }} className="rounded-lg p-2 text-center">
                  <div style={{ color: '#f59e0b' }} className="text-sm font-medium">{formatValCompact(valorAVencerBI)}</div>
                  <div style={{ color: '#8b8d98' }} className="text-[10px] mt-0.5">A vencer</div>
                </div>
                <div style={{ background: '#2e1717' }} className="rounded-lg p-2 text-center">
                  <div style={{ color: '#ef4444' }} className="text-sm font-medium">{formatValCompact(valorAtrasadoBI)}</div>
                  <div style={{ color: '#8b8d98' }} className="text-[10px] mt-0.5">Atrasadas</div>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                {cobrancasTabelaBI.length === 0 ? (
                  <p style={{ color: '#8b8d98' }} className="text-[11px] text-center py-4">Nenhuma cobrança neste mês</p>
                ) : cobrancasTabelaBI.map((c, i) => {
                  const atrasada = c.status_cobranca === 'pendente' && diasEntre(c.data_vencimento) < 0
                  const cor = c.status_cobranca === 'pago' ? '#3fb950' : atrasada ? '#ef4444' : '#f59e0b'
                  const label = c.status_cobranca === 'pago' ? 'Pago' : atrasada ? 'Atrasado' : 'A vencer'
                  return (
                    <div key={i} className="flex justify-between items-center px-2.5 py-1.5 rounded-lg" style={{ background: '#0d1117' }}>
                      <div className="min-w-0">
                        <div style={{ color: '#c3c2b7' }} className="text-[11px] truncate">{getNome(c.contrato?.locatario)}</div>
                        <div style={{ color: '#5a5f6a' }} className="text-[10px]">{formatDataBR(c.data_vencimento)}</div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <div style={{ color: '#c3c2b7' }} className="text-[11px] font-medium">{formatValCompact(valorCobrancaBI(c))}</div>
                        <div style={{ color: cor }} className="text-[10px]">{label}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-xl p-4">
              <div className="flex items-center justify-between mb-2.5">
                <p style={{ color: '#f4f4f3' }} className="text-xs font-medium">Gestão de contratos</p>
                <Link href="/contratos" style={{ color: '#3987e5' }} className="text-[11px] hover:underline">Ver todos →</Link>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div style={{ background: '#0d1117' }} className="rounded-lg p-2 text-center">
                  <div style={{ color: '#3fb950' }} className="text-sm font-medium">{contratosAtivosFiltrados.length}</div>
                  <div style={{ color: '#8b8d98' }} className="text-[10px] mt-0.5">Ativos</div>
                </div>
                <div style={{ background: '#2e2515' }} className="rounded-lg p-2 text-center">
                  <div style={{ color: '#f59e0b' }} className="text-sm font-medium">{alertasBI.vencendo.length}</div>
                  <div style={{ color: '#8b8d98' }} className="text-[10px] mt-0.5">Vencendo (30d)</div>
                </div>
                <div style={{ background: '#2e1717' }} className="rounded-lg p-2 text-center">
                  <div style={{ color: '#ef4444' }} className="text-sm font-medium">{gestaoContratosBI.vencidos.length}</div>
                  <div style={{ color: '#8b8d98' }} className="text-[10px] mt-0.5">Vencidos</div>
                </div>
                <div style={{ background: '#0d1117' }} className="rounded-lg p-2 text-center">
                  <div style={{ color: gestaoContratosBI.semGarantia.length > 0 ? '#f59e0b' : '#8b8d98' }} className="text-sm font-medium">{gestaoContratosBI.semGarantia.length}</div>
                  <div style={{ color: '#8b8d98' }} className="text-[10px] mt-0.5">Sem garantia</div>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                {gestaoContratosBI.tabela.length === 0 ? (
                  <p style={{ color: '#8b8d98' }} className="text-[11px] text-center py-4">Nenhum contrato ativo</p>
                ) : gestaoContratosBI.tabela.map((c, i) => {
                  const dias = diasEntre(c.data_fim)
                  const vencido = dias < 0
                  const vencendo = !vencido && dias <= 30
                  const cor = vencido ? '#ef4444' : vencendo ? '#f59e0b' : '#8b8d98'
                  const label = vencido ? `Vencido há ${Math.abs(dias)}d` : vencendo ? `${dias}d restantes` : formatDataBR(c.data_fim)
                  return (
                    <div key={i} className="flex justify-between items-center px-2.5 py-1.5 rounded-lg" style={{ background: '#0d1117' }}>
                      <div className="min-w-0">
                        <div style={{ color: '#c3c2b7' }} className="text-[11px] truncate">#{c.numero} · {getNome(c.locatario)}</div>
                        <div style={{ color: '#5a5f6a' }} className="text-[10px] truncate">{getNome(c.imovel)}</div>
                      </div>
                      <div style={{ color: cor }} className="text-[10px] font-medium flex-shrink-0 ml-2">{label}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-xl p-4">
              <div className="flex items-center justify-between mb-2.5">
                <p style={{ color: '#f4f4f3' }} className="text-xs font-medium">Repasses aos proprietários</p>
                <Link href="/financeiro" style={{ color: '#3987e5' }} className="text-[11px] hover:underline">Ver todos →</Link>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div style={{ background: '#2e2515' }} className="rounded-lg p-2 text-center">
                  <div style={{ color: '#f59e0b' }} className="text-sm font-medium">{formatValCompact(repassesBI.totalARepassar)}</div>
                  <div style={{ color: '#8b8d98' }} className="text-[10px] mt-0.5">{repassesBI.pendentes.length} pendente(s)</div>
                </div>
                <div style={{ background: '#1a2e1f' }} className="rounded-lg p-2 text-center">
                  <div style={{ color: '#3fb950' }} className="text-sm font-medium">{formatValCompact(repassesBI.totalRepassadoMes)}</div>
                  <div style={{ color: '#8b8d98' }} className="text-[10px] mt-0.5">Repassado (mês)</div>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                {repassesBI.tabela.length === 0 ? (
                  <p style={{ color: '#8b8d98' }} className="text-[11px] text-center py-4">Nenhum repasse pendente</p>
                ) : repassesBI.tabela.map((c, i) => (
                  <div key={i} className="flex justify-between items-center px-2.5 py-1.5 rounded-lg" style={{ background: '#0d1117' }}>
                    <div className="min-w-0">
                      <div style={{ color: '#c3c2b7' }} className="text-[11px] truncate">{locadoresMap[c.locador_id] || '—'}</div>
                      <div style={{ color: '#5a5f6a' }} className="text-[10px] truncate">{getNome(c.contrato?.imovel)}</div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <div style={{ color: '#3fb950' }} className="text-[11px] font-medium">{formatValCompact(c.valor_repasse || 0)}</div>
                      <div style={{ color: '#f59e0b' }} className="text-[10px]">Aguardando</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
            <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-xl p-4">
              <div className="flex items-center justify-between mb-2.5">
                <p style={{ color: '#f4f4f3' }} className="text-xs font-medium">Ranking de bairros</p>
                <span style={{ color: '#8b8d98' }} className="text-[11px]">por contratos</span>
              </div>
              {rankingBairros.length === 0 ? (
                <p style={{ color: '#8b8d98' }} className="text-[11px] text-center py-4">Nenhum contrato ativo</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {rankingBairros.map((b, i) => {
                    const maxQtd = rankingBairros[0]?.qtd || 1
                    const largura = (b.qtd / maxQtd) * 100
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span style={{ color: '#c3c2b7' }} className="text-[11px]">{b.bairro}</span>
                          <span style={{ color: '#f4f4f3' }} className="text-[11px] font-medium">{b.qtd}</span>
                        </div>
                        <div style={{ background: '#0d1117', height: 5, borderRadius: 3 }}>
                          <div style={{ background: '#2a78d6', width: `${largura}%`, height: 5, borderRadius: 3 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {popupAberto === 'previstos' && (
        <ModalListaFinanceira
          titulo="Aluguéis Previstos a Receber (mês)"
          subtitulo="Cobranças com vencimento no mês selecionado"
          linhas={linhasPrevistosBI}
          vazio="Nenhuma cobrança prevista para este mês."
          onFechar={() => setPopupAberto(null)}
        />
      )}
      {popupAberto === 'recebidos' && (
        <ModalListaFinanceira
          titulo="Valor recebido"
          subtitulo="Aluguéis pagos no mês selecionado"
          linhas={linhasRecebidosBI}
          vazio="Nenhum aluguel recebido neste mês ainda."
          onFechar={() => setPopupAberto(null)}
        />
      )}
      {popupAberto === 'atraso' && (
        <ModalListaFinanceira
          titulo="Valor em aberto"
          subtitulo="Aluguéis vencidos e não pagos no mês selecionado"
          linhas={linhasAtrasoBI}
          vazio="Nenhuma cobrança em atraso neste mês."
          onFechar={() => setPopupAberto(null)}
        />
      )}
      {popupAberto === 'repasses' && (
        <ModalListaFinanceira
          titulo="Repasses pendentes (mês)"
          subtitulo="Cobranças do mês ainda não pagas — repasse aguardando"
          linhas={linhasRepassesBI}
          vazio="Nenhum repasse pendente neste mês."
          onFechar={() => setPopupAberto(null)}
        />
      )}
      {popupAberto === 'honorarios' && (
        <ModalListaFinanceira
          titulo="Honorários de locação (mês)"
          subtitulo="Contratos com honorários de locação recebidos ou previstos"
          linhas={linhasHonorariosBI}
          vazio="Nenhum contrato com honorários pendente."
          onFechar={() => setPopupAberto(null)}
        />
      )}
    </AppLayout>
  )
}
