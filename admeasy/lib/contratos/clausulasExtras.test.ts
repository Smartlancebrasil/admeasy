// ============================================================
// Testes da numeração de cláusulas adicionais — mesma função usada
// pela prévia ao vivo no formulário e pela geração do PDF.
//
//   node --test lib/contratos/clausulasExtras.test.ts
// ============================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prepararClausulasExtras, numeroParaIndice, lerClausulasExtras } from './clausulasExtras.ts'

// ── prepararClausulasExtras ─────────────────────────────────

test('prepararClausulasExtras: lista vazia -> nenhuma cláusula', () => {
  assert.deepEqual(prepararClausulasExtras([]), [])
})

test('prepararClausulasExtras: numeração começa em 32ª', () => {
  const resultado = prepararClausulasExtras(['Texto da primeira cláusula extra.'])
  assert.equal(resultado.length, 1)
  assert.equal(resultado[0].numero, '32ª')
  assert.equal(resultado[0].texto, 'Texto da primeira cláusula extra.')
})

test('prepararClausulasExtras: numeração sequencial pra múltiplas cláusulas', () => {
  const resultado = prepararClausulasExtras(['Primeira.', 'Segunda.', 'Terceira.'])
  assert.deepEqual(resultado.map(c => c.numero), ['32ª', '33ª', '34ª'])
})

test('prepararClausulasExtras: entradas vazias ou só espaço nunca consomem um número', () => {
  const resultado = prepararClausulasExtras(['Primeira.', '', '   ', 'Segunda.'])
  assert.equal(resultado.length, 2)
  assert.deepEqual(resultado.map(c => c.numero), ['32ª', '33ª'])
  assert.deepEqual(resultado.map(c => c.texto), ['Primeira.', 'Segunda.'])
})

test('prepararClausulasExtras: null/undefined na lista são tratados como vazio, nunca lançam exceção', () => {
  const resultado = prepararClausulasExtras([null, 'Única.', undefined])
  assert.equal(resultado.length, 1)
  assert.equal(resultado[0].numero, '32ª')
})

test('prepararClausulasExtras: remove espaços nas pontas do texto', () => {
  const resultado = prepararClausulasExtras(['   Com espaços nas pontas.   '])
  assert.equal(resultado[0].texto, 'Com espaços nas pontas.')
})

// ── numeroParaIndice ─────────────────────────────────────────

test('numeroParaIndice: primeira entrada preenchida -> 32ª', () => {
  assert.equal(numeroParaIndice(['Texto.'], 0), '32ª')
})

test('numeroParaIndice: entrada em branco no meio -> null, não consome número', () => {
  const brutas = ['Primeira.', '', 'Terceira.']
  assert.equal(numeroParaIndice(brutas, 0), '32ª')
  assert.equal(numeroParaIndice(brutas, 1), null)
  assert.equal(numeroParaIndice(brutas, 2), '33ª')
})

test('numeroParaIndice: entrada só com espaços -> null', () => {
  assert.equal(numeroParaIndice(['   '], 0), null)
})

test('numeroParaIndice: várias entradas preenchidas em sequência -> números sequenciais corretos', () => {
  const brutas = ['A', 'B', 'C', 'D']
  assert.equal(numeroParaIndice(brutas, 0), '32ª')
  assert.equal(numeroParaIndice(brutas, 1), '33ª')
  assert.equal(numeroParaIndice(brutas, 2), '34ª')
  assert.equal(numeroParaIndice(brutas, 3), '35ª')
})

// ── lerClausulasExtras ───────────────────────────────────────

test('lerClausulasExtras: string vazia ou nula -> array vazio, nunca lança exceção', () => {
  assert.deepEqual(lerClausulasExtras(''), [])
  assert.deepEqual(lerClausulasExtras(null), [])
  assert.deepEqual(lerClausulasExtras(undefined), [])
})

test('lerClausulasExtras: JSON inválido -> array vazio, nunca lança exceção', () => {
  assert.deepEqual(lerClausulasExtras('isso não é JSON'), [])
  assert.deepEqual(lerClausulasExtras('{"nao":"é array"}'), [])
})

test('lerClausulasExtras: JSON válido de array de strings -> devolve o array', () => {
  assert.deepEqual(lerClausulasExtras('["Primeira.","Segunda."]'), ['Primeira.', 'Segunda.'])
})

test('lerClausulasExtras: array com elementos não-string são filtrados', () => {
  assert.deepEqual(lerClausulasExtras('["Válida.", 123, null, "Outra válida."]'), ['Válida.', 'Outra válida.'])
})

// ── round-trip: preparar + numeroParaIndice devem sempre concordar ──

test('round-trip: numeroParaIndice concorda com prepararClausulasExtras pra cada entrada preenchida', () => {
  const brutas = ['Um', '', 'Dois', '  ', 'Três']
  const preparadas = prepararClausulasExtras(brutas)
  const numerosViaIndice = brutas.map((_, i) => numeroParaIndice(brutas, i)).filter((n): n is string => n !== null)
  assert.deepEqual(numerosViaIndice, preparadas.map(c => c.numero))
})
