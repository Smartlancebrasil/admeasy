import { supabase } from '@/lib/supabase'

// ============================================================
// Helper client-side pra cadastrar um novo usuário (staff) vinculado à
// organização — ver app/api/usuarios/convidar/route.ts. Cria o login
// no Supabase Auth e já vincula a organização em um só passo, sem
// precisar mais criar o login manualmente no painel do Supabase.
// ============================================================

// Mesma cautela já usada em lib/documentosAdmin.ts: se o token enviado
// não se autenticar (ex.: sessão ficou velha na aba de Configurações
// aberta há tempo), tenta renovar e reenviar uma vez antes de desistir.
const MENSAGENS_SESSAO_INVALIDA = new Set([
  'Apenas administradores da organização podem cadastrar novos usuários.',
])

async function tokenAtual(forcarRefresh = false): Promise<string | null> {
  if (forcarRefresh) {
    const { data } = await supabase.auth.refreshSession()
    if (data.session?.access_token) return data.session.access_token
  }
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

export async function convidarUsuario(params: {
  nome: string
  email: string
  perfil: string
}): Promise<{ ok: true } | { erro: string }> {
  const token = await tokenAtual()
  if (!token) return { erro: 'Sessão expirada. Faça login novamente.' }

  const enviar = (tokenParaEnvio: string) => fetch('/api/usuarios/convidar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenParaEnvio}` },
    body: JSON.stringify(params),
  })

  try {
    let res = await enviar(token)
    let json = await res.json()
    if (!res.ok && res.status === 403 && MENSAGENS_SESSAO_INVALIDA.has(json.erro)) {
      const tokenRenovado = await tokenAtual(true)
      if (tokenRenovado && tokenRenovado !== token) {
        res = await enviar(tokenRenovado)
        json = await res.json()
      }
    }
    if (!res.ok) return { erro: json.erro || 'Erro ao cadastrar usuário.' }
    return { ok: true }
  } catch {
    return { erro: 'Erro de conexão ao cadastrar usuário.' }
  }
}
