import { supabase } from './supabase'

// Registros novos guardam só o caminho do arquivo no bucket `documentos` e a
// URL assinada (expira em 1h) é gerada aqui, na hora de exibir. Registros
// antigos ainda guardam a URL pública completa — nesse caso é só devolvida
// como está, sem quebrar o que já foi salvo antes dessa mudança.
export async function resolverUrlFoto(pathOuUrl: string): Promise<string> {
  if (!pathOuUrl) return ''
  if (pathOuUrl.startsWith('http')) return pathOuUrl
  const { data } = await supabase.storage.from('documentos').createSignedUrl(pathOuUrl, 3600)
  return data?.signedUrl || ''
}
