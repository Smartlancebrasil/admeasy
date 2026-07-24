// ============================================================
// Redação centralizada da CLÁUSULA 7ª — DA GARANTIA LOCATÍCIA —
// SEGURO-FIANÇA (Porto Seguro). Extraída para módulo próprio (em vez
// de inline em app/(interno)/contratos/page.tsx) para não espalhar
// texto jurídico longo por componentes de interface.
//
// Esta cláusula SUBSTITUI o conteúdo da CLÁUSULA 7ª (hoje "DA
// GARANTIA") quando tipo_garantia = 'seguro_fianca' — não é uma
// cláusula adicional, e não altera a numeração das cláusulas
// seguintes (8ª em diante permanecem fixas).
//
// Texto normalizado a partir do material fornecido pelo usuário
// (Porto Seguro — versões "prêmio pago pelo locatário" e "prêmio pago
// pelo locador", coberturas adicionais de danos ao imóvel e pintura
// interna). Nunca inclui as duas versões de pagamento simultaneamente
// — escolhe exatamente uma, conforme responsavelPagamentoPremio. Os
// parágrafos são renumerados sequencialmente dentro da cláusula
// gerada (a numeração original do material, que assumia as duas
// versões lado a lado, não se aplica aqui).
//
// Trechos de procuração ampla, cancelamento automático após dois
// aluguéis, desocupação em 30 dias e autorização genérica de citação
// foram deliberadamente excluídos desta implementação e permanecem
// pendentes de validação jurídica específica.
// ============================================================

export type ResponsavelPagamentoPremio = 'locatario' | 'locador'

export type DadosClausulaSeguroFianca = {
  apoliceFianca: string
  responsavelPagamentoPremio: ResponsavelPagamentoPremio | null | undefined
  premioMensal: number
  inicioVigencia: string | null | undefined
  fimVigencia: string | null | undefined
  coberturaDanosImovel: boolean
  coberturaPinturaInterna: boolean
  formatVal: (v: number) => string
  valorExtenso: (v: number) => string
  dataExtenso: (dataStr: string) => string
}

export const SEGURADORA_FIANCA_PADRAO = 'Porto Seguro Cia. de Seguros Gerais'

const ORDINAIS = [
  'PRIMEIRO', 'SEGUNDO', 'TERCEIRO', 'QUARTO', 'QUINTO', 'SEXTO', 'SÉTIMO',
  'OITAVO', 'NONO', 'DÉCIMO', 'DÉCIMO PRIMEIRO', 'DÉCIMO SEGUNDO', 'DÉCIMO TERCEIRO',
  'DÉCIMO QUARTO', 'DÉCIMO QUINTO',
]

// Numera sequencialmente os parágrafos conforme a posição em que
// entram na cláusula final — nunca a numeração original do material
// (que previa as duas versões de pagamento lado a lado).
function rotuloParagrafo(indice: number): string {
  return `PARÁGRAFO ${ORDINAIS[indice] || `${indice + 1}º`}:`
}

export type ClausulaSeguroFianca = {
  cabecalho: string
  paragrafoAbertura: string
  paragrafos: string[]
}

// Gera o conteúdo da CLÁUSULA 7ª para seguro-fiança. Nunca insere as
// duas versões de pagamento juntas. Nunca menciona uma cobertura que
// não esteja marcada como contratada.
export function gerarClausulaSeguroFianca(dados: DadosClausulaSeguroFianca): ClausulaSeguroFianca {
  const cabecalho =
    `CLÁUSULA 7ª — DA GARANTIA LOCATÍCIA — SEGURO-FIANÇA\n` +
    `SEGURADORA: ${SEGURADORA_FIANCA_PADRAO.toUpperCase()}\n` +
    `APÓLICE: ${dados.apoliceFianca || '(não informada)'}`

  const inicioFmt = dados.inicioVigencia ? dados.dataExtenso(dados.inicioVigencia) : '(não informado)'
  const fimFmt = dados.fimVigencia ? dados.dataExtenso(dados.fimVigencia) : '(não informado)'

  const paragrafoAbertura =
    `O seguro de fiança locatícia contratado pelo LOCADOR junto à ${SEGURADORA_FIANCA_PADRAO.toUpperCase()}, com vigência de ` +
    `${inicioFmt} a ${fimFmt}, garante esta locação nos termos do inciso III do artigo 37 da Lei do Inquilinato ` +
    `(Lei nº 8.245/91), mediante o pagamento do prêmio e ressalvadas as exceções previstas nas Condições Gerais da apólice.`

  // Responsável ausente (contrato legado): trata como locatário, igual
  // ao comportamento já vigente hoje (o prêmio sempre foi somado ao
  // boleto do locatário antes deste campo existir).
  const responsavel = dados.responsavelPagamentoPremio || 'locatario'
  const premioFormatado = `${dados.formatVal(dados.premioMensal || 0)} (${dados.valorExtenso(dados.premioMensal || 0)})`

  const paragrafosBase: string[] = [
    `Para a presente contratação, a vigência do seguro corresponde ao prazo do contrato de locação.`,
    `Em caso de prorrogação do contrato de locação, com alterações que influenciem as condições iniciais de aceitação, a Seguradora poderá realizar nova análise do risco.`,
    `O LOCADOR e os LOCATÁRIOS declaram conhecer as Condições Gerais do Seguro de Fiança Locatícia, tendo definido previamente, de comum acordo, a seguradora e o corretor de seguros responsáveis pela contratação da apólice.`,
  ]

  if (responsavel === 'locador') {
    paragrafosBase.push(
      `Os prêmios iniciais e as renovações do Seguro de Fiança Locatícia, calculados conforme as normas vigentes, serão pagos pelo LOCADOR.`,
      `O prêmio do seguro-fiança não será incorporado ao boleto, ao recibo ou às cobranças dos LOCATÁRIOS.`,
    )
  } else {
    paragrafosBase.push(
      `Os prêmios iniciais e as renovações do Seguro de Fiança Locatícia, calculados conforme as normas vigentes, serão pagos pelos LOCATÁRIOS, nos termos do inciso XI do artigo 23 da Lei do Inquilinato, sob pena de rescisão da locação, despejo e cancelamento da apólice, observados os procedimentos legais aplicáveis.`,
      `O prêmio mensal do seguro-fiança, no valor de ${premioFormatado}, será cobrado mensalmente em conjunto com o boleto da locação, de forma individualmente discriminada, sem integrar o valor-base do aluguel e sem compor sua base de reajuste.`,
    )
  }

  paragrafosBase.push(
    `A apólice garantirá exclusivamente as coberturas especificadas na proposta de seguro.`,
    `Eventuais débitos decorrentes deste contrato não pagos pelos LOCATÁRIOS após regular constituição em mora poderão ser comunicados às entidades mantenedoras de bancos de dados de proteção ao crédito, como Serasa e SPC, pelo LOCADOR ou pela Seguradora, podendo tais débitos incluir as despesas decorrentes das medidas judiciais cabíveis.`,
    `As notificações relativas ao presente contrato, inclusive sobre eventuais débitos, poderão ser encaminhadas aos LOCATÁRIOS por e-mail.`,
  )

  if (dados.coberturaDanosImovel) {
    paragrafosBase.push(
      `Os LOCATÁRIOS declaram, para todos os fins e efeitos de direito, que receberam o imóvel locado no estado de conservação e uso identificado no Laudo de Vistoria Inicial, que integra este contrato e deverá ser assinado pelos contratantes, obrigando-se a devolvê-lo no mesmo estado, ressalvadas as deteriorações decorrentes do uso normal do imóvel.`,
      `O descumprimento dessa obrigação sujeitará os LOCATÁRIOS às disposições previstas neste contrato e na legislação aplicável, além da obrigação de indenizar os danos ou prejuízos decorrentes.`,
    )
  }

  if (dados.coberturaPinturaInterna) {
    paragrafosBase.push(
      `Os LOCATÁRIOS declaram, para todos os fins e efeitos de direito, que receberam o imóvel locado com pintura interna nova e obrigam-se, ao final da locação, a devolvê-lo no mesmo estado em que o receberam, ressalvado o desgaste decorrente do uso normal.`,
      `Os LOCATÁRIOS declaram estar cientes de que, caso o imóvel não seja devolvido com a pintura interna nas condições contratadas, a Seguradora poderá indenizar o LOCADOR, dentro dos limites e condições da cobertura, ficando assegurado à Seguradora o direito de cobrar dos responsáveis os valores eventualmente pagos.`,
      `O Segurado deverá comunicar o sinistro à Porto Seguro no prazo máximo de 15 (quinze) dias, contados da desocupação do imóvel.`,
    )
  }

  const paragrafos = paragrafosBase.map((texto, i) => `${rotuloParagrafo(i)} ${texto}`)

  return { cabecalho, paragrafoAbertura, paragrafos }
}

// Verdadeiro somente quando os dados essenciais pra cláusula completa
// estão preenchidos — usado para decidir se um contrato legado (criado
// antes destes campos existirem) ainda deve usar a redação genérica
// atual em vez da cláusula rica (ver regra de compatibilidade retroativa).
export function temDadosCompletosSeguroFianca(dados: {
  apoliceFianca?: string | null
  responsavelPagamentoPremio?: string | null
  inicioVigencia?: string | null
  fimVigencia?: string | null
}): boolean {
  return !!(
    dados.apoliceFianca &&
    dados.responsavelPagamentoPremio &&
    dados.inicioVigencia &&
    dados.fimVigencia
  )
}
