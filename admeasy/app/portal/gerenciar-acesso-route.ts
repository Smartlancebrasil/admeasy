import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request: Request) {
  try {
    const { clienteId, email, senha, organizationId } = await request.json()

    if (!clienteId || !email || !senha) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
    }
    if (senha.length < 6) {
      return NextResponse.json({ error: 'A senha precisa ter pelo menos 6 caracteres.' }, { status: 400 })
    }

    // Confirma que o cliente existe e pertence à organização que está
    // fazendo a chamada (defesa extra enquanto o RLS ainda está desligado).
    const { data: cliente, error: erroCliente } = await supabaseAdmin
      .from('clientes')
      .select('id, organization_id, usuario_portal_id')
      .eq('id', clienteId)
      .maybeSingle()

    if (erroCliente || !cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    }
    if (organizationId && cliente.organization_id && cliente.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Este cliente não pertence à sua organização.' }, { status: 403 })
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
      await supabaseAdmin.from('clientes').update({ email, tem_portal: true }).eq('id', clienteId)
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

    const { error: erroVinculo } = await supabaseAdmin
      .from('clientes')
      .update({ usuario_portal_id: novoUsuario.user.id, tem_portal: true, email })
      .eq('id', clienteId)

    if (erroVinculo) {
      // Se o vínculo falhar, desfaz a criação do usuário pra não deixar órfão.
      await supabaseAdmin.auth.admin.deleteUser(novoUsuario.user.id)
      return NextResponse.json({ error: erroVinculo.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, redefinida: false })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro inesperado.' }, { status: 500 })
  }
}
