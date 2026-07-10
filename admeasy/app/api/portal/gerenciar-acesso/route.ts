import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Verifica o token do usuário autenticado (enviado pelo cliente no header
// Authorization) direto no Supabase Auth — nunca confia em identidade
// declarada pelo corpo da requisição.
async function autenticarChamador(request: Request): Promise<{ userId: string } | null> {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return null

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data, error } = await supabaseAuth.auth.getUser(token)
  if (error || !data?.user) return null
  return { userId: data.user.id }
}

export async function POST(request: Request) {
  try {
    const chamador = await autenticarChamador(request)
    if (!chamador) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    // Descobre a organização do usuário autenticado no servidor — nunca
    // confia no organizationId enviado no corpo da requisição. Só quem tem
    // papel 'admin' na organização pode criar/redefinir acesso ao portal
    // (regra mais restritiva compatível com o dado existente, já que hoje
    // 'admin' é o único papel gravado em usuarios_organizacao).
    const { data: vinculo, error: erroVinculo } = await supabaseAdmin
      .from('usuarios_organizacao')
      .select('organization_id')
      .eq('user_id', chamador.userId)
      .eq('papel', 'admin')
      .maybeSingle()

    if (erroVinculo || !vinculo?.organization_id) {
      // Mensagem genérica de propósito: não revela se o problema é falta de
      // vínculo, organização errada ou papel insuficiente.
      return NextResponse.json({ error: 'Usuário sem permissão para esta ação.' }, { status: 403 })
    }

    const organizationId = vinculo.organization_id

    const { clienteId, email, senha } = await request.json()

    if (!clienteId || !email || !senha) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
    }
    if (senha.length < 6) {
      return NextResponse.json({ error: 'A senha precisa ter pelo menos 6 caracteres.' }, { status: 400 })
    }

    // Confirma que o cliente existe e pertence à organização do usuário
    // autenticado. Se pertencer a outra organização, responde como "não
    // encontrado" (não confirma nem nega a existência em outra organização).
    const { data: cliente, error: erroCliente } = await supabaseAdmin
      .from('clientes')
      .select('id, organization_id, usuario_portal_id')
      .eq('id', clienteId)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (erroCliente || !cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    }

    // Já tem acesso: só redefine a senha.
    if (cliente.usuario_portal_id) {
      const { error: erroSenha } = await supabaseAdmin.auth.admin.updateUserById(
        cliente.usuario_portal_id,
        { password: senha }
      )
      if (erroSenha) {
        return NextResponse.json({ error: erroSenha.message }, { status: 400 })
      }
      await supabaseAdmin.from('clientes').update({ email, tem_portal: true }).eq('id', clienteId).eq('organization_id', organizationId)
      return NextResponse.json({ ok: true, redefinida: true })
    }

    // Ainda não tem acesso: cria o usuário no Supabase Auth.
    const { data: novoUsuario, error: erroCriacao } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    })

    if (erroCriacao || !novoUsuario?.user) {
      return NextResponse.json({ error: erroCriacao?.message || 'Erro ao criar usuário.' }, { status: 400 })
    }

    const { error: erroVinculoCliente } = await supabaseAdmin
      .from('clientes')
      .update({ usuario_portal_id: novoUsuario.user.id, tem_portal: true, email })
      .eq('id', clienteId)
      .eq('organization_id', organizationId)

    if (erroVinculoCliente) {
      // Se o vínculo falhar, desfaz a criação do usuário pra não deixar órfão.
      await supabaseAdmin.auth.admin.deleteUser(novoUsuario.user.id)
      return NextResponse.json({ error: erroVinculoCliente.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, redefinida: false })
  } catch (e: any) {
    console.error('Erro em gerenciar-acesso:', e)
    return NextResponse.json({ error: 'Erro inesperado ao processar a solicitação.' }, { status: 500 })
  }
}
