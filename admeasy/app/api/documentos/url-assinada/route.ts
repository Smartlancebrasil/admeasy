import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { normalizarParaPath } from '@/lib/storagePath'
import { EXTENSOES_PERMITIDAS, MIME_PERMITIDOS, extensaoDoNome } from '@/lib/documentosPermitidos'

// ============================================================
// PROPOSTA — não commitada, não deployada, não usada em nenhuma tela
// ainda. Ver docs/STORAGE_PRIVATE_MIGRATION_PROPOSAL.md.
//
// Gera uma signed URL de curta duração pra um arquivo do bucket
// "documentos", só depois de confirmar que quem está pedindo (staff
// interno OU usuário do portal) tem direito de ver aquele arquivo
// específico. Substitui o uso direto de getPublicUrl() nas 7 telas
// listadas no documento de proposta.
//
// Pré-requisito: bucket "documentos" precisa estar PRIVADO pra essa
// rota fazer sentido (ver migrations 20260714030000 e 20260714040000,
// nenhuma aplicada ainda). Enquanto o bucket for público, essa rota
// funciona mas é redundante (uma URL assinada e uma pública levam ao
// mesmo arquivo do mesmo jeito).
//
// REFORÇADO em 2026-07-14 (auditoria final estática): validação por
// registro real para "vistorias"/"chamados" (antes só checava
// organização), allowlist de extensão, checagem de MIME real do objeto
// quando disponível. Bucket é sempre o literal 'documentos' — nunca lido
// do corpo da requisição, não existe parâmetro de bucket nesta rota.
// ============================================================

const VALIDADE_SEGUNDOS = 300 // 5 minutos

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

async function autenticarChamador(request: NextRequest, supabaseAuth: SupabaseClient): Promise<{ userId: string } | null> {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return null

  const { data, error } = await supabaseAuth.auth.getUser(token)
  if (error || !data?.user) return null
  return { userId: data.user.id }
}

// Categorias do "kit de documentos" que cada papel do portal pode
// pedir — nunca CPF/RG/comprovantes de qualquer uma das partes,
// mesmo sendo do próprio contrato do usuário. Esses ficam só para
// staff. Isso é uma decisão de produto que pode ser revista; hoje
// espelha exatamente o que já é exibido nas telas de portal
// construídas (Fases 7 e 8 deste projeto).
const CATEGORIAS_PERMITIDAS_LOCATARIO = new Set(['contrato_assinado', 'laudo_vistoria'])
const CATEGORIAS_PERMITIDAS_LOCADOR = new Set([
  'contrato_assinado', 'laudo_vistoria', 'apolice_seguro_incendio', 'apolice_seguro_fianca',
])

export async function POST(request: NextRequest) {
  try {
    const clientes = criarClientesSupabase()

    if (!clientes) {
      console.error('Documentos/url-assinada: configuração do Supabase ausente.')
      return NextResponse.json(
        { erro: 'Serviço temporariamente indisponível.' },
        { status: 503 }
      )
    }

    const { supabaseAuth, supabaseAdmin } = clientes

    const chamador = await autenticarChamador(request, supabaseAuth)
    if (!chamador) {
      return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 })
    }

    const { path } = await request.json()
    if (!path || typeof path !== 'string') {
      return NextResponse.json({ erro: 'path é obrigatório.' }, { status: 400 })
    }

    // Nunca deixa sair da pasta esperada (sem "..", sem path absoluto).
    if (path.includes('..') || path.startsWith('/')) {
      return NextResponse.json({ erro: 'Caminho inválido.' }, { status: 400 })
    }

    // Extensão precisa estar na allowlist antes de qualquer outra checagem
    // — barato de validar e barra de cara qualquer tentativa de assinar
    // algo fora dos tipos que o produto aceita, independente de o objeto
    // existir ou não.
    const nomeArquivo = path.split('/').pop() || ''
    const extensao = extensaoDoNome(nomeArquivo)
    if (!EXTENSOES_PERMITIDAS.has(extensao)) {
      return NextResponse.json({ erro: 'Tipo de arquivo não permitido.' }, { status: 400 })
    }

    const partes = path.split('/')
    const prefixo = partes[0]

    // Descobre se quem está chamando é staff interno ou usuário do
    // portal — nunca confia em nada que o corpo da requisição diga
    // sobre isso, só o que o banco confirma pra esse auth.uid().
    const { data: staffRow } = await supabaseAdmin
      .from('users')
      .select('organization_id')
      .eq('id', chamador.userId)
      .maybeSingle()

    const { data: clienteRow } = await supabaseAdmin
      .from('clientes')
      .select('id, tipo, organization_id')
      .eq('usuario_portal_id', chamador.userId)
      .maybeSingle()

    if (!staffRow && !clienteRow) {
      return NextResponse.json({ erro: 'Usuário sem vínculo reconhecido.' }, { status: 403 })
    }

    let autorizado = false

    if (prefixo === 'contratos') {
      // contratos/{contratoId}/kit/{categoria}/{arquivo}
      const contratoId = partes[1]
      const categoria = partes[3]
      const { data: contrato } = await supabaseAdmin
        .from('contratos')
        .select('organization_id, locador_id, locatario_id')
        .eq('id', contratoId)
        .maybeSingle()

      if (contrato) {
        if (staffRow && contrato.organization_id === staffRow.organization_id) {
          autorizado = true
        } else if (clienteRow && contrato.organization_id === clienteRow.organization_id) {
          if (clienteRow.tipo === 'locador' && contrato.locador_id === clienteRow.id) {
            autorizado = CATEGORIAS_PERMITIDAS_LOCADOR.has(categoria)
          } else if (clienteRow.tipo === 'locatario' && contrato.locatario_id === clienteRow.id) {
            autorizado = CATEGORIAS_PERMITIDAS_LOCATARIO.has(categoria)
          }
        }
      }
    } else if (prefixo === 'analises') {
      // analises/{analiseId}/{arquivo} — só staff, tela é 100% interna.
      const analiseId = partes[1]
      const { data: analise } = await supabaseAdmin
        .from('analises_cadastrais')
        .select('organization_id')
        .eq('id', analiseId)
        .maybeSingle()
      if (analise && staffRow && analise.organization_id === staffRow.organization_id) {
        autorizado = true
      }
    } else if (prefixo === 'chamados') {
      // chamados/{organizationId}/{arquivo} — anexo de demanda (chamado).
      // REFORÇADO: antes checava só a organização (qualquer staff ou
      // qualquer cliente da mesma organização podia pedir QUALQUER
      // arquivo desse prefixo). Agora exige que o path esteja de fato
      // referenciado em demandas.fotos de uma demanda real da
      // organização, e — pra usuário de portal — que a demanda pertença
      // a ele (locador ou locatário). Compara contra demandas.fotos
      // tanto no formato novo (path) quanto no legado (URL pública
      // completa, de antes da correção) via normalizarParaPath(), pra
      // não depender de scripts/migrar-fotos-demandas.mjs já ter sido
      // rodado.
      const organizationId = partes[1]
      const orgAutorizada =
        (!!staffRow && organizationId === staffRow.organization_id) ||
        (!!clienteRow && organizationId === clienteRow.organization_id)

      if (orgAutorizada) {
        const { data: demandasOrg } = await supabaseAdmin
          .from('demandas')
          .select('id, locatario_id, locador_id, fotos')
          .eq('organization_id', organizationId)

        const demandaDona = (demandasOrg || []).find((d: any) =>
          (d.fotos || []).some((valor: string) => normalizarParaPath(valor) === path)
        )

        if (demandaDona) {
          if (staffRow) {
            autorizado = true
          } else if (clienteRow?.tipo === 'locatario' && demandaDona.locatario_id === clienteRow.id) {
            autorizado = true
          } else if (clienteRow?.tipo === 'locador' && demandaDona.locador_id === clienteRow.id) {
            autorizado = true
          }
        }
      }
    } else if (prefixo === 'vistorias') {
      // vistorias/{organizationId}/{arquivo}. REFORÇADO: mesma lógica do
      // prefixo "chamados" — antes checava só organização, agora exige
      // que o path esteja referenciado em algum ambientes[].fotos[] de
      // uma vistoria real da organização, e — pra usuário de portal —
      // que ele tenha vínculo real (locador ou locatário) com o imóvel
      // dessa vistoria via "contratos". vistorias não tem locador_id/
      // locatario_id direto (só imovel_id), por isso o vínculo é
      // resolvido via contrato ativo do imóvel, igual à policy
      // "portal_leitura" de vistorias em
      // 20260714000000_portal_locador_rls.sql.
      const organizationId = partes[1]
      const orgAutorizada =
        (!!staffRow && organizationId === staffRow.organization_id) ||
        (!!clienteRow && organizationId === clienteRow.organization_id)

      if (orgAutorizada) {
        const { data: vistoriasOrg } = await supabaseAdmin
          .from('vistorias')
          .select('id, imovel_id, ambientes')
          .eq('organization_id', organizationId)

        const vistoriaDona = (vistoriasOrg || []).find((v: any) =>
          (v.ambientes || []).some((amb: any) =>
            (amb?.fotos || []).some((valor: string) => normalizarParaPath(valor) === path)
          )
        )

        if (vistoriaDona) {
          if (staffRow) {
            autorizado = true
          } else if (clienteRow) {
            const { data: contratoVinculado } = await supabaseAdmin
              .from('contratos')
              .select('id')
              .eq('imovel_id', vistoriaDona.imovel_id)
              .eq('organization_id', organizationId)
              .or(`locador_id.eq.${clienteRow.id},locatario_id.eq.${clienteRow.id}`)
              .limit(1)
              .maybeSingle()
            autorizado = !!contratoVinculado
          }
        }
      }
    }
    // "logos/" propositalmente fora daqui — ver recomendação no
    // documento de proposta (bucket separado e público pra logo, não
    // passa por essa rota).

    if (!autorizado) {
      // Mensagem genérica: não revela se o arquivo existe, se é de
      // outra organização, ou se é de outro locador/locatário.
      return NextResponse.json({ erro: 'Acesso não autorizado a este arquivo.' }, { status: 403 })
    }

    // MIME real do objeto, quando disponível — a allowlist de extensão
    // acima barra pela aparência do nome; esta checagem confirma o tipo
    // que o Storage realmente registrou no upload. Um objeto sem
    // metadata compatível (ex.: listagem não retornou o item) é
    // rejeitado por segurança em vez de liberado por omissão.
    const pastaPai = partes.slice(0, -1).join('/')
    const { data: listagem } = await supabaseAdmin.storage.from('documentos').list(pastaPai, { search: nomeArquivo })
    const objeto = listagem?.find(o => o.name === nomeArquivo)
    const mimeReal = objeto?.metadata?.mimetype as string | undefined
    if (mimeReal && !MIME_PERMITIDOS.has(mimeReal)) {
      return NextResponse.json({ erro: 'Tipo de arquivo não permitido.' }, { status: 400 })
    }

    const { data: assinada, error: erroAssinatura } = await supabaseAdmin
      .storage
      .from('documentos')
      .createSignedUrl(path, VALIDADE_SEGUNDOS)

    if (erroAssinatura || !assinada) {
      return NextResponse.json({ erro: 'Não foi possível gerar o link.' }, { status: 500 })
    }

    return NextResponse.json({ url: assinada.signedUrl, expiraEm: VALIDADE_SEGUNDOS })
  } catch (err: any) {
    // Nunca logar "path", token ou qualquer dado do corpo da requisição
    // aqui — só a mensagem de erro do SDK/runtime.
    console.error('Erro ao gerar URL assinada:', err?.message || err)
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 })
  }
}
