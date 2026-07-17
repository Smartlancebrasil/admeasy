import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ============================================================
// PROPOSTA — não commitada, não deployada, não wireada em nenhuma
// tela ainda. Ver docs/STORAGE_PRIVATE_MIGRATION_PROPOSAL.md, Seção 0.5.
//
// Exclusão de documentos administrativos (staff) via service role, com
// validação real de organização/contrato/análise antes de apagar do
// bucket. Espelha a lógica de autorização de
// app/api/documentos/url-assinada/route.ts (mesmos prefixos, mesma
// fonte de verdade), mas para DELETE em vez de gerar signed URL.
//
// Não cobre "chamados/" (o portal nunca exclui anexo de demanda hoje —
// não haveria caso de uso pra isso nesta rota) nem qualquer exclusão
// feita pelo navegador do usuário do portal — nenhum usuário do portal
// deve ter caminho de exclusão, direto ou indireto, por design.
// ============================================================

function criarClientesSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return null
  }

  return {
    supabaseAuth: createClient(supabaseUrl, anonKey),
    supabaseAdmin: createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
  }
}

async function autenticarStaff(
  request: NextRequest,
  supabaseAuth: SupabaseClient,
  supabaseAdmin: SupabaseClient
): Promise<{ userId: string; organizationId: string } | null> {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return null

  const { data, error } = await supabaseAuth.auth.getUser(token)
  if (error || !data?.user) return null

  const { data: staffRow } = await supabaseAdmin
    .from('users')
    .select('organization_id')
    .eq('id', data.user.id)
    .maybeSingle()
  if (!staffRow) return null

  return { userId: data.user.id, organizationId: staffRow.organization_id }
}

export async function POST(request: NextRequest) {
  try {
    const clientes = criarClientesSupabase()

    if (!clientes) {
      console.error('Documentos/excluir: configuração do Supabase ausente.')
      return NextResponse.json(
        { erro: 'Serviço temporariamente indisponível.' },
        { status: 503 }
      )
    }

    const { supabaseAuth, supabaseAdmin } = clientes

    const staff = await autenticarStaff(request, supabaseAuth, supabaseAdmin)
    if (!staff) {
      return NextResponse.json({ erro: 'Apenas usuários internos podem excluir documentos administrativos.' }, { status: 403 })
    }

    const { path } = await request.json()
    if (!path || typeof path !== 'string') {
      return NextResponse.json({ erro: 'path é obrigatório.' }, { status: 400 })
    }
    if (path.includes('..') || path.startsWith('/')) {
      return NextResponse.json({ erro: 'Caminho inválido.' }, { status: 400 })
    }

    const partes = path.split('/')
    const prefixo = partes[0]
    let autorizado = false

    if (prefixo === 'contratos') {
      const contratoId = partes[1]
      const { data: contrato } = await supabaseAdmin
        .from('contratos')
        .select('organization_id')
        .eq('id', contratoId)
        .maybeSingle()
      autorizado = !!contrato && contrato.organization_id === staff.organizationId
    } else if (prefixo === 'analises') {
      const analiseId = partes[1]
      const { data: analise } = await supabaseAdmin
        .from('analises_cadastrais')
        .select('organization_id')
        .eq('id', analiseId)
        .maybeSingle()
      autorizado = !!analise && analise.organization_id === staff.organizationId
    } else if (prefixo === 'vistorias') {
      // Mesma limitação conhecida da rota de upload: o path só carrega
      // organization_id, não o id da vistoria — validação possível é só
      // por organização.
      autorizado = partes[1] === staff.organizationId
    } else if (prefixo === 'logos') {
      const orgDoNome = (partes[1] || '').split('.')[0]
      autorizado = orgDoNome === staff.organizationId
    }
    // "chamados/" propositalmente fora — nenhum caso de uso de staff
    // excluindo anexo de chamado hoje, e locatário/locador nunca chegam
    // nesta rota (ela já exige linha em "users").

    if (!autorizado) {
      return NextResponse.json({ erro: 'Acesso não autorizado a este arquivo.' }, { status: 403 })
    }

    const { error: erroRemocao } = await supabaseAdmin.storage.from('documentos').remove([path])
    if (erroRemocao) {
      console.error('Erro na exclusão administrativa:', erroRemocao.message)
      return NextResponse.json({ erro: 'Não foi possível excluir o arquivo.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Erro na exclusão administrativa:', err?.message || err)
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
