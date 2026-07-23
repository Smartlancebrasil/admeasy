// ============================================================
// Lógica pura do fluxo seguro de recuperação de senha — separada das
// páginas React especificamente para ser testável sem precisar
// renderizar componentes nem mockar o navegador. Ver
// lib/passwordRecoverySeguranca.test.ts.
// ============================================================

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

// Valida que a ConfirmationURL recebida em /confirmar-recuperacao
// aponta mesmo para o projeto Supabase de produção configurado nesta
// aplicação — nunca navega pra um destino que não bata exatamente com
// isso, mesmo que o parâmetro venha de um e-mail (nunca confiar em
// dado vindo de fora sem validar).
export function validarDominioConfirmacao(confirmationUrlBruta: string, supabaseUrlConfigurada: string): boolean {
  try {
    const alvo = new URL(confirmationUrlBruta)
    const esperado = new URL(supabaseUrlConfigurada)

    if (alvo.protocol !== 'https:') return false
    if (alvo.host !== esperado.host) return false
    if (!alvo.pathname.startsWith('/auth/v1/verify')) return false

    return true
  } catch {
    return false
  }
}
