// ============================================================
// AdmEasy — Lógica de cálculo de reajuste e rescisão
// ============================================================

import { ResultadoReajuste, ResultadoRescisao, IndiceReajuste } from '@/types'

// Índices acumulados 12 meses (atualizar mensalmente via cron ou API)
export const INDICES_ACUMULADOS: Record<IndiceReajuste, { percentual: number; referencia: string; fonte: string }> = {
  'IGP-M': { percentual: 4.62, referencia: 'Jul/24', fonte: 'FGV' },
  'IPCA':  { percentual: 3.89, referencia: 'Jun/24', fonte: 'IBGE' },
  'INPC':  { percentual: 3.71, referencia: 'Jun/24', fonte: 'IBGE' },
  'IVAR':  { percentual: 5.14, referencia: 'Jun/24', fonte: 'FGV' },
}

// Calcula reajuste para um índice específico
export function calcularReajuste(
  valorAtual: number,
  indice: IndiceReajuste
): ResultadoReajuste {
  const dados = INDICES_ACUMULADOS[indice]
  const percentual = dados.percentual
  const acrescimo = valorAtual * (percentual / 100)
  const valorNovo = valorAtual + acrescimo

  return {
    indice,
    percentual,
    valorAnterior: valorAtual,
    acrescimo: Math.round(acrescimo * 100) / 100,
    valorNovo: Math.round(valorNovo * 100) / 100,
  }
}

// Calcula reajuste para todos os índices (comparativo)
export function calcularTodosIndices(valorAtual: number): Record<IndiceReajuste, ResultadoReajuste> {
  const indices: IndiceReajuste[] = ['IGP-M', 'IPCA', 'INPC', 'IVAR']
  const resultado = {} as Record<IndiceReajuste, ResultadoReajuste>
  indices.forEach(idx => {
    resultado[idx] = calcularReajuste(valorAtual, idx)
  })
  return resultado
}

// Formata valor em real brasileiro
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)
}

// Formata percentual
export function formatarPercentual(valor: number): string {
  return `${valor.toFixed(2).replace('.', ',')}%`
}

// ============================================================
// CÁLCULO DE RESCISÃO (Lei 8.245/91)
// ============================================================
export interface ParamsRescisao {
  valorMensal: number
  mesesRestantes: number
  multaAlugueis: number       // ex: 3 = três aluguéis de multa
  avisoPrevioDias: number     // ex: 30
  caucaoDisponivel: number
  quemRescinde: 'locatario' | 'locador' | 'mutuo_acordo'
  diaRescisao?: number        // dia do mês da rescisão (para proporcional)
}

export function calcularRescisao(params: ParamsRescisao): ResultadoRescisao {
  const {
    valorMensal,
    mesesRestantes,
    multaAlugueis,
    avisoPrevioDias,
    caucaoDisponivel,
    quemRescinde,
    diaRescisao = 1,
  } = params

  // Aluguel proporcional do mês da saída
  const diasNoMes = 30
  const aluguelProporcional = (valorMensal / diasNoMes) * (diasNoMes - diaRescisao + 1)

  let multaContratual = 0
  let avisoPrevioValor = 0
  let caucaoDevolver = 0
  let quemPaga: 'locatario' | 'locador' | 'nenhum' = 'nenhum'

  if (quemRescinde === 'locatario') {
    // Lei 8.245/91, art. 4º — multa proporcional ao tempo restante
    const proporcao = mesesRestantes / (mesesRestantes + (12 - mesesRestantes))
    multaContratual = valorMensal * multaAlugueis * Math.min(proporcao, 1)

    // Aviso prévio — art. 6º
    if (avisoPrevioDias > 0) {
      avisoPrevioValor = (valorMensal / 30) * avisoPrevioDias
    }
    caucaoDevolver = caucaoDisponivel
    quemPaga = 'locatario'
  } else if (quemRescinde === 'locador') {
    // Locador que rescinde sem justa causa paga multa ao locatário
    multaContratual = valorMensal * multaAlugueis
    caucaoDevolver = caucaoDisponivel
    quemPaga = 'locador'
  } else {
    // Mútuo acordo — sem multa, apenas proporcional e devolução de caução
    caucaoDevolver = caucaoDisponivel
    quemPaga = 'nenhum'
  }

  const totalBruto = aluguelProporcional + multaContratual + avisoPrevioValor
  const totalAPagar = quemRescinde === 'locatario'
    ? totalBruto - caucaoDevolver
    : -(multaContratual + caucaoDevolver)

  return {
    aluguelProporcional: Math.round(aluguelProporcional * 100) / 100,
    multaContratual: Math.round(multaContratual * 100) / 100,
    avisoPrevioValor: Math.round(avisoPrevioValor * 100) / 100,
    caucaoDevolver: Math.round(caucaoDevolver * 100) / 100,
    totalAPagar: Math.round(totalAPagar * 100) / 100,
    quemPaga,
  }
}

// ============================================================
// TAXA DE ADMINISTRAÇÃO
// ============================================================
export function calcularTaxaAdm(
  valorAluguel: number,
  percentual: number
): { taxa: number; repasse: number } {
  const taxa = Math.round(valorAluguel * (percentual / 100) * 100) / 100
  const repasse = Math.round((valorAluguel - taxa) * 100) / 100
  return { taxa, repasse }
}

// Quantos dias até uma data
export function diasAte(dataFim: string): number {
  const hoje = new Date()
  const fim = new Date(dataFim)
  const diff = fim.getTime() - hoje.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// Status de urgência por dias restantes
export function urgenciaPorDias(dias: number): 'danger' | 'warning' | 'ok' {
  if (dias <= 5) return 'danger'
  if (dias <= 30) return 'warning'
  return 'ok'
}
