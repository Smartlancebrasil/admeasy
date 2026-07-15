#!/usr/bin/env node
// ============================================================
// Migração de dados — demandas.fotos: URL pública legada -> path
// PROPOSTA PARA REVISÃO. NÃO EXECUTADO. NÃO RODAR AINDA.
// ============================================================
//
// Contexto: até a correção em app/portal/page.tsx (FormularioDemanda),
// demandas.fotos guardava a URL pública inteira do Storage
// (".../storage/v1/object/public/documentos/chamados/...") em vez do
// path do objeto. Isso quebra permanentemente assim que o bucket
// "documentos" virar privado (migration 20260714030000) — a URL salva
// não resolve mais nada, mesmo com a rota de signed URL no ar, porque
// o valor salvo não é reconhecido como path.
//
// Este script varre "demandas", identifica quais entradas de "fotos"
// ainda são URL pública legada, extrai o path de dentro dela e prepara
// (não aplica, a menos que rodado com --apply) a atualização. Qualquer
// valor que não seja reconhecível como URL do bucket "documentos" é
// preservado exatamente como está — nunca descartado — e entra no
// relatório de não convertíveis.
//
// Uso:
//   node scripts/migrar-fotos-demandas.mjs            (dry-run — só relatório, nada é gravado)
//   node scripts/migrar-fotos-demandas.mjs --apply     (grava as conversões no banco)
//
// Pré-requisitos no ambiente (lidos de admeasy/.env.local se existir e
// as variáveis ainda não estiverem no processo): NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY. Usa service role — bypassa RLS deliberadamente,
// é um script de manutenção de dados, não uma chamada de usuário final.
//
// Pré-requisito de produto: só faz sentido rodar isto DEPOIS que o
// código novo (que já grava path em vez de URL) estiver em produção há
// tempo suficiente — senão demandas novas continuam sendo criadas com
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

// Retorna:
//   null                                    -> não é URL (já é path, não precisa mexer)
//   { convertivel: true,  path }            -> URL pública reconhecida, path extraído
//   { convertivel: false, motivo }          -> parece URL mas não deu pra extrair com segurança
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
    .from('demandas')
    .select('id, organization_id, numero, fotos')
    .not('fotos', 'is', null)

  if (error) {
    console.error('Erro ao consultar demandas:', error.message)
    process.exit(1)
  }

  let totalEntradas = 0
  let jaEramPath = 0
  let convertidas = 0
  const naoConvertiveis = []
  const atualizacoes = []

  for (const linha of linhas || []) {
    const fotos = Array.isArray(linha.fotos) ? linha.fotos : []
    if (fotos.length === 0) continue

    let mudou = false
    const novasFotos = fotos.map((valor, indice) => {
      totalEntradas++
      const resultado = extrairPath(valor)
      if (resultado === null) { jaEramPath++; return valor }
      if (!resultado.convertivel) {
        naoConvertiveis.push({ demanda_id: linha.id, numero: linha.numero, indice, valor_original: valor, motivo: resultado.motivo })
        return valor // preserva o original — nunca descarta um valor que não conseguiu converter
      }
      convertidas++
      mudou = true
      return resultado.path
    })

    if (mudou) atualizacoes.push({ id: linha.id, numero: linha.numero, organization_id: linha.organization_id, fotos: novasFotos })
  }

  console.log(`Demandas com fotos não nulo: ${linhas?.length || 0}`)
  console.log(`Total de entradas em fotos[]: ${totalEntradas}`)
  console.log(`Já eram path (sem alteração): ${jaEramPath}`)
  console.log(`Convertidas com sucesso: ${convertidas}`)
  console.log(`Não convertíveis (valor original preservado, entram no relatório): ${naoConvertiveis.length}`)
  console.log(`Demandas que seriam atualizadas: ${atualizacoes.length}`)

  if (naoConvertiveis.length > 0) {
    const relatorioPath = join(__dirname, `relatorio-migracao-fotos-demandas-${Date.now()}.json`)
    writeFileSync(relatorioPath, JSON.stringify(naoConvertiveis, null, 2), 'utf-8')
    console.log(`\nRelatório de registros não convertíveis salvo em: ${relatorioPath}`)
    console.log('Essas entradas continuarão como URL pública — precisam de revisão manual')
    console.log('(provavelmente vão parar de funcionar quando o bucket virar privado).')
  }

  if (!APLICAR) {
    console.log('\nDry-run — nada foi gravado no banco. Rode com --apply para persistir as conversões.')
    return
  }

  console.log(`\nGravando ${atualizacoes.length} demandas...`)
  let ok = 0
  let falhas = 0
  for (const item of atualizacoes) {
    const { error: erroUpdate } = await supabaseAdmin.from('demandas').update({ fotos: item.fotos }).eq('id', item.id)
    if (erroUpdate) {
      falhas++
      console.error(`Falha ao atualizar demanda ${item.numero || item.id}: ${erroUpdate.message}`)
    } else {
      ok++
    }
  }
  console.log(`Concluído: ${ok} atualizadas, ${falhas} falharam.`)
}

main()
