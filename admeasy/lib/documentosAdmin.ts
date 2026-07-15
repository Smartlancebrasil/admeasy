import { supabase } from '@/lib/supabase'

// ============================================================
// Helpers client-side para as rotas de upload/exclusão administrativa
// (staff) — app/api/documentos/upload e app/api/documentos/excluir. Ver
// docs/STORAGE_PRIVATE_MIGRATION_PROPOSAL.md, Seção 0.5.
//
// Substituem storage.from('documentos').upload()/remove() chamado
// direto do client nas telas de staff (Kit de documentos, Análise
// Locatários, Nova Vistoria) — as rotas validam a organização dona do
// registro (contrato/análise) antes de gravar/apagar, em vez de
// depender só de policy de Storage.
//
// Não cobre o prefixo "chamados/" (anexo de demanda pelo locatário) —
// esse fluxo continua fazendo upload direto do client, coberto pela
// policy documentos_upload_locatario_chamado.
// ============================================================

async function tokenAtual(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

export async function uploadDocumentoAdministrativo(params: {
  file: File
  prefixo: 'contratos' | 'analises' | 'vistorias' | 'logo'
  contratoId?: string
  categoria?: string
  analiseId?: string
}): Promise<{ path: string } | { erro: string }> {
  const token = await tokenAtual()
  if (!token) return { erro: 'Sessão expirada. Faça login novamente.' }

  const formData = new FormData()
  formData.append('file', params.file)
  formData.append('prefixo', params.prefixo)
  if (params.contratoId) formData.append('contratoId', params.contratoId)
  if (params.categoria) formData.append('categoria', params.categoria)
  if (params.analiseId) formData.append('analiseId', params.analiseId)

  try {
    const res = await fetch('/api/documentos/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    const json = await res.json()
    if (!res.ok) return { erro: json.erro || 'Erro ao enviar arquivo.' }
    return { path: json.path }
  } catch {
    return { erro: 'Erro de conexão ao enviar arquivo.' }
  }
}

export async function excluirDocumentoAdministrativo(path: string): Promise<{ ok: true } | { erro: string }> {
  const token = await tokenAtual()
  if (!token) return { erro: 'Sessão expirada. Faça login novamente.' }

  try {
    const res = await fetch('/api/documentos/excluir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ path }),
    })
    const json = await res.json()
    if (!res.ok) return { erro: json.erro || 'Erro ao excluir arquivo.' }
    return { ok: true }
  } catch {
    return { erro: 'Erro de conexão ao excluir arquivo.' }
  }
}
