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
//   - NENHUMA senha fica escrita no código deste script. As 3 senhas de
//     teste vêm exclusivamente de HOMOLOG_STAFF_PASSWORD /
//     HOMOLOG_LOCADOR_PASSWORD / HOMOLOG_LOCATARIO_PASSWORD, lidas de
//     .env.homolog.local — o script aborta se qualquer uma estiver vazia.
//   - EXPECTED_HOMOLOG_PROJECT_REF (também só em .env.homolog.local) é
//     obrigatório e precisa bater EXATAMENTE com o project ref extraído
//     de NEXT_PUBLIC_SUPABASE_URL — aborta se estiver vazio ou se não
//     bater. Isso é a checagem principal de "estou no projeto certo";
//     imprimir o host sozinho (como antes) dependia de conferência
//     visual manual, esta é uma trava automática.
//   - BLOQUEIA (mesmo em dry-run) se o host alvo bater com o project
//     ref de produção documentado em DEPLOY.md — lido em tempo de
//     execução daquele arquivo, nunca copiado/hardcoded aqui, pra não
//     duplicar o dado em mais um lugar do repositório. Mantido como
//     camada adicional, independente da checagem de
//     EXPECTED_HOMOLOG_PROJECT_REF acima.
//   - Cria os 3 usuários de teste via Auth Admin API (mesmo padrão já
//     usado em app/api/cadastro/route.ts e
//     app/api/portal/gerenciar-acesso/route.ts) — nunca insere direto
//     em auth.users.
//   - Nenhum segredo embutido no código — as chaves, a URL, as 3 senhas
//     e o project ref esperado só existem em .env.homolog.local
//     (gitignored), nunca neste arquivo.
//   - Nenhum dado real de cliente — todos os registros criados são
//     fictícios, com nomes/e-mails marcados ("Teste",
//     "*.homolog@teste.local").
//
// Uso:
//   node scripts/seed-homologacao.mjs                                   (dry-run: cria)
//   node scripts/seed-homologacao.mjs --confirmo-homologacao             (grava: cria)
//   node scripts/seed-homologacao.mjs --rollback                         (dry-run: reverte)
//   node scripts/seed-homologacao.mjs --rollback --confirmo-homologacao  (grava: reverte)
//   node scripts/seed-homologacao.mjs --reset-senha-staff                                   (dry-run: só localiza)
//   node scripts/seed-homologacao.mjs --reset-senha-staff --confirmo-homologacao             (grava: redefine a senha)
//
// --reset-senha-staff: redefine SOMENTE a senha de auth.users do e-mail
// staff.homolog@teste.local, usando o valor atual de HOMOLOG_STAFF_PASSWORD
// em .env.homolog.local. Não recria nada, não roda rollback, não toca em
// organização/perfil/papel/outros usuários — usa as mesmas proteções de
// projeto (checagem de project ref e bloqueio de host de produção) já
// aplicadas acima. A senha nunca é impressa no terminal.

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
const ROLLBACK = process.argv.includes('--rollback')
const RESET_SENHA_STAFF = process.argv.includes('--reset-senha-staff')

if (RESET_SENHA_STAFF && ROLLBACK) {
  console.error('\n🔴 BLOQUEADO: --reset-senha-staff e --rollback não podem ser usados juntos.')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !chaveServico) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY em .env.homolog.local')
  process.exit(1)
}

// Senhas dos 3 usuários de teste e o project ref esperado — exclusivamente
// de env, nunca escritos neste arquivo. Aborta se qualquer um estiver
// vazio (nenhum valor default/fallback é aceito).
const SENHA_STAFF = process.env.HOMOLOG_STAFF_PASSWORD
const SENHA_LOCADOR = process.env.HOMOLOG_LOCADOR_PASSWORD
const SENHA_LOCATARIO = process.env.HOMOLOG_LOCATARIO_PASSWORD
const PROJECT_REF_ESPERADO = process.env.EXPECTED_HOMOLOG_PROJECT_REF

const variaveisFaltando = []
if (!SENHA_STAFF) variaveisFaltando.push('HOMOLOG_STAFF_PASSWORD')
if (!SENHA_LOCADOR) variaveisFaltando.push('HOMOLOG_LOCADOR_PASSWORD')
if (!SENHA_LOCATARIO) variaveisFaltando.push('HOMOLOG_LOCATARIO_PASSWORD')
if (!PROJECT_REF_ESPERADO) variaveisFaltando.push('EXPECTED_HOMOLOG_PROJECT_REF')
if (variaveisFaltando.length > 0) {
  console.error(`\n🔴 BLOQUEADO: variável(is) obrigatória(s) vazia(s) em .env.homolog.local: ${variaveisFaltando.join(', ')}`)
  console.error('Preencha todas antes de rodar — nenhuma tem valor default.')
  process.exit(1)
}

const host = new URL(url).host

// Extrai o project ref da URL (subdomínio antes de ".supabase.co") e
// exige correspondência EXATA com EXPECTED_HOMOLOG_PROJECT_REF. Esta é
// a trava automática principal — o print do host abaixo é só uma
// conferência visual adicional, não a única checagem.
const projectRefAtual = host.split('.')[0]
if (projectRefAtual !== PROJECT_REF_ESPERADO) {
  console.error(`\n🔴 BLOQUEADO: project ref de NEXT_PUBLIC_SUPABASE_URL ("${projectRefAtual}") não bate`)
  console.error(`com EXPECTED_HOMOLOG_PROJECT_REF ("${PROJECT_REF_ESPERADO}"). Este script só roda`)
  console.error('quando os dois coincidem exatamente. Confira .env.homolog.local antes de tentar de novo.')
  process.exit(1)
}

// Bloqueio ativo adicional: nunca deixa rodar (nem em dry-run) contra o
// host documentado como produção — independente da checagem acima.
const hostProducao = hostDeProducaoDocumentado()
if (hostProducao && host === hostProducao) {
  console.error(`\n🔴 BLOQUEADO: o host de .env.homolog.local (${host}) é igual ao`)
  console.error('project ref de produção documentado em DEPLOY.md. Este script só')
  console.error('pode rodar contra o projeto de homologação. Confira o conteúdo de')
  console.error('.env.homolog.local antes de tentar de novo.')
  process.exit(1)
}

console.log(`Projeto alvo (confira visualmente antes de continuar): ${host}`)
console.log(`Project ref conferido: ${projectRefAtual} === EXPECTED_HOMOLOG_PROJECT_REF`)
console.log(RESET_SENHA_STAFF ? '=== MODO RESET DE SENHA (staff) ===' : ROLLBACK ? '=== MODO ROLLBACK ===' : '=== MODO CRIAÇÃO ===')
console.log(CONFIRMADO ? '=== MODO GRAVAÇÃO (--confirmo-homologacao) ===' : '=== MODO DRY-RUN (nada será gravado) ===')

const supabaseAdmin = createClient(url, chaveServico, { auth: { autoRefreshToken: false, persistSession: false } })

// Dados fictícios fixos — nomes/e-mails fáceis de reconhecer e de
// limpar depois (tudo com sufixo ".homolog@teste.local" / "Teste").
// Senhas NUNCA ficam escritas aqui — vêm só das variáveis validadas acima.
const DADOS = {
  organizacao: { nome: 'Imobiliária Teste Homologação' },
  staff: { email: 'staff.homolog@teste.local', senha: SENHA_STAFF, nome: 'Staff Teste' },
  locador: { email: 'locador.homolog@teste.local', senha: SENHA_LOCADOR, nome: 'Locador Teste', cpf: '00000000000' },
  locatario: { email: 'locatario.homolog@teste.local', senha: SENHA_LOCATARIO, nome: 'Locatário Teste', cpf: '11111111111' },
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

// ============================================================
// Rollback — remove exatamente o que main() cria, nada mais.
// ============================================================
//
// Identifica os registros pelo nome fixo da organização fictícia
// (DADOS.organizacao.nome) — nunca por "apagar tudo" ou por um
// intervalo de datas, pra não arriscar remover dado real de outro
// teste que porventura já exista em homologação. Como a organização
// fictícia é isolada (nenhum dado de outro teste deveria compartilhar
// esse organization_id), apagar em cascata por organization_id é
// seguro dentro desse escopo.
//
// Auth users são removidos à parte, por e-mail exato (Admin API não
// tem "delete by organization_id") — mesmos 3 e-mails fixos usados na
// criação.
async function rollback() {
  const { data: org, error: erroBusca } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('nome', DADOS.organizacao.nome)
    .maybeSingle()
  if (erroBusca) { console.error('Erro ao buscar organização:', erroBusca.message); process.exit(1) }

  console.log('\nPlano de rollback:')
  if (!org) {
    console.log(`- Nenhuma organização "${DADOS.organizacao.nome}" encontrada — nada de tabela para remover.`)
  } else {
    console.log(`- Organização encontrada: ${org.id}`)
    console.log('- Remover (nessa ordem, por organization_id): demandas, cobrancas, contratos, imoveis, clientes, usuarios_organizacao, users, organizations.')
  }
  console.log(`- Remover 3 usuários de auth.users por e-mail: ${DADOS.staff.email}, ${DADOS.locador.email}, ${DADOS.locatario.email}`)

  if (!CONFIRMADO) {
    console.log('\nDry-run — nada foi removido. Rode com --rollback --confirmo-homologacao para reverter de verdade.')
    return
  }

  if (org) {
    const tabelasPorOrg = ['demandas', 'cobrancas', 'contratos', 'imoveis', 'clientes', 'usuarios_organizacao', 'users']
    for (const tabela of tabelasPorOrg) {
      const { error } = await supabaseAdmin.from(tabela).delete().eq('organization_id', org.id)
      if (error) { console.error(`Erro ao limpar ${tabela}:`, error.message); process.exit(1) }
      console.log(`Removido: ${tabela} (organization_id = ${org.id})`)
    }
    const { error: erroOrg } = await supabaseAdmin.from('organizations').delete().eq('id', org.id)
    if (erroOrg) { console.error('Erro ao remover organização:', erroOrg.message); process.exit(1) }
    console.log(`Removido: organizations (${org.id})`)
  }

  const { data: listaAuth, error: erroLista } = await supabaseAdmin.auth.admin.listUsers()
  if (erroLista) { console.error('Erro ao listar auth.users:', erroLista.message); process.exit(1) }
  for (const emailAlvo of [DADOS.staff.email, DADOS.locador.email, DADOS.locatario.email]) {
    const usuario = listaAuth.users.find((u) => u.email === emailAlvo)
    if (!usuario) { console.log(`auth.users: ${emailAlvo} não encontrado (já removido?).`); continue }
    const { error: erroDelete } = await supabaseAdmin.auth.admin.deleteUser(usuario.id)
    if (erroDelete) { console.error(`Erro ao remover auth.users ${emailAlvo}:`, erroDelete.message); process.exit(1) }
    console.log(`Removido: auth.users (${emailAlvo})`)
  }

  console.log('\nRollback concluído.')
}

// ============================================================
// Reset de senha — SOMENTE auth.users do e-mail staff.homolog@teste.local.
// Não recria nada, não roda rollback, não toca organização, perfil,
// papel ou os outros dois usuários (locador/locatário). A senha nova
// vem exclusivamente de HOMOLOG_STAFF_PASSWORD (já validada como não
// vazia mais acima) — nunca impressa aqui, nem em caso de erro.
// ============================================================
async function resetSenhaStaff() {
  const { data: listaAuth, error: erroLista } = await supabaseAdmin.auth.admin.listUsers()
  if (erroLista) { console.error('Erro ao listar auth.users:', erroLista.message); process.exit(1) }

  const usuario = listaAuth.users.find((u) => u.email === DADOS.staff.email)

  console.log('\nPlano de reset de senha:')
  if (!usuario) {
    console.log(`- Usuário ${DADOS.staff.email} NÃO encontrado em auth.users neste projeto.`)
    console.log('- Nada a fazer — use o modo de criação (sem flags) se o usuário realmente não existir.')
    return
  }
  console.log(`- Usuário encontrado: ${DADOS.staff.email} (id ${usuario.id})`)
  console.log('- Ação: redefinir apenas a senha deste usuário em auth.users, usando o valor atual de HOMOLOG_STAFF_PASSWORD.')
  console.log('- Não afeta: organizations, public.users, usuarios_organizacao, locador, locatário, nem qualquer outra tabela.')

  if (!CONFIRMADO) {
    console.log('\nDry-run — nenhuma escrita foi realizada. Rode com --reset-senha-staff --confirmo-homologacao para aplicar.')
    return
  }

  const { error: erroUpdate } = await supabaseAdmin.auth.admin.updateUserById(usuario.id, { password: DADOS.staff.senha })
  if (erroUpdate) { console.error('Erro ao redefinir senha:', erroUpdate.message); process.exit(1) }
  console.log(`\nSenha redefinida para ${DADOS.staff.email} (valor atual de HOMOLOG_STAFF_PASSWORD em .env.homolog.local).`)
}

RESET_SENHA_STAFF ? resetSenhaStaff() : (ROLLBACK ? rollback() : main())
