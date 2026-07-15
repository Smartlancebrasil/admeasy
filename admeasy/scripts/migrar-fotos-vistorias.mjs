#!/usr/bin/env node
// ============================================================
// Migração de dados — vistorias.ambientes[].fotos[]: URL pública legada -> path
// PROPOSTA PARA REVISÃO. NÃO EXECUTADO. NÃO RODAR AINDA.
// ============================================================
//
// Mesmo problema de scripts/migrar-fotos-demandas.mjs, em outra coluna:
// até a correção em app/(interno)/vistorias/nova/page.tsx (adicionarFoto)
// e app/(interno)/vistorias/[id]/page.tsx (gerarPdf), a foto de cada
// ambiente de uma vistoria era gravada como URL pública inteira dentro
// de vistorias.ambientes (jsonb: array de {nome, estado, observacao,
// fotos: string[]}), em vez do path do objeto no Storage. Isso quebra
// permanentemente a galeria em tela E a geração de PDF do laudo assim
// que o bucket "documentos" virar privado.
//
// Este script varre "vistorias", entra em cada ambiente de
// "ambientes" (jsonb), identifica quais entradas de "fotos" ainda são
// URL pública legada, extrai o path de dentro dela e prepara (não
// aplica, a menos que rodado com --apply) a atualização da coluna
// "ambientes" inteira (não há uma coluna separada por foto — é tudo
// jsonb aninhado). Qualquer valor que não seja reconhecível como URL
// do bucket "documentos" é preservado exatamente como está — nunca
// descartado — e entra no relatório de não convertíveis.
//
// Uso:
//   node scripts/migrar-fotos-vistorias.mjs            (dry-run — só relatório, nada é gravado)
//   node scripts/migrar-fotos-vistorias.mjs --apply     (grava as conversões no banco)
//
// Pré-requisitos no ambiente (lidos de admeasy/.env.local se existir e
// as variáveis ainda não estiverem no processo): NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY. Usa service role — bypassa RLS deliberadamente,
// é um script de manutenção de dados, não uma chamada de usuário final.
//
// Pré-requisito de produto: só faz sentido rodar isto DEPOIS que o
// código novo (que já grava path em vez de URL) estiver em produção há
// tempo suficiente — senão vistorias novas continuam sendo criadas com
// URL legada enquanto o script já rodou uma vez.
// ============================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function carregarEnvLocal() {
  const envPath = join(__dirname, '..', '.env.local')
  if (!existsSync(envPath)) return
  for (const linha of readFileSync(envPath, 'utf-8').split('\n')) {
    const l = linha.trim()
    if (!l || l.startsWith('#')) continue
    const idx = l.indexOf('=')
    if (idx === -1) continue
    const chave = l.slice(0, idx).trim()
    const valor = l.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    if (!(chave in process.env)) process.env[chave] = valor
  }
}
carregarEnvLocal()

const APLICAR = process.argv.includes('--apply')
const MARCADOR_PUBLICO = '/storage/v1/object/public/documentos/'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !chaveServico) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no ambiente ou em admeasy/.env.local')
  process.exit(1)
}
const supabaseAdmin = createClient(url, chaveServico, { auth: { autoRefreshToken: false, persistSession: false } })

// Mesma lógica de scripts/migrar-fotos-demandas.mjs — duplicada de
// propósito (script standalone, roda com "node" puro, sem loader de
// TypeScript pra importar lib/storagePath.ts).
function extrairPath(valor) {
  if (typeof valor !== 'string') return { convertivel: false, motivo: `tipo inesperado: ${typeof valor}` }
  if (!valor.startsWith('http://') && !valor.startsWith('https://')) return null
  const idx = valor.indexOf(MARCADOR_PUBLICO)
  if (idx === -1) return { convertivel: false, motivo: 'URL não reconhecida como pública do bucket documentos' }
  const bruto = valor.slice(idx + MARCADOR_PUBLICO.length).split('?')[0]
  if (!bruto) return { convertivel: false, motivo: 'path vazio após o marcador' }
  try {
    const path = decodeURIComponent(bruto)
    if (path.includes('..')) return { convertivel: false, motivo: 'path decodificado contém ".." — descartado por segurança' }
    return { convertivel: true, path }
  } catch {
    return { convertivel: false, motivo: 'falha ao decodificar URI' }
  }
}

async function main() {
  console.log(APLICAR ? '=== MODO APLICAR (grava no banco) ===' : '=== MODO DRY-RUN (só relatório, nada é gravado) ===')

  const { data: linhas, error } = await supabaseAdmin
    .from('vistorias')
    .select('id, organization_id, codigo, ambientes')
    .not('ambientes', 'is', null)

  if (error) {
    console.error('Erro ao consultar vistorias:', error.message)
    process.exit(1)
  }

  let totalEntradas = 0
  let jaEramPath = 0
  let convertidas = 0
  const naoConvertiveis = []
  const atualizacoes = []

  for (const linha of linhas || []) {
    const ambientes = Array.isArray(linha.ambientes) ? linha.ambientes : []
    if (ambientes.length === 0) continue

    let mudouAlgumAmbiente = false
    const novosAmbientes = ambientes.map((amb, ambIndice) => {
      const fotos = Array.isArray(amb?.fotos) ? amb.fotos : []
      if (fotos.length === 0) return amb

      let mudouEsteAmbiente = false
      const novasFotos = fotos.map((valor, fotoIndice) => {
        totalEntradas++
        const resultado = extrairPath(valor)
        if (resultado === null) { jaEramPath++; return valor }
        if (!resultado.convertivel) {
          naoConvertiveis.push({
            vistoria_id: linha.id,
            codigo: linha.codigo,
            ambiente_indice: ambIndice,
            ambiente_nome: amb?.nome,
            foto_indice: fotoIndice,
            valor_original: valor,
            motivo: resultado.motivo,
          })
          return valor // preserva o original — nunca descarta um valor que não conseguiu converter
        }
        convertidas++
        mudouEsteAmbiente = true
        return resultado.path
      })

      if (mudouEsteAmbiente) mudouAlgumAmbiente = true
      return mudouEsteAmbiente ? { ...amb, fotos: novasFotos } : amb
    })

    if (mudouAlgumAmbiente) {
      atualizacoes.push({ id: linha.id, codigo: linha.codigo, organization_id: linha.organization_id, ambientes: novosAmbientes })
    }
  }

  console.log(`Vistorias com ambientes não nulo: ${linhas?.length || 0}`)
  console.log(`Total de entradas em fotos[] (todos os ambientes somados): ${totalEntradas}`)
  console.log(`Já eram path (sem alteração): ${jaEramPath}`)
  console.log(`Convertidas com sucesso: ${convertidas}`)
  console.log(`Não convertíveis (valor original preservado, entram no relatório): ${naoConvertiveis.length}`)
  console.log(`Vistorias que seriam atualizadas: ${atualizacoes.length}`)

  if (naoConvertiveis.length > 0) {
    const relatorioPath = join(__dirname, `relatorio-migracao-fotos-vistorias-${Date.now()}.json`)
    writeFileSync(relatorioPath, JSON.stringify(naoConvertiveis, null, 2), 'utf-8')
    console.log(`\nRelatório de registros não convertíveis salvo em: ${relatorioPath}`)
    console.log('Essas entradas continuarão como URL pública — precisam de revisão manual')
    console.log('(provavelmente vão parar de aparecer na galeria e no PDF quando o bucket virar privado).')
  }

  if (!APLICAR) {
    console.log('\nDry-run — nada foi gravado no banco. Rode com --apply para persistir as conversões.')
    return
  }

  console.log(`\nGravando ${atualizacoes.length} vistorias...`)
  let ok = 0
  let falhas = 0
  for (const item of atualizacoes) {
    const { error: erroUpdate } = await supabaseAdmin.from('vistorias').update({ ambientes: item.ambientes }).eq('id', item.id)
    if (erroUpdate) {
      falhas++
      console.error(`Falha ao atualizar vistoria ${item.codigo || item.id}: ${erroUpdate.message}`)
    } else {
      ok++
    }
  }
  console.log(`Concluído: ${ok} atualizadas, ${falhas} falharam.`)
}

main()
