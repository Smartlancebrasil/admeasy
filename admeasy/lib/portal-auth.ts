import { supabase } from './supabase'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

export type PortalUser = {
  id: string
  cliente_id: string
  email: string
  tipo: 'locatario' | 'locador'
  nome: string
}

// Hash simples usando btoa para não depender de bcrypt no cliente
// Em produção, use bcrypt via API route
function hashSenha(senha: string): string {
  return btoa(unescape(encodeURIComponent(senha + '_admeasy_salt_2024')))
}

export async function loginPortal(email: string, senha: string): Promise<{ user: PortalUser | null; erro: string | null }> {
  const hash = hashSenha(senha)

  const { data, error } = await supabase
    .from('portal_usuarios')
    .select('*, cliente:clientes(nome)')
    .eq('email', email.toLowerCase())
    .eq('senha_hash', hash)
    .eq('ativo', true)
    .eq('organization_id', ORG_ID)
    .single()

  if (error || !data) return { user: null, erro: 'E-mail ou senha incorretos.' }

  await supabase
    .from('portal_usuarios')
    .update({ ultimo_acesso: new Date().toISOString() })
    .eq('id', data.id)

  const user: PortalUser = {
    id: data.id,
    cliente_id: data.cliente_id,
    email: data.email,
    tipo: data.tipo,
    nome: (data.cliente as any)?.nome || data.email,
  }

  // Salvar na session storage
  sessionStorage.setItem('portal_user', JSON.stringify(user))

  return { user, erro: null }
}

export function getPortalUser(): PortalUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem('portal_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function logoutPortal() {
  sessionStorage.removeItem('portal_user')
}

export async function criarLoginPortal(
  clienteId: string,
  email: string,
  senha: string,
  tipo: 'locatario' | 'locador'
): Promise<{ sucesso: boolean; erro: string | null }> {
  const hash = hashSenha(senha)

  const { error } = await supabase.from('portal_usuarios').upsert([{
    organization_id: ORG_ID,
    cliente_id: clienteId,
    email: email.toLowerCase(),
    senha_hash: hash,
    tipo,
    ativo: true,
  }], { onConflict: 'email' })

  if (error) return { sucesso: false, erro: error.message }
  return { sucesso: true, erro: null }
}

export async function alterarSenhaPortal(
  usuarioId: string,
  senhaAtual: string,
  novaSenha: string
): Promise<{ sucesso: boolean; erro: string | null }> {
  const hashAtual = hashSenha(senhaAtual)

  const { data } = await supabase
    .from('portal_usuarios')
    .select('id')
    .eq('id', usuarioId)
    .eq('senha_hash', hashAtual)
    .single()

  if (!data) return { sucesso: false, erro: 'Senha atual incorreta.' }

  const { error } = await supabase
    .from('portal_usuarios')
    .update({ senha_hash: hashSenha(novaSenha) })
    .eq('id', usuarioId)

  if (error) return { sucesso: false, erro: error.message }
  return { sucesso: true, erro: null }
}
