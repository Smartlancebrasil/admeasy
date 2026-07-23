import { NextRequest, NextResponse } from 'next/server'
import { origemConfiavel, NOME_COOKIE_RECUPERACAO } from '@/lib/passwordRecoverySeguranca'

// ============================================================
// Único endpoint que devolve o token_hash — e só depois de um clique
// humano em "Continuar redefinição" em /confirmar-recuperacao. Nunca
// no corpo de uma URL: sempre no corpo JSON de uma resposta a um POST
// same-origin, nunca cacheado, nunca logado.
//
// Consumo único: o cookie é apagado na MESMA resposta que o entrega —
// uma segunda chamada (replay, aba duplicada) encontra 410. A garantia
// definitiva de uso único, porém, é do próprio Supabase: verifyOtp só
// aceita um token_hash uma vez, não importa quantas vezes este endpoint
// o devolva ao mesmo navegador.
// ============================================================

function limparCookie(resposta: NextResponse) {
  resposta.cookies.set({
    name: NOME_COOKIE_RECUPERACAO,
    value: '',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/auth/recuperacao',
    maxAge: 0,
  })
}

export async function POST(request: NextRequest) {
  // Defesa extra contra CSRF, complementar ao SameSite=Lax do cookie
  // (que já impede o cookie de ser enviado numa requisição cross-site).
  const confiavel = origemConfiavel({
    secFetchSite: request.headers.get('sec-fetch-site'),
    origin: request.headers.get('origin'),
    origemEsperada: request.nextUrl.origin,
  })

  if (!confiavel) {
    const negado = NextResponse.json({ erro: 'origem_invalida' }, { status: 403 })
    negado.headers.set('Cache-Control', 'no-store')
    return negado
  }

  const tokenHash = request.cookies.get(NOME_COOKIE_RECUPERACAO)?.value

  if (!tokenHash) {
    const expirado = NextResponse.json({ erro: 'expirado' }, { status: 410 })
    expirado.headers.set('Cache-Control', 'no-store')
    return expirado
  }

  const resposta = NextResponse.json({ token_hash: tokenHash, type: 'recovery' as const })
  resposta.headers.set('Cache-Control', 'no-store')
  resposta.headers.set('Referrer-Policy', 'no-referrer')
  limparCookie(resposta)

  return resposta
}
