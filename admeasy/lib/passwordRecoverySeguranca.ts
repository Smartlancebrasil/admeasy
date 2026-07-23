// ============================================================
// Lógica pura do fluxo seguro de recuperação de senha — separada das
// páginas/rotas React especificamente para ser testável sem precisar
// renderizar componentes nem construir um Request/Response reais do
// Next.js. Ver lib/passwordRecoverySeguranca.test.ts.
// ============================================================

// Nome do cookie httpOnly de curta duração usado para transportar o
// token_hash entre /api/auth/recuperacao/iniciar e /token — compartilhado
// entre as 3 rotas. Fica aqui (não num route.ts) porque o Next.js valida
// estritamente que um módulo route.ts só exporte GET/POST/etc.
export const NOME_COOKIE_RECUPERACAO = 'admeasy_recovery_th'

export type ErroHash = {
  temErro: boolean
  code: string | null
  description: string | null
}

// Lê o hash da URL (#error=...&error_code=...&error_description=...)
// que o Supabase usa para reportar link expirado, já usado, ou
// inválido — nunca deixa isso passar despercebido, mesmo que o SDK
// ainda não tenha processado o hash.
export function interpretarErroHash(hash: string): ErroHash {
  const semAlgo = hash.startsWith('#') ? hash.slice(1) : hash
  if (!semAlgo) return { temErro: false, code: null, description: null }

  const params = new URLSearchParams(semAlgo)
  const erro = params.get('error')
  if (!erro) return { temErro: false, code: null, description: null }

  return {
    temErro: true,
    code: params.get('error_code'),
    description: params.get('error_description'),
  }
}

// Decide o estado da tela /redefinir-senha depois da checagem inicial
// — extraído como função pura pra poder testar todas as combinações
// (link válido, otp_expired, sem sessão, timeout) sem precisar de
// timers nem de um client Supabase de verdade.
export type EstadoVerificacao = 'pronto' | 'invalido'

export function decidirEstadoAposVerificacao(params: {
  erroNoHash: boolean
  eventoRecoveryRecebido: boolean
  sessaoExistente: boolean
}): EstadoVerificacao {
  if (params.erroNoHash) return 'invalido'
  if (params.eventoRecoveryRecebido) return 'pronto'
  if (params.sessaoExistente) return 'pronto'
  return 'invalido'
}

// Formato conservador (base64url-like) para o token_hash recebido em
// /api/auth/recuperacao/iniciar. Não hardcoda o formato interno exato
// do Supabase (pode mudar) — só rejeita valores vazios, longos demais,
// ou com caracteres fora do esperado (proteção básica de entrada,
// nunca confiar em parâmetro vindo de fora sem validar).
const TOKEN_HASH_REGEX = /^[A-Za-z0-9_-]{20,255}$/

// Valida os dois parâmetros mínimos que o e-mail do Supabase manda pra
// /api/auth/recuperacao/iniciar — nunca a ConfirmationURL inteira.
// Extraída como função pura pra testar type ausente/errado e
// token_hash malformado sem precisar montar um NextRequest de verdade.
export function validarEntradaRecuperacao(tokenHash: string | null, type: string | null): boolean {
  if (type !== 'recovery') return false
  if (!tokenHash) return false
  return TOKEN_HASH_REGEX.test(tokenHash)
}

// Confere se uma requisição para consumir o cookie de recuperação
// (POST /api/auth/recuperacao/token) partiu do próprio site — defesa
// extra contra CSRF, complementar ao SameSite=Lax do cookie (que já
// impede o cookie de ser enviado numa requisição fetch/XHR disparada
// por outra origem). Recebe só os headers já lidos, nunca o Request
// inteiro, pra ficar testável isoladamente.
export function origemConfiavel(params: {
  secFetchSite: string | null
  origin: string | null
  origemEsperada: string
}): boolean {
  if (params.secFetchSite) return params.secFetchSite === 'same-origin'
  if (params.origin) return params.origin === params.origemEsperada
  // Sem nenhum dos dois headers (cliente não-navegador) — nesse caso
  // resta confiar só no SameSite=Lax do cookie.
  return true
}
