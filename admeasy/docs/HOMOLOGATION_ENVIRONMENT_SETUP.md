# Plano técnico — ambiente de homologação (`admeasy-homologacao`)

**Nada foi executado.** Este documento é só o plano — nenhuma migration foi
aplicada, nenhum dado foi criado, nenhuma variável de ambiente da Vercel foi
alterada, produção não foi tocada. Toda ação real descrita aqui depende de
você ter acesso ao painel do Supabase (produção e homologação) e ao painel
da Vercel — nenhum dos dois eu tenho acesso nesta sessão.

## 1. Migrations-base necessárias para reproduzir o schema atual

🔴 **Achado importante antes de qualquer coisa**: este repositório **não
tem um histórico de migrations completo** para a estrutura das tabelas
(`contratos`, `demandas`, `cobrancas`, `clientes`, `users`, `imoveis`,
`organizations` etc.). Só existem 3 arquivos de migration versionados,
e nenhum deles cria uma tabela do zero:

| Arquivo | O que faz | Estado em produção |
|---|---|---|
| `20260712000000_habilitar_rls.sql` | Liga RLS e cria policies/funções em cima de tabelas **já existentes** | Já aplicada (confirmado por consulta ao vivo anterior) |
| `20260714030000_storage_bucket_privado.sql` | Configuração do bucket de Storage | Não aplicada — fora do escopo desta rodada de 4 |
| `20260714040000_storage_remover_policy_publica.sql` | Policies de Storage | Não aplicada — fora do escopo desta rodada de 4 |

As tabelas em si (colunas, tipos, constraints, sequences, triggers de
protocolo, etc.) foram criadas ao longo do tempo direto no painel do
Supabase — nunca foram versionadas como migration neste repositório. Os
dois arquivos `schema.sql`/`supabase/schema.sql` que existem no repo são
dumps **desatualizados** (nomes de coluna antigos como `organizacao_id`,
tabelas com estrutura diferente da real) — não são confiáveis pra
reproduzir o schema atual.

**Conclusão**: "migrations-base" não é uma lista de arquivos `.sql` pra
rodar — é um **dump de schema tirado direto da produção**. É a única
fonte de verdade confiável.

### Como obter o schema-base

Usar `pg_dump`/`supabase db dump` **somente leitura** contra produção,
**só a estrutura, nunca os dados**:

```bash
# Com Supabase CLI (se a sessão estiver ativa):
supabase db dump --db-url "<CONNECTION_STRING_DE_PRODUCAO>" --schema-only -f schema-producao.sql

# Ou com pg_dump direto:
pg_dump "<CONNECTION_STRING_DE_PRODUCAO>" --schema-only --no-owner --no-privileges -f schema-producao.sql
```

`--schema-only` é essencial — garante que nenhum dado real de cliente é
copiado, só a estrutura (tabelas, colunas, índices, constraints,
functions, triggers, policies). Isso é uma leitura contra produção, sem
nenhuma escrita — seguro de rodar quando quiser.

Um dump completo de schema tirado da produção **já traz** as
policies/funções de `20260712000000` (elas já estão live) — não
precisa reaplicar esse arquivo separadamente depois de restaurar o
dump, só confirmar que vieram (ver Seção 5).

## 2. Como aplicar migrations exclusivamente no projeto de homologação

Regras, pra nunca depender de "lembrar qual projeto está selecionado":

- **Nunca** usar `supabase db push` sem `--db-url` explícito. O CLI usa
  o projeto "linkado" localmente (`supabase link`) por padrão — se
  algum dia esse link já apontou pra produção, um `db push` sem
  `--db-url` vai na produção mesmo sem avisar.
- **Nunca** usar uma variável de ambiente genérica tipo `$DATABASE_URL`.
  Usar sempre nomes explícitos: `HOMOLOG_DB_URL` (nunca `DB_URL` ou
  `SUPABASE_URL` sozinho).
- Preferir aplicar cada migration colando o SQL manualmente no **SQL
  Editor do painel do Supabase**, depois de conferir visualmente, no
  próprio painel, que o projeto selecionado é `admeasy-homologacao`
  (nome aparece no topo/breadcrumb do painel).
- Nunca ter as credenciais de produção e de homologação carregadas na
  mesma sessão de terminal ao mesmo tempo (nunca exportar as duas como
  variável de ambiente juntas).
- Rodar a consulta de verificação (Seção 5) **antes** de colar qualquer
  SQL, sempre, mesmo em aplicações repetidas.

## 3. `.env.homolog.local.example`

Criado em `admeasy/.env.homolog.local.example` — só as 3 chaves, sem
valor:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
`.env.homolog.local` (o arquivo real, com valores) foi adicionado ao
`.gitignore` (junto com um padrão geral `.env*.local`, como rede de
segurança) — nunca deve ser commitado.

## 4. Configurar variáveis de ambiente de Preview na Vercel

Ação manual, no painel da Vercel (eu não tenho acesso):

1. **Project Settings → Environment Variables**.
2. Para cada uma das 3 chaves (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`):
   - Adicionar um valor **separado**, com o escopo marcado como
     **Preview** apenas (desmarcar Production e Development).
   - Usar os valores do projeto `admeasy-homologacao`.
3. Confirmar que os valores de **Production** continuam apontando só
   pra produção, sem alteração.
4. Depois de salvar, forçar um redeploy de uma branch de preview
   qualquer (ex.: fazer um commit trivial numa branch aberta) e
   confirmar no log de build que a Preview está de fato usando a URL
   de homologação — sem revelar a URL em nenhum lugar público.

⚠️ Se o projeto Vercel só tiver 1 conjunto de variáveis (sem
diferenciar Preview de Production), essa configuração ainda não existe
hoje — Previews estariam usando produção até esse passo ser feito.

## 5. Consulta de verificação — confirmar project refs diferentes

Não existe uma única query SQL que compare dois projetos Supabase
diferentes ao mesmo tempo (cada um é um banco isolado) — a verificação
é em duas partes:

**a) Comparação textual dos project refs** (não é SQL, é o jeito mais
direto): o "project ref" aparece no início da URL de cada projeto
(`https://<project-ref>.supabase.co`). Comparar as duas
`NEXT_PUBLIC_SUPABASE_URL` (produção vs. `.env.homolog.local`) e
confirmar que os project refs são diferentes — nunca reproduzir os
valores completos em nenhum lugar (chat, log, print).

**b) Consulta de sanidade, para rodar no SQL Editor de cada projeto
antes de aplicar qualquer coisa** — compara contagens, não expõe dado
sensível:
```sql
select
  current_database(),
  (select count(*) from public.organizations) as total_organizacoes,
  (select count(*) from auth.users) as total_usuarios;
```
Esperado em homologação (antes do seed da Seção 6): `0` organizações,
`0` usuários. Esperado em produção: números reais, bem maiores que
zero. Se os dois projetos mostrarem números parecidos ou iguais, **parar
e investigar antes de continuar** — pode ser sinal de estar conectado
no projeto errado.

## 6. Plano de dados fictícios mínimos

Script preparado (não executado): `scripts/seed-homologacao.mjs`.

- Dry-run por padrão — só grava com `--confirmo-homologacao`.
- Lê exclusivamente `.env.homolog.local` (nunca `.env.local`).
- Imprime o host do projeto alvo antes de qualquer gravação, pra
  confirmação visual.
- **Bloqueia ativamente** (mesmo em dry-run) se o host alvo bater com o
  project ref de produção documentado em `DEPLOY.md` — lido em tempo de
  execução daquele arquivo, nunca duplicado no código do script.
- Nenhum segredo embutido no script — URL e chaves só existem em
  `.env.homolog.local` (gitignored).
- Cria, nesta ordem: 1 organização → 1 staff (via Auth Admin API) → 1
  locador (via Auth Admin API) → 1 locatário (via Auth Admin API) → 1
  imóvel → 1 contrato ativo → 1 cobrança → 1 demanda aberta.
- Todos os registros com nome/e-mail reconhecíveis, fictícios
  (`*.homolog@teste.local`, "Teste" nos nomes) — fácil de identificar e
  limpar depois, nenhum dado real de cliente.

⚠️ **Limitação já documentada no próprio script**: as colunas usadas
foram levantadas lendo o código da aplicação, não uma introspecção ao
vivo do schema de homologação — é bem possível que precise de pequenos
ajustes (ex.: `organizations.plano_id` pode ser obrigatório) na primeira
tentativa real de rodar.

## 7. Ordem final das 4 migrations (mantida)

```
1. 20260714010000_hardening_cobrancas_demandas.sql
2. 20260715000000_fix_portal_demanda_organization.sql
3. 20260714000000_portal_locador_rls.sql
4. 20260714020000_rpc_decisao_demanda.sql
```
Aplicar só depois do schema-base (Seção 1) estar restaurado em
homologação e da consulta de verificação (Seção 5) confirmar que o
projeto correto está selecionado.

## Sequência exata de preparação (passo a passo)

1. No painel do Supabase, dentro de `admeasy-homologacao`: copiar
   Connection String / URL / anon key / service role key (ação manual
   sua, nunca minha).
2. Copiar `.env.homolog.local.example` para `.env.homolog.local` e
   preencher com os valores do passo 1.
3. Rodar o dump de schema-only contra produção (Seção 1) — só leitura.
4. Restaurar esse dump dentro de `admeasy-homologacao` (colar no SQL
   Editor, ou `psql "$HOMOLOG_DB_URL" -f schema-producao.sql`).
5. Rodar a consulta de verificação (Seção 5) — confirmar 0
   organizações/usuários em homologação e project ref diferente do de
   produção.
6. Confirmar que `20260712000000` já veio no dump (consultar
   `pg_policies` filtrando `cobrancas`/`demandas`, mesmo padrão de
   consulta já usado nesta revisão).
7. Aplicar as 4 migrations, uma de cada vez, na ordem da Seção 7 —
   testando entre cada uma com o `docs/HOMOLOGATION_TEST_PLAN.md` já
   existente.
8. Rodar `node scripts/seed-homologacao.mjs --confirmo-homologacao`.
9. Rodar a checklist funcional completa do `HOMOLOGATION_TEST_PLAN.md`
   usando os usuários fictícios do passo 8.
10. Configurar as variáveis de Preview na Vercel (Seção 4), se ainda
    não estiver feito.
11. Só depois de tudo isso, considerar aplicar as 4 migrations em
    produção.

## Riscos encontrados

- 🔴 **Sem histórico de migration para a estrutura-base das tabelas**
  (Seção 1) — a única forma confiável de reproduzir o schema é dump
  direto da produção, o que exige acesso administrativo a ela (mesmo
  que só leitura).
- 🟡 `.env.homolog.local` não estava protegido pelo `.gitignore` até
  este plano — **corrigido agora** (adicionado `.env.homolog.local` e
  o padrão geral `.env*.local`), antes que o arquivo real chegasse a
  existir.
- 🟡 Sem confirmação de que a Vercel já separa variáveis de Preview e
  Production — se não separar, Previews continuam batendo em produção
  até a Seção 4 ser executada manualmente.
- 🟡 Criar usuários de teste (staff/locador/locatário) não pode ser
  feito só com SQL — depende da Auth Admin API (service role), então o
  script de seed precisa da chave de serviço de homologação.
- 🟡 O dump de schema pode não trazer 100% de paridade (extensions,
  sequences com valor atual, alguma configuração específica do projeto)
  — validar depois de restaurado, não assumir cópia perfeita.
- 🟢 As migrations de Storage (`20260714030000`/`20260714040000`) não
  fazem parte deste plano — o bucket "documentos" em homologação nasce
  no estado padrão do Supabase (público, sem limite), diferente do
  estado real de produção hoje. Não é um problema pra testar as 4
  migrations de RLS/demandas, mas vale lembrar se algum dia for testar
  Storage também neste ambiente.

## Como garantir que nenhuma ação atinja produção

- Toda credencial de homologação vive só em `.env.homolog.local”
  (gitignored) — nunca em `.env.local` nem em nenhum arquivo commitável.
- Nomes de variável de ambiente sempre explícitos
  (`HOMOLOG_DB_URL`, nunca `DATABASE_URL` genérico).
- Checagem visual obrigatória (nome do projeto no painel do Supabase)
  antes de colar qualquer SQL, sempre, mesmo em reaplicações.
- A consulta de verificação (Seção 5) roda **antes** de qualquer
  escrita, todas as vezes — não só na primeira.
- Scripts (`seed-homologacao.mjs`) só escrevem com flag explícita
  (`--confirmo-homologacao`) e imprimem o host alvo antes de gravar.
- Dump de produção é sempre `--schema-only` — nunca copia dado real de
  cliente pra homologação.
- Nenhuma ação deste plano foi executada nesta sessão — tudo depende de
  você rodar manualmente, no seu próprio terminal/painel, com suas
  próprias credenciais.
