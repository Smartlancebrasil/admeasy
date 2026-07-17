import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { EXTENSOES_PERMITIDAS, MIME_PERMITIDOS, TAMANHO_MAXIMO_BYTES, extensaoDoNome } from '@/lib/documentosPermitidos'

// ============================================================
// PROPOSTA — não commitada, não deployada, não wireada em nenhuma
// tela ainda. Ver docs/STORAGE_PRIVATE_MIGRATION_PROPOSAL.md, Seção 0.5.
//
// Upload de documentos administrativos (staff) via service role, com
// validação real de organização/contrato/análise antes de gravar no
// bucket — recomendado como substituto das policies de Storage RLS pra
// essa parte do fluxo (documentos_upload_staff em
// 20260714040000_storage_remover_policy_publica.sql), que hoje só
// confirma "é staff", não confirma a organização dona do arquivo.
//
// NÃO cobre o prefixo "chamados/" (upload de anexo de demanda pelo
// locatário) — esse fluxo continua no client direto, coberto pela
// policy documentos_upload_locatario_chamado, porque já tem escopo por
// organização+papel expresso de forma segura no próprio path.
//
// Corpo esperado: multipart/form-data com campos:
//   file      — o arquivo (obrigatório)
//   prefixo   — 'contratos' | 'analises' | 'vistorias' | 'logo'
//   contratoId  — obrigatório se prefixo === 'contratos'
//   categoria   — obrigatório se prefixo === 'contratos'
//   analiseId   — obrigatório se prefixo === 'analises'
//
// LIMITAÇÃO CONHECIDA (herdada do path atual, não introduzida por esta
// rota): "vistorias" e "logo" não carregam nenhum id de registro
// específico no path (só organization_id, resolvido aqui sempre do
// lado do servidor a partir do staff autenticado — nunca do corpo da
// requisição), então a validação possível pra esses dois prefixos é
// "este staff pertence a esta organização", não "este staff pode
// escrever nesta vistoria/logo específica". Ver Seção 0.5 do documento
// de proposta pra decisão de manter path assim ou reestruturar.
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
      console.error('Documentos/upload: configuração do Supabase ausente.')
      return NextResponse.json(
        { erro: 'Serviço temporariamente indisponível.' },
        { status: 503 }
      )
    }

    const { supabaseAuth, supabaseAdmin } = clientes

    const staff = await autenticarStaff(request, supabaseAuth, supabaseAdmin)
    if (!staff) {
      return NextResponse.json({ erro: 'Apenas usuários internos podem enviar documentos administrativos.' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const prefixo = formData.get('prefixo')

    if (!(file instanceof File)) {
      return NextResponse.json({ erro: 'file é obrigatório.' }, { status: 400 })
    }
    if (typeof prefixo !== 'string' || !['contratos', 'analises', 'vistorias', 'logo'].includes(prefixo)) {
      return NextResponse.json({ erro: 'prefixo inválido.' }, { status: 400 })
    }
    if (file.size > TAMANHO_MAXIMO_BYTES) {
      return NextResponse.json({ erro: 'Arquivo excede o limite de 10 MB.' }, { status: 400 })
    }

    const extensao = extensaoDoNome(file.name)
    if (!EXTENSOES_PERMITIDAS.has(extensao)) {
      return NextResponse.json({ erro: 'Tipo de arquivo não permitido.' }, { status: 400 })
    }
    // O navegador informa file.type a partir do próprio arquivo — não é
    // prova forte de conteúdo (um cliente malicioso pode mentir), mas é
    // uma barreira barata antes de gravar; a verificação forte de
    // verdade acontece na LEITURA (url-assinada), que confere o
    // metadata.mimetype que o Storage registrou de fato no upload.
    if (file.type && !MIME_PERMITIDOS.has(file.type)) {
      return NextResponse.json({ erro: 'Tipo de arquivo não permitido.' }, { status: 400 })
    }

    let path: string

    if (prefixo === 'contratos') {
      const contratoId = formData.get('contratoId')
      const categoria = formData.get('categoria')
      if (typeof contratoId !== 'string' || typeof categoria !== 'string' || !categoria) {
        return NextResponse.json({ erro: 'contratoId e categoria são obrigatórios.' }, { status: 400 })
      }
      const { data: contrato } = await supabaseAdmin
        .from('contratos')
        .select('organization_id')
        .eq('id', contratoId)
        .maybeSingle()
      if (!contrato || contrato.organization_id !== staff.organizationId) {
        return NextResponse.json({ erro: 'Contrato não encontrado ou sem permissão.' }, { status: 403 })
      }
      path = `contratos/${contratoId}/kit/${categoria}/${Date.now()}.${extensao}`
    } else if (prefixo === 'analises') {
      const analiseId = formData.get('analiseId')
      if (typeof analiseId !== 'string') {
        return NextResponse.json({ erro: 'analiseId é obrigatório.' }, { status: 400 })
      }
      const { data: analise } = await supabaseAdmin
        .from('analises_cadastrais')
        .select('organization_id')
        .eq('id', analiseId)
        .maybeSingle()
      if (!analise || analise.organization_id !== staff.organizationId) {
        return NextResponse.json({ erro: 'Análise não encontrada ou sem permissão.' }, { status: 403 })
      }
      path = `analises/${analiseId}/${Date.now()}.${extensao}`
    } else if (prefixo === 'vistorias') {
      // organization_id sempre do staff autenticado, nunca do corpo da
      // requisição. Sem validação por registro específico — ver
      // limitação documentada no cabeçalho deste arquivo.
      path = `vistorias/${staff.organizationId}/${Date.now()}.${extensao}`
    } else {
      // logo — path fixo por organização, upsert (substitui o logo anterior).
      path = `logos/${staff.organizationId}.${extensao}`
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: erroUpload } = await supabaseAdmin
      .storage
      .from('documentos')
      .upload(path, buffer, { contentType: file.type || undefined, upsert: prefixo === 'logo' })

    if (erroUpload) {
      // Não logar "path" nem nome do arquivo — só a mensagem do SDK.
      console.error('Erro no upload administrativo:', erroUpload.message)
      return NextResponse.json({ erro: 'Não foi possível enviar o arquivo.' }, { status: 500 })
    }

    return NextResponse.json({ path })
  } catch (err: any) {
    console.error('Erro no upload administrativo:', err?.message || err)
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
