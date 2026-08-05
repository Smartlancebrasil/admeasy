import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ============================================================
// Cadastro automático de novo usuário (staff) vinculado à organização
// de quem chama. Substitui o fluxo antigo (Configurações grava só um
// registro em "convites", e o admin tinha que ir manualmente no painel
// do Supabase criar o login com o mesmo e-mail, sem nada automatizando
// o vínculo com "users"/"usuarios_organizacao" depois disso).
//
// Faz os três passos de uma vez, do lado do servidor, com a service
// role: (1) cria o login no Supabase Auth via convite por e-mail — o
// próprio Supabase manda o e-mail com link pra pessoa definir a senha;
// (2) grava em "users"; (3) grava em "usuarios_organizacao". Só quem
// já é admin da organização pode chamar esta rota.
//
// O link do e-mail de convite aponta pra /redefinir-senha — mesma
// página já usada pelo fluxo de recuperação de senha, que já sabe
// lidar com uma sessão nova do Supabase pedindo pra definir senha.
//
// Risco residual conhecido (aceito por ora): o link de convite é de
// uso único, igual o de recuperação de senha — um scanner de segurança
// de e-mail corporativo poderia consumi-lo antes do clique humano. O
// pior caso é o convite precisar ser reenviado; não expõe dado de
// ninguém. Não tem a mesma proteção de link seguro construída pra
// recuperação de senha (lib/passwordRecoverySeguranca.ts) — pode ser
// adicionada depois se necessário.
// ============================================================

const PERFIS_VALIDOS = new Set(['admin', 'corretor', 'assistente', 'financeiro', 'vistoriador'])
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function autenticarAdmin(request: NextRequest): Promise<{ userId: string; organizationId: string } | null> {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return null

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data, error } = await supabaseAuth.auth.getUser(token)
  if (error || !data?.user) return null

  const { data: vinculo } = await supabaseAdmin
    .from('usuarios_organizacao')
    .select('organization_id, papel')
    .eq('user_id', data.user.id)
    .maybeSingle()
  if (!vinculo || vinculo.papel !== 'admin') return null

  return { userId: data.user.id, organizationId: vinculo.organization_id }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await autenticarAdmin(request)
    if (!admin) {
      return NextResponse.json(
        { erro: 'Apenas administradores da organização podem cadastrar novos usuários.' },
        { status: 403 }
      )
    }

    const corpo = await request.json()
    const nome = typeof corpo?.nome === 'string' ? corpo.nome.trim() : ''
    const emailBruto = typeof corpo?.email === 'string' ? corpo.email.trim() : ''
    const perfil = typeof corpo?.perfil === 'string' ? corpo.perfil : ''

    if (!nome) {
      return NextResponse.json({ erro: 'Nome é obrigatório.' }, { status: 400 })
    }
    if (!REGEX_EMAIL.test(emailBruto)) {
      return NextResponse.json({ erro: 'E-mail inválido.' }, { status: 400 })
    }
    if (!PERFIS_VALIDOS.has(perfil)) {
      return NextResponse.json({ erro: 'Perfil inválido.' }, { status: 400 })
    }
    const email = emailBruto.toLowerCase()

    const { data: existente } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (existente) {
      return NextResponse.json({ erro: 'Já existe um usuário cadastrado com esse e-mail.' }, { status: 409 })
    }

    const { data: convite, error: erroConvite } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { nome },
      redirectTo: `${request.nextUrl.origin}/redefinir-senha`,
    })

    if (erroConvite || !convite?.user) {
      // Não expor a mensagem bruta do Supabase (mesma cautela do resto
      // do app pra erros de auth) — só decide se é um caso conhecido.
      console.error('Erro ao convidar usuário:', erroConvite?.message)
      const jaRegistrado = (erroConvite?.message || '').toLowerCase().includes('already registered')
      return NextResponse.json(
        {
          erro: jaRegistrado
            ? 'Já existe um login no Supabase com esse e-mail, mas sem vínculo com nenhuma organização. Fale com o suporte técnico.'
            : 'Não foi possível enviar o convite. Tente novamente.',
        },
        { status: jaRegistrado ? 409 : 500 }
      )
    }

    const novoUserId = convite.user.id

    const { error: erroUsers } = await supabaseAdmin.from('users').insert({
      id: novoUserId,
      email,
      nome,
      organization_id: admin.organizationId,
      perfil,
    })
    const { error: erroVinculo } = await supabaseAdmin.from('usuarios_organizacao').insert({
      user_id: novoUserId,
      organization_id: admin.organizationId,
      papel: perfil,
    })

    if (erroUsers || erroVinculo) {
      console.error('Erro ao vincular novo usuário à organização:', erroUsers?.message || erroVinculo?.message)
      // Desfaz o login criado pra não deixar uma conta órfã, sem
      // organização, igual ao problema que esta rota existe pra evitar.
      await supabaseAdmin.auth.admin.deleteUser(novoUserId)
      return NextResponse.json(
        { erro: 'Não foi possível vincular o usuário à organização. Tente novamente.' },
        { status: 500 }
      )
    }

    // Registro de auditoria — não bloqueia a resposta se falhar, o
    // vínculo real (users/usuarios_organizacao) já foi gravado acima.
    const { error: erroAuditoria } = await supabaseAdmin.from('convites').insert({
      organization_id: admin.organizationId,
      email,
      perfil,
      nome,
      criado_por: admin.userId,
      usado: true,
    })
    if (erroAuditoria) {
      console.error('Aviso: falha ao registrar auditoria de convite (não bloqueante):', erroAuditoria.message)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Erro ao convidar usuário:', err?.message || err)
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
