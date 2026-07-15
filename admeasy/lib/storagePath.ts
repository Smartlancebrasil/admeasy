// Funções puras (sem cliente Supabase, sem "use client") para lidar com
// paths do bucket "documentos" e com o formato legado de URL pública que
// alguns registros antigos ainda guardam. Importável tanto de código de
// cliente (lib/documentosSignedUrl.ts) quanto de rotas server-side
// (app/api/documentos/url-assinada/route.ts) sem acoplar as duas pontas.

const MARCADOR_PUBLICO = '/storage/v1/object/public/documentos/'

export function ehUrlPublicaLegada(valor: string): boolean {
  return typeof valor === 'string' && (valor.startsWith('http://') || valor.startsWith('https://'))
}

// Extrai o path do bucket de dentro de uma URL pública legada. Retorna
// null quando o valor não é reconhecível como URL do bucket "documentos"
// — nesse caso o valor original deve ser preservado, nunca descartado.
export function extrairPathDeUrlPublica(url: string): string | null {
  const idx = url.indexOf(MARCADOR_PUBLICO)
  if (idx === -1) return null
  const bruto = url.slice(idx + MARCADOR_PUBLICO.length).split('?')[0]
  if (!bruto) return null
  try {
    return decodeURIComponent(bruto)
  } catch {
    return null
  }
}

// Normaliza uma entrada de fotos[]/documentos[] (path novo ou URL legada)
// para o path puro, para fins de comparação — nunca para persistir.
export function normalizarParaPath(valor: string): string | null {
  if (!valor) return null
  if (!ehUrlPublicaLegada(valor)) return valor
  return extrairPathDeUrlPublica(valor)
}
