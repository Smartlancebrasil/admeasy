import { NextRequest, NextResponse } from 'next/server'
import { validarEntradaRecuperacao, NOME_COOKIE_RECUPERACAO } from '@/lib/passwordRecoverySeguranca'

// ============================================================
// Primeiro hop do fluxo seguro de recuperação de senha. Recebe só os
// dois parâmetros mínimos do template do Supabase (token_hash + type)
// — nunca a ConfirmationURL inteira — e NUNCA chama o Supabase aqui.
//
// Um scanner de segurança de e-mail (Outlook Safe Links, filtro
// corporativo, o preview do Resend) que faça um GET automático nesta
// URL não consome nada: ele só recebe um cookie na própria sessão HTTP
// efêmera do scanner, que não é compartilhada com o navegador real do
// usuário. Nenhuma verificação no Supabase acontece até o clique
// humano em /confirmar-recuperacao (ver /api/auth/recuperacao/token).
// ============================================================

function redirecionarSemParametros(origem: string): NextResponse {
  const resposta = NextResponse.redirect(new URL('/confirmar-recuperacao', origem), 303)
  resposta.headers.set('Cache-Control', 'no-store')
  resposta.headers.set('Referrer-Policy', 'no-referrer')
  return resposta
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type')

  const resposta = redirecionarSemParametros(request.url)

  // Entrada inválida/malformada: redireciona pra mesma página limpa,
  // sem cookie — ela vai mostrar "link inválido" via /status. Nunca
  // loga o valor recebido (pode ser uma tentativa de payload).
  if (!validarEntradaRecuperacao(tokenHash, type)) {
    return resposta
  }

  resposta.cookies.set({
    name: NOME_COOKIE_RECUPERACAO,
    value: tokenHash!,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/auth/recuperacao',
    maxAge: 300, // 5 minutos — janela curta o suficiente pra cobrir o
    // tempo entre abrir o e-mail e clicar em "Continuar redefinição".
  })

  return resposta
}
