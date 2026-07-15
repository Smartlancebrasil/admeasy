#!/usr/bin/env node
// ============================================================
// Seed de dados fictícios mínimos — SOMENTE para o projeto de
// homologação (admeasy-homologacao). NÃO EXECUTADO NESTA SESSÃO.
// ============================================================
//
// Cria o menor conjunto de dados realistas pra testar o fluxo completo
// de demandas/RLS/locador/locatário: 1 organização, 1 usuário interno,
// 1 locador, 1 locatário, 1 imóvel, 1 contrato ativo, 1 cobrança, 1
// demanda. Ver docs/HOMOLOGATION_ENVIRONMENT_SETUP.md para o plano
// completo (schema-base, ordem de migrations, etc.).
//
// ⚠️ LIMITAÇÃO CONHECIDA: as colunas usadas abaixo foram levantadas
// lendo o código da aplicação (app/api/cadastro/route.ts,
// app/api/portal/gerenciar-acesso/route.ts e as migrations desta
// revisão) — não a partir de uma introspecção ao vivo do schema. É
// bem possível que alguma coluna NOT NULL (ex.: organizations.plano_id,
// que o fluxo real de cadastro sempre preenche) precise de ajuste
// antes deste script rodar sem erro. Revisar contra o schema real de
// homologação antes de usar — é um ponto de partida, não um script
// pronto e validado.
//
// SEGURANÇA — leia antes de rodar:
//   - Só lê env de admeasy/.env.homolog.local (nunca .env.local) —
//     evita pegar credencial de produção por um nome de arquivo errado.
//   - Por padrão roda em modo DRY-RUN (só imprime o que faria). Só
//     grava com a flag --confirmo-homologacao.
//   - Imprime o host da URL alvo (nunca as chaves) pra você confirmar
//     visualmente que é mesmo o projeto de homologação antes de
//     continuar.
//   - BLOQUEIA (mesmo em dry-run) se o host alvo bater com o project
//     ref de produção documentado em DEPLOY.md — lido em tempo de
//     execução daquele arquivo, nunca copiado/hardcoded aqui, pra não
//     duplicar o dado em mais um lugar do repositório.
//   - Cria os 3 usuários de teste via Auth Admin API (mesmo padrão já
//     usado em app/api/cadastro/route.ts e
//     app/api/portal/gerenciar-acesso/route.ts) — nunca insere direto
//     em auth.users.
//   - Nenhum segredo embutido no código — as duas chaves e a URL só
//     existem em .env.homolog.local (gitignored), nunca neste arquivo.
//   - Nenhum dado real de cliente — todos os registros criados são
//     fictícios, com nomes/e-mails marcados ("Teste",
//     "*.homolog@teste.local").
//
// Uso:
//   node scripts/seed-homologacao.mjs                        (dry-run)
//   node scripts/seed-homologacao.mjs --confirmo-homologacao  (grava)

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENV_FILE = join(__dirname, '..', '.env.homolog.local')
const DEPLOY_MD = join(__dirname, '..', 'DEPLOY.md')

function carregarEnvHomolog() {
  if (!existsSync(ENV_FILE)) {
    console.error(`Arquivo não encontrado: ${ENV_FILE}`)
    console.error('Copie .env.homolog.local.example para .env.homolog.local e preencha com os valores de homologação (nunca os de produção).')
    process.exit(1)
  }
  for (const linha of readFileSync(ENV_FILE, 'utf-8').split('\n')) {
    const l = linha.trim()
    if (!l || l.startsWith('#')) continue
    const idx = l.indexOf('=')
    if (idx === -1) continue
    const chave = l.slice(0, idx).trim()
    const valor = l.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    process.env[chave] = valor
  }
}
carregarEnvHomolog()

// Lê o host de produção já documentado em DEPLOY.md (não duplica o
// valor aqui — só extrai em tempo de execução, pra continuar
// funcionando mesmo se a URL de produção mudar um dia). Retorna null
// se DEPLOY.md não existir ou não tiver o formato esperado — nesse
// caso o script segue (não é o único controle de segurança).
function hostDeProducaoDocumentado() {
  if (!existsSync(DEPLOY_MD)) return null
  const conteudo = readFileSync(DEPLOY_MD, 'utf-8')
  const match = conteudo.match(/NEXT_PUBLIC_SUPABASE_URL[^\n]*`(https?:\/\/[a-zA-Z0-9.-]+)`/)
  if (!match) return null
  try {
    return new URL(match[1]).host
  } catch {
    return null
  }
}

const CONFIRMADO = process.argv.includes('--confirmo-homologacao')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !chaveServico) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY em .env.homolog.local')
  process.exit(1)
}

const host = new URL(url).host

// Bloqueio ativo: nunca deixa rodar (nem em dry-run) contra o host
// documentado como produção.
const hostProducao = hostDeProducaoDocumentado()
if (hostProducao && host === hostProducao) {
  console.error(`\n🔴 BLOQUEADO: o host de .env.homolog.local (${host}) é igual ao`)
  console.error('project ref de produção documentado em DEPLOY.md. Este script só')
  console.error('pode rodar contra o projeto de homologação. Confira o conteúdo de')
  console.error('.env.homolog.local antes de tentar de novo.')
  process.exit(1)
}

console.log(`Projeto alvo (confira visualmente antes de continuar): ${host}`)
console.log(CONFIRMADO ? '=== MODO GRAVAÇÃO (--confirmo-homologacao) ===' : '=== MODO DRY-RUN (nada será gravado) ===')

const supabaseAdmin = createClient(url, chaveServico, { auth: { autoRefreshToken: false, persistSession: false } })

// Dados fictícios fixos — nomes/e-mails fáceis de reconhecer e de
// limpar depois (tudo com sufixo ".homolog@teste.local" / "Teste").
const DADOS = {
  organizacao: { nome: 'Imobiliária Teste Homologação' },
  staff: { email: 'staff.homolog@teste.local', senha: 'TesteHomolog123!', nome: 'Staff Teste' },
  locador: { email: 'locador.homolog@teste.local', senha: 'TesteHomolog123!', nome: 'Locador Teste', cpf: '00000000000' },
  locatario: { email: 'locatario.homolog@teste.local', senha: 'TesteHomolog123!', nome: 'Locatário Teste', cpf: '11111111111' },
  imovel: { endereco: 'Rua Fictícia', numero: '100', bairro: 'Bairro Teste', cidade: 'Cidade Teste', estado: 'SP' },
}

async function main() {
  console.log('\nPlano de criação (8 passos):')
  console.log('1. organizations — 1 linha')
  console.log('2. auth.users + public.users — 1 staff (via Admin API)')
  console.log('3. auth.users + public.clientes (tipo=locador) — 1 locador (via Admin API)')
  console.log('4. auth.users + public.clientes (tipo=locatario) — 1 locatário (via Admin API)')
  console.log('5. imoveis — 1 linha (proprietario_id = locador)')
  console.log('6. contratos — 1 linha (status ativo, locador/locatário/imóvel acima)')
  console.log('7. cobrancas — 1 linha (vinculada ao contrato)')
  console.log('8. demandas — 1 linha (status aberta, vinculada ao contrato/locatário/locador)')

  if (!CONFIRMADO) {
    console.log('\nDry-run — nada foi gravado. Rode com --confirmo-homologacao para criar de verdade.')
    return
  }

  // 1) Organização
  // ⚠️ organizations.plano_id pode ser NOT NULL (o fluxo real de
  // cadastro sempre preenche) — se der erro de constraint, rodar antes
  // "select id from planos limit 1" e incluir aqui.
  const { data: org, error: erroOrg } = await supabaseAdmin
    .from('organizations')
    .insert({ nome: DADOS.organizacao.nome, status_assinatura: 'trial' })
    .select()
    .single()
  if (erroOrg) { console.error('Erro ao criar organização:', erroOrg.message); process.exit(1) }
  console.log(`Organização criada: ${org.id}`)

  // 2) Staff
  const { data: authStaff, error: erroAuthStaff } = await supabaseAdmin.auth.admin.createUser({
    email: DADOS.staff.email, password: DADOS.staff.senha, email_confirm: true,
  })
  if (erroAuthStaff) { console.error('Erro ao criar auth do staff:', erroAuthStaff.message); process.exit(1) }
  await supabaseAdmin.from('users').insert({ id: authStaff.user.id, email: DADOS.staff.email, nome: DADOS.staff.nome, organization_id: org.id, perfil: 'admin' })
  await supabaseAdmin.from('usuarios_organizacao').insert({ user_id: authStaff.user.id, organization_id: org.id, papel: 'admin' })
  console.log(`Staff criado: ${DADOS.staff.email}`)

  // 3) Locador
  const { data: authLocador, error: erroAuthLocador } = await supabaseAdmin.auth.admin.createUser({
    email: DADOS.locador.email, password: DADOS.locador.senha, email_confirm: true,
  })
  if (erroAuthLocador) { console.error('Erro ao criar auth do locador:', erroAuthLocador.message); process.exit(1) }
  const { data: clienteLocador, error: erroClienteLocador } = await supabaseAdmin
    .from('clientes')
    .insert({ organization_id: org.id, nome: DADOS.locador.nome, cpf: DADOS.locador.cpf, tipo: 'locador', usuario_portal_id: authLocador.user.id, tem_portal: true, email: DADOS.locador.email })
    .select()
    .single()
  if (erroClienteLocador) { console.error('Erro ao criar cliente locador:', erroClienteLocador.message); process.exit(1) }
  console.log(`Locador criado: ${DADOS.locador.email}`)

  // 4) Locatário
  const { data: authLocatario, error: erroAuthLocatario } = await supabaseAdmin.auth.admin.createUser({
    email: DADOS.locatario.email, password: DADOS.locatario.senha, email_confirm: true,
  })
  if (erroAuthLocatario) { console.error('Erro ao criar auth do locatário:', erroAuthLocatario.message); process.exit(1) }
  const { data: clienteLocatario, error: erroClienteLocatario } = await supabaseAdmin
    .from('clientes')
    .insert({ organization_id: org.id, nome: DADOS.locatario.nome, cpf: DADOS.locatario.cpf, tipo: 'locatario', usuario_portal_id: authLocatario.user.id, tem_portal: true, email: DADOS.locatario.email })
    .select()
    .single()
  if (erroClienteLocatario) { console.error('Erro ao criar cliente locatário:', erroClienteLocatario.message); process.exit(1) }
  console.log(`Locatário criado: ${DADOS.locatario.email}`)

  // 5) Imóvel
  const { data: imovel, error: erroImovel } = await supabaseAdmin
    .from('imoveis')
    .insert({ organization_id: org.id, proprietario_id: clienteLocador.id, endereco: DADOS.imovel.endereco, numero: DADOS.imovel.numero, bairro: DADOS.imovel.bairro, cidade: DADOS.imovel.cidade, estado: DADOS.imovel.estado })
    .select()
    .single()
  if (erroImovel) { console.error('Erro ao criar imóvel:', erroImovel.message); process.exit(1) }
  console.log(`Imóvel criado: ${imovel.id}`)

  // 6) Contrato
  const { data: contrato, error: erroContrato } = await supabaseAdmin
    .from('contratos')
    .insert({
      organization_id: org.id, imovel_id: imovel.id, locador_id: clienteLocador.id, locatario_id: clienteLocatario.id,
      numero: 'HML-0001', status: 'ativo', valor_mensal: 1500, data_inicio: new Date().toISOString().split('T')[0],
    })
    .select()
    .single()
  if (erroContrato) { console.error('Erro ao criar contrato:', erroContrato.message); process.exit(1) }
  console.log(`Contrato criado: ${contrato.id}`)

  // 7) Cobrança
  const { data: cobranca, error: erroCobranca } = await supabaseAdmin
    .from('cobrancas')
    .insert({
      organization_id: org.id, contrato_id: contrato.id, locatario_id: clienteLocatario.id,
      valor_aluguel: 1500, valor_total: 1500, status_cobranca: 'pendente',
      data_vencimento: new Date().toISOString().split('T')[0], mes_referencia: new Date().toISOString().slice(0, 7),
    })
    .select()
    .single()
  if (erroCobranca) { console.error('Erro ao criar cobrança:', erroCobranca.message); process.exit(1) }
  console.log(`Cobrança criada: ${cobranca.id}`)

  // 8) Demanda — já com locador_id/organization_id preenchidos aqui
  // (service role bypassa a trigger/policy do portal, então não há
  // derivação automática — precisa vir certo já no insert).
  const { data: demanda, error: erroDemanda } = await supabaseAdmin
    .from('demandas')
    .insert({
      organization_id: org.id, contrato_id: contrato.id, locatario_id: clienteLocatario.id, locador_id: clienteLocador.id, imovel_id: imovel.id,
      titulo: 'Torneira com vazamento (dado fictício)', descricao: 'Demanda de teste criada pelo seed de homologação.',
      urgencia: 'media', origem: 'locatario', status: 'aberta', data_abertura: new Date().toISOString(),
    })
    .select()
    .single()
  if (erroDemanda) { console.error('Erro ao criar demanda:', erroDemanda.message); process.exit(1) }
  console.log(`Demanda criada: ${demanda.id}`)

  console.log('\nSeed concluído. Use as credenciais em DADOS (acima) para logar como cada perfil e testar.')
}

main()
