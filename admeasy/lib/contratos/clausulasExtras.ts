// ============================================================
// Cláusulas adicionais digitadas pelo analista, específicas de cada
// contrato ("cada contrato é um contrato"). Sempre anexadas ao FINAL
// da sequência fixa de cláusulas do documento (depois da 31ª, antes de
// "DAS OBSERVAÇÕES"), numeradas sequencialmente a partir da 32ª —
// nunca inseridas em outra posição, pra nunca invalidar referências
// cruzadas já existentes no texto fixo (ex.: a cláusula 2ª cita
// literalmente "a CLÁUSULA 1ª").
//
// Mesmas funções usadas tanto pela numeração exibida ao vivo no
// formulário quanto pela geração do PDF — nunca duas lógicas
// divergentes pro mesmo resultado.
// ============================================================

export type ClausulaExtra = { numero: string; texto: string }

const NUMERO_INICIAL = 32

// Remove entradas vazias/só-espaço e numera sequencialmente a partir
// de NUMERO_INICIAL. Entradas em branco nunca consomem um número —
// só o que efetivamente tem texto vira cláusula.
export function prepararClausulasExtras(brutas: (string | null | undefined)[]): ClausulaExtra[] {
  return brutas
    .map(t => (t || '').trim())
    .filter(Boolean)
    .map((texto, i) => ({ numero: `${NUMERO_INICIAL + i}ª`, texto }))
}

// Número que uma entrada específica (pelo índice na lista bruta, ainda
// não filtrada) vai assumir — ou null se estiver em branco no momento
// (nesse caso ela não consome nenhum número). Usado pra mostrar o
// rótulo "CLÁUSULA Nª" ao vivo acima de cada campo de texto, mesmo com
// campos em branco intercalados enquanto o analista ainda está
// preenchendo.
export function numeroParaIndice(brutas: (string | null | undefined)[], indice: number): string | null {
  const texto = (brutas[indice] || '').trim()
  if (!texto) return null
  const preparadasAteAqui = prepararClausulasExtras(brutas.slice(0, indice + 1))
  return preparadasAteAqui[preparadasAteAqui.length - 1]?.numero ?? null
}

// Parse seguro do JSON guardado no estado do formulário (form é
// Record<string,string> em todo o projeto) — nunca lança exceção,
// sempre devolve um array de strings.
export function lerClausulasExtras(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const valor = JSON.parse(json)
    if (!Array.isArray(valor)) return []
    return valor.filter((v): v is string => typeof v === 'string')
  } catch {
    return []
  }
}
