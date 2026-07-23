import { NextRequest, NextResponse } from 'next/server'
import { NOME_COOKIE_RECUPERACAO } from '@/lib/passwordRecoverySeguranca'

// ============================================================
// Checagem somente leitura — nunca consome o cookie, só confirma se
// existe. Usada por /confirmar-recuperacao pra decidir se mostra o
// botão "Continuar redefinição" ou o estado de link inválido, sem
// precisar de um clique primeiro. Sem efeito colateral: mesmo que
// disparada por outra origem, não muda nenhum estado no servidor.
// ============================================================

export async function GET(request: NextRequest) {
  const existe = !!request.cookies.get(NOME_COOKIE_RECUPERACAO)?.value

  const resposta = NextResponse.json({ pronto: existe })
  resposta.headers.set('Cache-Control', 'no-store')
  resposta.headers.set('Referrer-Policy', 'no-referrer')
  return resposta
}
