// ============================================================
// Testes mínimos da lógica pura do fluxo seguro de recuperação de
// senha. Roda com o test runner nativo do Node (sem dependência nova):
//
//   node --test lib/passwordRecoverySeguranca.test.ts
//
// Cobre os 6 cenários pedidos: link válido, otp_expired, hash com
// access_denied, ausência de sessão, domínio de ConfirmationURL
// inválido, timeout de verificação.
// ============================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  interpretarErroHash,
  decidirEstadoAposVerificacao,
  validarDominioConfirmacao,
} from './passwordRecoverySeguranca.ts'

// ── interpretarErroHash ─────────────────────────────────────

test('interpretarErroHash: hash vazio não tem erro', () => {
  const resultado = interpretarErroHash('')
  assert.equal(resultado.temErro, false)
  assert.equal(resultado.code, null)
})

test('interpretarErroHash: link válido (access_token/type=recovery, sem error) não tem erro', () => {
  const resultado = interpretarErroHash('#access_token=abc123&refresh_token=xyz&type=recovery')
  assert.equal(resultado.temErro, false)
})

test('interpretarErroHash: otp_expired é detectado corretamente', () => {
  const resultado = interpretarErroHash(
    '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
  )
  assert.equal(resultado.temErro, true)
  assert.equal(resultado.code, 'otp_expired')
  assert.equal(resultado.description, 'Email link is invalid or has expired')
})

test('interpretarErroHash: hash com access_denied (sem otp_expired) também é detectado', () => {
  const resultado = interpretarErroHash('#error=access_denied&error_code=access_denied&error_description=Denied')
  assert.equal(resultado.temErro, true)
  assert.equal(resultado.code, 'access_denied')
})

test('interpretarErroHash: funciona com ou sem o "#" inicial', () => {
  const comHash = interpretarErroHash('#error=access_denied')
  const semHash = interpretarErroHash('error=access_denied')
  assert.equal(comHash.temErro, true)
  assert.equal(semHash.temErro, true)
})

// ── decidirEstadoAposVerificacao ────────────────────────────

test('decidirEstadoAposVerificacao: link válido (evento PASSWORD_RECOVERY recebido) -> pronto', () => {
  const estado = decidirEstadoAposVerificacao({
    erroNoHash: false,
    eventoRecoveryRecebido: true,
    sessaoExistente: true,
  })
  assert.equal(estado, 'pronto')
})

test('decidirEstadoAposVerificacao: erro no hash sempre vence, mesmo com sessão -> invalido', () => {
  const estado = decidirEstadoAposVerificacao({
    erroNoHash: true,
    eventoRecoveryRecebido: false,
    sessaoExistente: true,
  })
  assert.equal(estado, 'invalido')
})

test('decidirEstadoAposVerificacao: ausência de sessão e nenhum evento -> invalido', () => {
  const estado = decidirEstadoAposVerificacao({
    erroNoHash: false,
    eventoRecoveryRecebido: false,
    sessaoExistente: false,
  })
  assert.equal(estado, 'invalido')
})

test('decidirEstadoAposVerificacao: timeout de verificação (nenhum evento chegou, sem sessão de fallback) -> invalido, nunca fica preso em carregando', () => {
  // Simula o que o timeout de app/redefinir-senha/page.tsx faz: depois
  // do prazo, se nenhum evento PASSWORD_RECOVERY chegou e getSession()
  // não encontrou nada, o estado tem que resolver — nunca continuar
  // "carregando" indefinidamente.
  const estadoAposTimeout = decidirEstadoAposVerificacao({
    erroNoHash: false,
    eventoRecoveryRecebido: false,
    sessaoExistente: false,
  })
  assert.notEqual(estadoAposTimeout, 'carregando' as any)
  assert.equal(estadoAposTimeout, 'invalido')
})

test('decidirEstadoAposVerificacao: timeout mas sessão já existia por outro caminho -> pronto', () => {
  const estado = decidirEstadoAposVerificacao({
    erroNoHash: false,
    eventoRecoveryRecebido: false,
    sessaoExistente: true,
  })
  assert.equal(estado, 'pronto')
})

// ── validarDominioConfirmacao ───────────────────────────────

const SUPABASE_URL_TESTE = 'https://exemplo-projeto.supabase.co'

test('validarDominioConfirmacao: ConfirmationURL real do Supabase configurado -> válido', () => {
  const ok = validarDominioConfirmacao(
    'https://exemplo-projeto.supabase.co/auth/v1/verify?token=abc&type=recovery&redirect_to=https://admeasy.com.br/redefinir-senha',
    SUPABASE_URL_TESTE
  )
  assert.equal(ok, true)
})

test('validarDominioConfirmacao: domínio diferente do Supabase configurado -> inválido', () => {
  const ok = validarDominioConfirmacao(
    'https://site-malicioso.com/auth/v1/verify?token=abc&type=recovery',
    SUPABASE_URL_TESTE
  )
  assert.equal(ok, false)
})

test('validarDominioConfirmacao: subdomínio parecido mas diferente -> inválido', () => {
  const ok = validarDominioConfirmacao(
    'https://exemplo-projeto.supabase.co.evil.com/auth/v1/verify?token=abc',
    SUPABASE_URL_TESTE
  )
  assert.equal(ok, false)
})

test('validarDominioConfirmacao: protocolo http (não https) -> inválido', () => {
  const ok = validarDominioConfirmacao(
    'http://exemplo-projeto.supabase.co/auth/v1/verify?token=abc',
    SUPABASE_URL_TESTE
  )
  assert.equal(ok, false)
})

test('validarDominioConfirmacao: caminho fora de /auth/v1/verify -> inválido', () => {
  const ok = validarDominioConfirmacao(
    'https://exemplo-projeto.supabase.co/rest/v1/outra-coisa',
    SUPABASE_URL_TESTE
  )
  assert.equal(ok, false)
})

test('validarDominioConfirmacao: URL malformada -> inválido, nunca lança exceção', () => {
  const ok = validarDominioConfirmacao('isso não é uma URL', SUPABASE_URL_TESTE)
  assert.equal(ok, false)
})
