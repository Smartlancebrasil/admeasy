// ============================================================
// Testes mínimos da lógica pura do fluxo seguro de recuperação de
// senha. Roda com o test runner nativo do Node (sem dependência nova):
//
//   node --test lib/passwordRecoverySeguranca.test.ts
//
// Cobre os cenários pedidos: link válido, otp_expired, hash com
// access_denied, ausência de sessão, timeout de verificação, type
// inválido, token_hash ausente/malformado, e a checagem de origem
// usada como defesa extra contra CSRF em /api/auth/recuperacao/token.
//
// O que NÃO dá pra testar aqui (precisa de Request/Response reais do
// Next.js rodando, e de import via alias @/ que o loader nativo do
// Node não resolve): consumo único do cookie e "token expirado" (cookie
// ausente) nas rotas de fato. Esses dois ficam cobertos pelo checklist
// manual — ver o relatório de entrega.
// ============================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  interpretarErroHash,
  decidirEstadoAposVerificacao,
  validarEntradaRecuperacao,
  origemConfiavel,
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

// ── validarEntradaRecuperacao ───────────────────────────────

test('validarEntradaRecuperacao: token_hash bem formado + type=recovery -> válido', () => {
  const ok = validarEntradaRecuperacao('a1b2c3d4e5f6g7h8i9j0-valido_123', 'recovery')
  assert.equal(ok, true)
})

test('validarEntradaRecuperacao: type ausente -> inválido', () => {
  const ok = validarEntradaRecuperacao('a1b2c3d4e5f6g7h8i9j0-valido_123', null)
  assert.equal(ok, false)
})

test('validarEntradaRecuperacao: type diferente de "recovery" (ex.: signup) -> inválido', () => {
  const ok = validarEntradaRecuperacao('a1b2c3d4e5f6g7h8i9j0-valido_123', 'signup')
  assert.equal(ok, false)
})

test('validarEntradaRecuperacao: token_hash ausente -> inválido', () => {
  const ok = validarEntradaRecuperacao(null, 'recovery')
  assert.equal(ok, false)
})

test('validarEntradaRecuperacao: token_hash vazio -> inválido', () => {
  const ok = validarEntradaRecuperacao('', 'recovery')
  assert.equal(ok, false)
})

test('validarEntradaRecuperacao: token_hash curto demais -> inválido', () => {
  const ok = validarEntradaRecuperacao('curto', 'recovery')
  assert.equal(ok, false)
})

test('validarEntradaRecuperacao: token_hash com caracteres fora do esperado (tentativa de payload) -> inválido', () => {
  const ok = validarEntradaRecuperacao('<script>alert(1)</script>xxxxxxxxxxxx', 'recovery')
  assert.equal(ok, false)
})

test('validarEntradaRecuperacao: token_hash absurdamente longo -> inválido', () => {
  const ok = validarEntradaRecuperacao('a'.repeat(300), 'recovery')
  assert.equal(ok, false)
})

// ── origemConfiavel (defesa extra contra CSRF em /api/auth/recuperacao/token) ──

const ORIGEM_ESPERADA = 'https://admeasy.com.br'

test('origemConfiavel: Sec-Fetch-Site=same-origin -> confiável', () => {
  const ok = origemConfiavel({ secFetchSite: 'same-origin', origin: null, origemEsperada: ORIGEM_ESPERADA })
  assert.equal(ok, true)
})

test('origemConfiavel: Sec-Fetch-Site=cross-site -> não confiável', () => {
  const ok = origemConfiavel({ secFetchSite: 'cross-site', origin: null, origemEsperada: ORIGEM_ESPERADA })
  assert.equal(ok, false)
})

test('origemConfiavel: sem Sec-Fetch-Site, Origin igual ao esperado -> confiável', () => {
  const ok = origemConfiavel({ secFetchSite: null, origin: ORIGEM_ESPERADA, origemEsperada: ORIGEM_ESPERADA })
  assert.equal(ok, true)
})

test('origemConfiavel: sem Sec-Fetch-Site, Origin de outro site -> não confiável', () => {
  const ok = origemConfiavel({ secFetchSite: null, origin: 'https://site-malicioso.com', origemEsperada: ORIGEM_ESPERADA })
  assert.equal(ok, false)
})

test('origemConfiavel: nenhum dos dois headers presente -> confia no SameSite do cookie (permite)', () => {
  const ok = origemConfiavel({ secFetchSite: null, origin: null, origemEsperada: ORIGEM_ESPERADA })
  assert.equal(ok, true)
})
