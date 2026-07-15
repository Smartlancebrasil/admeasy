import { supabase } from '@/lib/supabase'
import { ehUrlPublicaLegada } from '@/lib/storagePath'

// ============================================================
// PROPOSTA — não commitada, não usada em nenhuma tela ainda.
// Ver docs/STORAGE_PRIVATE_MIGRATION_PROPOSAL.md.
//
// Helper único para resolver um valor salvo em colunas tipo
// "fotos"/"documentos" (ex.: demandas.fotos) para uma URL exibível,
// suportando os dois formatos que convivem no banco:
//   - novo: só o path do objeto no bucket ("chamados/{org}/{arquivo}")
//   - legado: a URL pública inteira já persistida antes desta correção
//     ("https://.../storage/v1/object/public/documentos/...")
// Nunca persista o retorno desta função — a URL assinada expira em
// poucos minutos, só serve para exibição imediata.
// ============================================================

export { ehUrlPublicaLegada, extrairPathDeUrlPublica } from '@/lib/storagePath'

// Resolve um valor de "fotos"/"documentos" (path novo ou URL legada) para
// algo que dá pra colocar direto num <img src> ou <a href>. Retorna null
// se não foi possível (sessão expirada, sem permissão, arquivo removido).
export async function resolverUrlExibicao(valor: string): Promise<string | null> {
  if (!valor) return null

  // Legado: enquanto o bucket ainda for público, a própria URL já funciona
  // sem round-trip nenhum. Depois que o bucket virar privado, isso passa a
  // retornar 403 do próprio Storage — o chamador deve tratar como imagem
  // indisponível, não é responsabilidade deste helper decidir isso.
  if (ehUrlPublicaLegada(valor)) return valor

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return null

  try {
    const res = await fetch('/api/documentos/url-assinada', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ path: valor }),
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.url || null
  } catch {
    return null
  }
}
