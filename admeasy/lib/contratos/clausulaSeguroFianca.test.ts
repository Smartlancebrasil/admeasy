// ============================================================
// Testes da geração da Cláusula 7ª — seguro-fiança, já com o texto
// normalizado a partir do material fornecido pelo usuário (Porto
// Seguro). Cobre: nunca as duas versões de pagamento juntas,
// coberturas só quando contratadas, numeração sequencial dos
// parágrafos, fallback pra contratos legados.
//
//   node --test lib/contratos/clausulaSeguroFianca.test.ts
// ============================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  gerarClausulaSeguroFianca,
  temDadosCompletosSeguroFianca,
  SEGURADORA_FIANCA_PADRAO,
} from './clausulaSeguroFianca.ts'

const formatVal = (v: number) => `R$ ${v.toFixed(2)}`
const valorExtenso = (v: number) => `(extenso de ${v})`
const dataExtenso = (d: string) => `[data ${d}]`

const BASE = {
  apoliceFianca: '123456',
  premioMensal: 250,
  inicioVigencia: '2026-01-01',
  fimVigencia: '2027-01-01',
  coberturaDanosImovel: false,
  coberturaPinturaInterna: false,
  formatVal,
  valorExtenso,
  dataExtenso,
}

test('cabeçalho sempre traz seguradora fixa e o número da apólice informado', () => {
  const { cabecalho } = gerarClausulaSeguroFianca({ ...BASE, responsavelPagamentoPremio: 'locatario' })
  assert.ok(cabecalho.includes('CLÁUSULA 7ª — DA GARANTIA LOCATÍCIA — SEGURO-FIANÇA'))
  assert.ok(cabecalho.includes(SEGURADORA_FIANCA_PADRAO.toUpperCase()))
  assert.ok(cabecalho.includes('123456'))
})

test('apólice ausente -> cabeçalho não quebra, mostra marcador neutro', () => {
  const { cabecalho } = gerarClausulaSeguroFianca({ ...BASE, apoliceFianca: '', responsavelPagamentoPremio: 'locatario' })
  assert.ok(cabecalho.includes('(não informada)'))
})

test('paragrafoAbertura sempre menciona a Lei do Inquilinato e as datas de vigência', () => {
  const { paragrafoAbertura } = gerarClausulaSeguroFianca({ ...BASE, responsavelPagamentoPremio: 'locatario' })
  assert.ok(paragrafoAbertura.includes('Lei nº 8.245/91'))
  assert.ok(paragrafoAbertura.includes('[data 2026-01-01]'))
  assert.ok(paragrafoAbertura.includes('[data 2027-01-01]'))
})

test('responsavelPagamentoPremio = locatario -> menciona cobrança discriminada no boleto, não menciona "não será incorporado"', () => {
  const { paragrafos } = gerarClausulaSeguroFianca({ ...BASE, responsavelPagamentoPremio: 'locatario' })
  const texto = paragrafos.join('\n')
  assert.ok(texto.includes('será cobrado mensalmente em conjunto com o boleto'))
  assert.ok(texto.includes('pagos pelos LOCATÁRIOS'))
  assert.ok(!texto.includes('não será incorporado ao boleto'))
})

test('responsavelPagamentoPremio = locador -> menciona que o prêmio não é incorporado ao boleto, não menciona cobrança discriminada', () => {
  const { paragrafos } = gerarClausulaSeguroFianca({ ...BASE, responsavelPagamentoPremio: 'locador' })
  const texto = paragrafos.join('\n')
  assert.ok(texto.includes('não será incorporado ao boleto, ao recibo ou às cobranças dos LOCATÁRIOS'))
  assert.ok(texto.includes('pagos pelo LOCADOR'))
  assert.ok(!texto.includes('será cobrado mensalmente em conjunto com o boleto'))
})

test('nunca inclui as duas versões de pagamento simultaneamente', () => {
  const locatario = gerarClausulaSeguroFianca({ ...BASE, responsavelPagamentoPremio: 'locatario' }).paragrafos.join('\n')
  const locador = gerarClausulaSeguroFianca({ ...BASE, responsavelPagamentoPremio: 'locador' }).paragrafos.join('\n')
  assert.ok(!(locatario.includes('não será incorporado ao boleto') && locatario.includes('será cobrado mensalmente')))
  assert.ok(!(locador.includes('não será incorporado ao boleto') && locador.includes('será cobrado mensalmente')))
})

test('responsavelPagamentoPremio ausente (contrato legado) -> assume locatário, igual ao comportamento vigente antes deste campo existir', () => {
  const { paragrafos } = gerarClausulaSeguroFianca({ ...BASE, responsavelPagamentoPremio: null })
  assert.ok(paragrafos.join('\n').includes('será cobrado mensalmente em conjunto com o boleto'))
})

test('cobertura_danos_imovel = false -> não menciona Laudo de Vistoria Inicial', () => {
  const { paragrafos } = gerarClausulaSeguroFianca({ ...BASE, responsavelPagamentoPremio: 'locatario', coberturaDanosImovel: false })
  assert.ok(!paragrafos.join('\n').includes('Laudo de Vistoria Inicial'))
})

test('cobertura_danos_imovel = true -> menciona Laudo de Vistoria Inicial e a obrigação de indenizar', () => {
  const { paragrafos } = gerarClausulaSeguroFianca({ ...BASE, responsavelPagamentoPremio: 'locatario', coberturaDanosImovel: true })
  const texto = paragrafos.join('\n')
  assert.ok(texto.includes('Laudo de Vistoria Inicial'))
  assert.ok(texto.includes('obrigação de indenizar os danos'))
})

test('cobertura_pintura_interna = false -> não menciona pintura interna nova', () => {
  const { paragrafos } = gerarClausulaSeguroFianca({ ...BASE, responsavelPagamentoPremio: 'locatario', coberturaPinturaInterna: false })
  assert.ok(!paragrafos.join('\n').includes('pintura interna nova'))
})

test('cobertura_pintura_interna = true -> menciona pintura interna nova e o prazo de 15 dias pra comunicar sinistro', () => {
  const { paragrafos } = gerarClausulaSeguroFianca({ ...BASE, responsavelPagamentoPremio: 'locatario', coberturaPinturaInterna: true })
  const texto = paragrafos.join('\n')
  assert.ok(texto.includes('pintura interna nova'))
  assert.ok(texto.includes('15 (quinze) dias'))
})

test('nenhuma cobertura contratada -> cláusula não menciona nem danos nem pintura', () => {
  const { paragrafos } = gerarClausulaSeguroFianca({ ...BASE, responsavelPagamentoPremio: 'locatario', coberturaDanosImovel: false, coberturaPinturaInterna: false })
  const texto = paragrafos.join('\n')
  assert.ok(!texto.includes('Laudo de Vistoria Inicial'))
  assert.ok(!texto.includes('pintura interna nova'))
})

test('numeração dos parágrafos é sempre sequencial, sem pular número, independente das coberturas', () => {
  const casos = [
    { coberturaDanosImovel: false, coberturaPinturaInterna: false },
    { coberturaDanosImovel: true, coberturaPinturaInterna: false },
    { coberturaDanosImovel: false, coberturaPinturaInterna: true },
    { coberturaDanosImovel: true, coberturaPinturaInterna: true },
  ]
  for (const caso of casos) {
    const { paragrafos } = gerarClausulaSeguroFianca({ ...BASE, responsavelPagamentoPremio: 'locatario', ...caso })
    const ordinaisEsperados = ['PRIMEIRO', 'SEGUNDO', 'TERCEIRO', 'QUARTO', 'QUINTO', 'SEXTO', 'SÉTIMO', 'OITAVO', 'NONO', 'DÉCIMO', 'DÉCIMO PRIMEIRO', 'DÉCIMO SEGUNDO', 'DÉCIMO TERCEIRO', 'DÉCIMO QUARTO', 'DÉCIMO QUINTO']
    paragrafos.forEach((p, i) => {
      assert.ok(p.startsWith(`PARÁGRAFO ${ordinaisEsperados[i]}:`), `parágrafo ${i} deveria começar com PARÁGRAFO ${ordinaisEsperados[i]} — recebeu: ${p.slice(0, 40)}`)
    })
  }
})

test('nenhum placeholder [PENDENTE] permanece em nenhum cenário', () => {
  const cenarios = [
    { responsavelPagamentoPremio: 'locatario' as const, coberturaDanosImovel: false, coberturaPinturaInterna: false },
    { responsavelPagamentoPremio: 'locatario' as const, coberturaDanosImovel: true, coberturaPinturaInterna: true },
    { responsavelPagamentoPremio: 'locador' as const, coberturaDanosImovel: false, coberturaPinturaInterna: false },
  ]
  for (const cenario of cenarios) {
    const resultado = gerarClausulaSeguroFianca({ ...BASE, ...cenario })
    const textoCompleto = [resultado.cabecalho, resultado.paragrafoAbertura, ...resultado.paragrafos].join('\n')
    assert.ok(!textoCompleto.includes('PENDENTE'), `texto ainda contém PENDENTE: ${textoCompleto}`)
  }
})

// ── temDadosCompletosSeguroFianca ───────────────────────────

test('temDadosCompletosSeguroFianca: todos os campos essenciais presentes -> true', () => {
  const ok = temDadosCompletosSeguroFianca({
    apoliceFianca: '123456',
    responsavelPagamentoPremio: 'locatario',
    inicioVigencia: '2026-01-01',
    fimVigencia: '2027-01-01',
  })
  assert.equal(ok, true)
})

test('temDadosCompletosSeguroFianca: apólice ausente (contrato legado) -> false, usa fallback genérico', () => {
  const ok = temDadosCompletosSeguroFianca({
    apoliceFianca: null,
    responsavelPagamentoPremio: 'locatario',
    inicioVigencia: '2026-01-01',
    fimVigencia: '2027-01-01',
  })
  assert.equal(ok, false)
})

test('temDadosCompletosSeguroFianca: responsável pelo pagamento ausente -> false', () => {
  const ok = temDadosCompletosSeguroFianca({
    apoliceFianca: '123456',
    responsavelPagamentoPremio: null,
    inicioVigencia: '2026-01-01',
    fimVigencia: '2027-01-01',
  })
  assert.equal(ok, false)
})

test('temDadosCompletosSeguroFianca: vigência ausente -> false', () => {
  const ok = temDadosCompletosSeguroFianca({
    apoliceFianca: '123456',
    responsavelPagamentoPremio: 'locatario',
    inicioVigencia: null,
    fimVigencia: null,
  })
  assert.equal(ok, false)
})
