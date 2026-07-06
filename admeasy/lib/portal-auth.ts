import { supabase } from './supabase'

export type PortalUser = {
  id: string
  cliente_id: string
  organization_id: string
  email: string
  tipo: 'locatario' | 'locador'
  nome: string
}

/**
 * Busca, na tabela clientes, o registro vinculado a um usuário autenticado
 * do Supabase Auth (usuario_portal_id). Retorna null se não achar vínculo.
 */
async function buscarClienteVinculado(authUserId: string, email: string): Promise<PortalUser | null> {
  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('id, nome, tipo, organization_id')
    .eq('usuario_portal_id', authUserId)
    .maybeSingle()

  if (error || !cliente) return null

  return {
    id: authUserId,
    cliente_id: cliente.id,
    organization_id: cliente.organization_id,
    email,
    tipo: cliente.tipo === 'locador' ? 'locador' : 'locatario',
    nome: cliente.nome,
  }
}

export async function loginPortal(email: string, senha: string): Promise<{ user: PortalUser | null; erro: string | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })

  if (error || !data.user) {
    return { user: null, erro: 'E-mail ou senha incorretos.' }
  }

  const user = await buscarClienteVinculado(data.user.id, data.user.email || email)

  if (!user) {
    await supabase.auth.signOut()
    return { user: null, erro: 'Este acesso não está vinculado a nenhum cliente. Fale com a imobiliária.' }
  }

  return { user, erro: null }
}

export async function getPortalUser(): Promise<PortalUser | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null
  return buscarClienteVinculado(session.user.id, session.user.email || '')
}

export async function logoutPortal() {
  await supabase.auth.signOut()
}

/**
 * Redefine a senha do usuário logado. O Supabase Auth valida pela sessão
 * ativa — não é preciso reenviar a senha atual.
 */
export async function alterarSenhaPortal(novaSenha: string): Promise<{ sucesso: boolean; erro: string | null }> {
  const { error } = await supabase.auth.updateUser({ password: novaSenha })
  if (error) return { sucesso: false, erro: error.message }
  return { sucesso: true, erro: null }
}
