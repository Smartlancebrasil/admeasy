# Procedimento — dump schema-only de produção e restauração em `admeasy-homologacao`

**Nada foi executado.** Este documento é só o plano — nenhum dump foi
gerado, nada foi restaurado, nenhuma migration foi aplicada, produção não
foi tocada, a Vercel não foi alterada. Complementa
`docs/HOMOLOGATION_ENVIRONMENT_SETUP.md` (Seção 1), agora em nível de
comando exato.

Nenhum valor real (senha, URL completa, connection string, chave) aparece
neste documento — todo lugar que precisaria de um valor real usa uma
variável de ambiente com nome explícito, que você preenche no seu próprio
terminal, nunca aqui.

🔒 **Gate explícito, obrigatório antes de qualquer comando deste
documento ser executado**: os comandos das Seções 1 e 4 (dump e
restauração) **não devem ser rodados** até que produção e homologação
sejam conferidas **separadamente**, em uma etapa própria — cada
conexão (`$PROD_DB_URL`, `$HOMOLOG_DB_URL`) validada individualmente,
uma de cada vez, nunca as duas ao mesmo tempo. Nenhuma das três
verificações da Seção 3 substitui essa conferência prévia — elas são
uma camada adicional, rodada imediatamente antes da restauração, não a
única checagem do processo.

## 0. Antes de tudo — duas variáveis, nunca uma genérica

```bash
export PROD_DB_URL="<connection string de produção — Supabase Dashboard → Project Settings → Database → Connection string, formato URI>"
export HOMOLOG_DB_URL="<connection string de admeasy-homologacao, mesmo caminho>"
```

⚠️ **Isso não é a mesma coisa que `NEXT_PUBLIC_SUPABASE_URL`** — a
connection string de banco (`postgresql://...`, porta 5432 ou 6543) é
diferente da URL da API REST (`https://xxx.supabase.co`) usada no
`.env.local` do app. Pegue a connection string em **Project Settings →
Database**, não em **Project Settings → API**.

Nunca exportar as duas na mesma sessão de terminal por mais tempo do que
o necessário para os comandos abaixo — depois de terminar, `unset
PROD_DB_URL HOMOLOG_DB_URL`.

## 1. Comando exato do dump — schema-only, só `public`

```bash
pg_dump "$PROD_DB_URL" \
  --schema=public \
  --schema-only \
  --no-owner \
  --no-privileges \
  --no-comments \
  -f schema-producao-public.sql
```

Por quê cada flag:
- `--schema=public` — **allowlist, não blocklist**: dump só do schema
  `public`. Isso já exclui `auth.*` (dados/tabelas de usuário),
  `storage.*` (buckets, objetos), `realtime.*`, `extensions.*`,
  `graphql*`, `pgbouncer.*`, `vault.*`, `supabase_migrations.*` — tudo
  que não é `public` fica de fora automaticamente, sem precisar
  enumerar exclusões uma por uma (mais seguro que uma lista de
  `--exclude-schema`, que fica desatualizada se um schema novo
  aparecer).
- `--schema-only` — **nunca `--data-only`, nunca omitir esta flag**:
  garante zero linhas de qualquer tabela, não só das sensíveis. Não
  existe "excluir só os dados de cliente" separadamente — schema-only
  já significa nenhum dado de nenhuma tabela, ponto.
- `--no-owner --no-privileges` — não tenta recriar dono/grants da
  produção (podem referenciar configuração que não existe exatamente
  igual no projeto novo); o projeto `admeasy-homologacao`, por ser um
  projeto Supabase novo, já vem com os grants padrão de
  `authenticated`/`anon`/`service_role` de fábrica — não precisa copiar
  isso de produção.
- `--no-comments` — evita ruído de comentário de coluna que não muda
  nada funcional.

Resultado: um arquivo `schema-producao-public.sql`, texto plano,
revisável antes de qualquer restauração — **abra e leia antes de
colar em qualquer lugar**.

## 2. Exclusões — o que fica de fora e por quê

| Excluído | Como |
|---|---|
| Todas as linhas de todas as tabelas (clientes, contratos, cobranças, demandas, etc.) | `--schema-only` |
| `auth.*` (usuários reais, sessões, tokens) | `--schema=public` (allowlist) |
| `storage.*` (buckets, metadados de arquivo) | `--schema=public` (allowlist) |
| Donos/grants específicos de produção | `--no-owner --no-privileges` |

⚠️ Se a restauração (Seção 3) falhar por função de extensão não
encontrada (ex.: `gen_random_uuid()`, `uuid_generate_v4()`), confirmar
que as extensions padrão do Supabase (`pgcrypto`, `uuid-ossp`) estão
habilitadas em `admeasy-homologacao` — todo projeto novo já vem com
elas por padrão, então isso não deveria acontecer, mas é o primeiro
lugar a olhar se acontecer.

## 3. Verificações ANTES de restaurar — confirmar que o destino é `admeasy-homologacao`

Duas camadas, nunca só uma:

**a) Visual**: confirmar no painel do Supabase, ou no prompt do
`psql`, que o projeto conectado é `admeasy-homologacao` — nome aparece
no cabeçalho do painel; `psql` mostra o host na primeira linha ao
conectar.

**b) Consulta de sanidade, antes de rodar qualquer coisa que escreva**:
```sql
select
  current_database(),
  (select count(*) from information_schema.tables where table_schema = 'public') as tabelas_publicas,
  (select count(*) from auth.users) as total_usuarios;
```
Esperado num projeto novo, ainda sem o dump restaurado: `tabelas_publicas
= 0`, `total_usuarios = 0`. Se aparecer qualquer número alto/familiar
(parecido com o que produção teria), **parar imediatamente** — sinal de
estar conectado no projeto errado.

**c) Comparação de project ref**: extrair o project ref (parte entre
`https://` e `.supabase.co`) da URL de cada projeto e confirmar
visualmente que são diferentes — nunca colar os dois lado a lado em
texto compartilhado (chat, ticket, print). O mesmo princípio já
aplicado em `scripts/seed-homologacao.mjs` (bloqueio automático contra
o host documentado em `DEPLOY.md`).

## 4. Comando exato de restauração — exclusivamente em homologação

Depois das três verificações da Seção 3 confirmadas:

```bash
psql "$HOMOLOG_DB_URL" -f schema-producao-public.sql
```

Alternativa com uma camada visual a mais (recomendada na primeira vez):
abrir `schema-producao-public.sql` num editor, copiar o conteúdo, colar
no **SQL Editor do painel do Supabase** já dentro do projeto
`admeasy-homologacao` (nome visível no cabeçalho da página antes de
colar) e rodar por ali em vez de terminal.

Nunca rodar este comando com `$PROD_DB_URL` — só `$HOMOLOG_DB_URL`,
sempre o nome explícito, nunca uma variável genérica reaproveitada.

## 5. Consultas pós-restauração — validar tabelas, funções, triggers, policies, RLS

```sql
-- Quantas tabelas vieram
select count(*) as total_tabelas
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE';

-- Lista completa, pra comparar com o que se espera
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;

-- Funções (esperado incluir get_org_id, get_portal_cliente_id,
-- is_admeasy_admin, get_portal_organization_id,
-- preencher_locador_demanda_portal, proteger_colunas_demanda_portal —
-- as duas últimas só se 20260714010000 já tiver sido aplicada depois)
select routine_name from information_schema.routines
where routine_schema = 'public' order by routine_name;

-- Triggers
select event_object_table, trigger_name
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table, trigger_name;

-- RLS habilitado por tabela
select relname as tabela, relrowsecurity as rls_ligado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and relkind = 'r'
order by relname;

-- Policies (mesmo padrão de consulta já usado nesta revisão)
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Comparar o resultado dessas 5 consultas com o que se sabe hoje sobre
produção (documentado em `docs/SECURITY_HARDENING_REVIEW.md` e
`docs/MOBILE_APP_RLS_REVIEW.md`) — divergência inesperada é sinal de
dump incompleto ou restauração parcial.

## 6. Confirmar que nenhuma linha de cliente/contrato/cobrança/demanda foi copiada

Rodar logo depois da restauração, antes de qualquer outro passo:

```sql
select
  (select count(*) from public.organizations) as organizations,
  (select count(*) from public.clientes)      as clientes,
  (select count(*) from public.contratos)     as contratos,
  (select count(*) from public.cobrancas)     as cobrancas,
  (select count(*) from public.demandas)      as demandas,
  (select count(*) from auth.users)           as auth_usuarios;
```

**Esperado: todos os valores em zero.** Qualquer número maior que zero
aqui é um problema sério — significa que dado real entrou de algum
jeito (ex.: alguém rodou o dump sem `--schema-only` por engano). Se
acontecer, não seguir adiante — ver Seção 7.

## 7. Como reverter homologação se a restauração falhar

Como é um projeto dedicado, sem nada de valor além do que este próprio
processo está criando, a reversão é direta — nunca faria isso em
produção, mas aqui é seguro:

**a) Reversão rápida (schema com problema, projeto continua bom):**
```sql
drop schema public cascade;
create schema public;
```
Limpa tudo dentro de `public` em homologação e permite repetir a
restauração do zero. **Confirmar mais uma vez (Seção 3b) que está em
homologação antes de rodar isso** — é destrutivo.

**b) Reversão total (projeto com problema mais profundo):** apagar o
projeto `admeasy-homologacao` no painel do Supabase e criar um novo com
o mesmo nome, recomeçando do dump.

Nenhuma das duas opções tem qualquer efeito sobre produção — o dump
usado é só leitura contra produção, gerar ele de novo não tem custo.

## 8. Ordem dos próximos passos após validar o schema

1. Rodar as consultas da Seção 5 e 6 — confirmar schema íntegro e zero
   dado real.
2. Aplicar as 4 migrations pendentes, nesta ordem (mantida):
   ```
   1. 20260714010000_hardening_cobrancas_demandas.sql
   2. 20260715000000_fix_portal_demanda_organization.sql
   3. 20260714000000_portal_locador_rls.sql
   4. 20260714020000_rpc_decisao_demanda.sql
   ```
3. Rodar `node scripts/seed-homologacao.mjs --confirmo-homologacao`.
4. Rodar a checklist funcional completa de
   `docs/HOMOLOGATION_TEST_PLAN.md`.
5. Configurar as variáveis de Preview na Vercel apontando pra
   homologação (`docs/HOMOLOGATION_ENVIRONMENT_SETUP.md`, Seção 4), se
   ainda não estiver feito.
6. Só depois de tudo isso, considerar aplicar as 4 migrations em
   produção.

Nenhum passo acima foi executado nesta sessão.
