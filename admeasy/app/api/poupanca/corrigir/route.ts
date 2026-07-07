import { NextRequest, NextResponse } from 'next/server'

// Série 195 do SGS/Banco Central: "Depósitos de poupança a partir de 04/05/2012 —
// Rentabilidade no período". É a regra vigente da poupança (TR + 0,5% a.m., ou
// 70% da Selic quando ela está em 8,5% a.a. ou menos). Cada valor da série já vem
// como a rentabilidade mensal em %, então basta compor (produtório) os meses do período.
const SERIE_POUPANCA = 195

function formatDataBCB(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export async function POST(req: NextRequest) {
  try {
    const { dataInicial, dataFinal, valor } = await req.json()

    if (!dataInicial || !dataFinal) {
      return NextResponse.json({ erro: 'Datas inicial e final são obrigatórias.' }, { status: 400 })
    }

    const ini = new Date(dataInicial + 'T00:00:00')
    const fim = new Date(dataFinal + 'T00:00:00')
    if (fim <= ini) {
      return NextResponse.json({ erro: 'A data final precisa ser depois da data inicial.' }, { status: 400 })
    }

    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${SERIE_POUPANCA}/dados?formato=json&dataInicial=${formatDataBCB(dataInicial)}&dataFinal=${formatDataBCB(dataFinal)}`

    const res = await fetch(url)
    if (!res.ok) {
      console.error('Erro ao consultar API do Banco Central:', res.status, await res.text())
      return NextResponse.json({ erro: 'Erro ao consultar a API do Banco Central. Tente novamente em instantes.' }, { status: 502 })
    }

    const dados: { data: string; valor: string }[] = await res.json()

    if (!dados || dados.length === 0) {
      return NextResponse.json({ erro: 'Nenhum dado de rentabilidade da poupança encontrado para o período informado.' }, { status: 404 })
    }

    // Fator acumulado = produtório de (1 + rentabilidade mensal / 100)
    const fatorAcumulado = dados.reduce((acc, d) => acc * (1 + parseFloat(d.valor.replace(',', '.')) / 100), 1)
    const percentualAcumulado = (fatorAcumulado - 1) * 100
    const valorBase = valor || 0
    const valorCorrigido = valorBase * fatorAcumulado

    return NextResponse.json({
      fatorAcumulado,
      percentualAcumulado,
      valorCorrigido,
      meses: dados.length,
      primeiraCompetencia: dados[0]?.data,
      ultimaCompetencia: dados[dados.length - 1]?.data,
    })
  } catch (err: any) {
    console.error('Erro ao corrigir valor pela poupança:', err)
    return NextResponse.json({ erro: 'Erro interno ao calcular a correção pela poupança.' }, { status: 500 })
  }
}
