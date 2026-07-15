# Revisão de RLS para o app Admeasy Connect

**Nada foi aplicado ao Supabase. Nenhuma policy existente foi removida ou
alterada. Nenhuma service role foi usada para ler dado de aplicação — só
para introspecção estática de código já feita nesta sessão em fases
anteriores.** Este documento é só análise + proposta, aguardando aprovação.

## ⚠️ Limitação importante desta análise

Não há sessão ativa do Supabase CLI nem conexão direta ao Postgres neste
ambiente, e a tabela `pg_policies` (onde ficam as políticas reais) não é
exposta pela API REST do Supabase. **Por isso, a Seção 1 abaixo não reflete
o estado AO VIVO do banco** — reflete o que está escrito no arquivo
`supabase/migrations/20260712000000_habilitar_rls.sql`, presente no
histórico da branch `main`, que traz no próprio topo o aviso: *"este script
ainda NÃO foi aplicado ao banco de produção"* (na data em que foi escrito).

**Antes de aprovar qualquer coisa aqui, confirme diretamente no painel do
Supabase (Database → Policies) se esse script já foi executado — ou peça
pra alguém com acesso rodar `select policyname, tablename, cmd from
pg_policies where schemaname = 'public' order by tablename;` e comparar
com o que está documentado abaixo.**

## 🟢 Atualização — `cobrancas` e `demandas` confirmadas ao vivo (2026-07-15)

Você rodou a consulta em `pg_policies` filtrada por essas duas tabelas.
Resultado:

```
cobrancas:  org_isolation (ALL), portal_locatario_select (SELECT), portal_locatario_update (UPDATE)
demandas:   org_isolation (ALL), portal_locatario (ALL)
```

Bate **exatamente** com as linhas de `cobrancas`/`demandas` na tabela da
Seção 1 abaixo — inclusive o `portal_locatario` de `demandas` sendo
`FOR ALL` (o Risco R1 sinalizado abaixo era real, não hipotético). As
demais tabelas da Seção 1 (`clientes`, `contratos`, `imoveis`,
`vistorias`, Storage) **continuam não confirmadas ao vivo** — a
limitação original desta seção permanece válida para elas. Detalhe da
correção aplicada a `cobrancas`/`demandas` (não commitada, não
aplicada) em `docs/SECURITY_HARDENING_REVIEW.md`.

---

## 1. Políticas encontradas (estado pretendido, não confirmado ao vivo)

Fonte: `supabase/migrations/20260712000000_habilitar_rls.sql` (branch `main`).

| Tabela | Política | Comando | USING | WITH CHECK | Protege por org? | Protege por locador/locatário? |
|---|---|---|---|---|---|---|
| `clientes` | `org_isolation` | ALL | `organization_id = get_org_id()` | — | ✅ (staff) | — |
| `clientes` | `portal_proprio_registro` | SELECT | `usuario_portal_id = auth.uid()` | — | — | ✅ (genérico, cobre os dois tipos) |
| `contratos` | `org_isolation` (pré-existente) | ALL | `organization_id = get_org_id()` | — | ✅ | — |
| `contratos` | `portal_locatario` | SELECT | `locatario_id = get_portal_cliente_id()` | — | — | ✅ só locatário — **locador sem política** |
| `demandas` | `org_isolation` (pré-existente) | ALL | `organization_id = get_org_id()` | — | ✅ | — |
| `demandas` | `portal_locatario` | **ALL** | `locatario_id = get_portal_cliente_id()` | — | — | ⚠️ ver Risco R1 abaixo |
| `cobrancas` | `org_isolation` | ALL | `organization_id = get_org_id()` | — | ✅ | — |
| `cobrancas` | `portal_locatario_select` | SELECT | `locatario_id = get_portal_cliente_id()` | — | — | ✅ |
| `cobrancas` | `portal_locatario_update` | UPDATE | `locatario_id = get_portal_cliente_id()` | `locatario_id = get_portal_cliente_id()` | — | 🔴 ver Risco R0 abaixo (o mais grave) |
| `imoveis` | `org_isolation` (pré-existente) | ALL | `organization_id = get_org_id()` | — | ✅ | — |
| `imoveis` | `admeasy_admin_full_access` | SELECT | `is_admeasy_admin()` | — | — | — |
| `imoveis` | *(nenhuma política de portal)* | — | — | — | — | 🔴 ver Risco R2 abaixo |
| `vistorias` | `org_isolation` (pré-existente) | ALL | `organization_id = get_org_id()` | — | ✅ | — |
| `vistorias` | *(nenhuma política de portal)* | — | — | — | — | ❌ nenhum acesso pro portal hoje |
| `documentos` (tabela) | — | — | — | — | — | tabela existe no schema.sql mas **não é usada em nenhum lugar do código** (ver Seção 2) |
| Storage `documentos` | `documentos_authenticated_all` | ALL (`to authenticated`) | `bucket_id = 'documentos'` | `bucket_id = 'documentos'` | ❌ | ❌ ver Risco R3 abaixo |

Papéis autorizados: todas as políticas de portal usam a role padrão
`authenticated` do Supabase (qualquer usuário logado via Supabase Auth,
sem distinção de tipo na própria role — a distinção é feita pela expressão
`USING`, não pela role).

---

## 2. Colunas e relacionamentos confirmados

Confirmados via `schema.sql` **cruzado com o código real** (o `schema.sql`
está desatualizado em vários pontos — sinalizado onde relevante).

### `contratos`
`id`, `organization_id`, `imovel_id`, `locatario_id`, `locador_id`,
`fiador_id`, `corretor_id`, `numero`, `tipo`, `data_inicio`, `data_fim`,
`valor_mensal`, `valor_atual`, `status` — valores de status:
`'ativo' | 'encerrado' | 'rescindido' | 'vencendo' | 'pendente'`.
(O `schema.sql` não tem `taxa_administracao`, `honorarios_aplicavel`,
`comissao_seguro_incendio`, `comissao_seguro_fianca`, `fiador_imovel_*`
etc., mas todas essas colunas são usadas e persistidas normalmente pelo
código real em `app/(interno)/contratos/page.tsx`.)

### `demandas`
`id`, `organization_id`, `imovel_id`, `contrato_id`, `locatario_id`,
`locador_id`, `fornecedor_id`, `responsavel_id`, `autorizado_por`,
`titulo`, `descricao`, `orcamento`, `valor_final`, `quem_paga`,
`prazo_estimado`. Não existe uma coluna literal "solicitante" — quem abriu
a demanda é inferido por `origem` (`'locatario' | 'imobiliaria'`) combinado
com `locatario_id`/`responsavel_id`.
Status: `'aberta' | 'recebida' | 'aguardando_locador' | 'autorizada' |
'em_execucao' | 'concluida' | 'recusada'` (mais `'indeferida'` usado no
código da tela interna, que não está no CHECK do `schema.sql` — outro
ponto de desatualização a confirmar).

### `cobrancas`
**Não existe em nenhum dos dois `schema.sql` do repositório** — mapeada
100% via código real (`app/(interno)/contratos/page.tsx`, geração em massa
das cobranças de um contrato):
`id`, `organization_id`, `contrato_id`, `locatario_id`, `locador_id`,
`data_vencimento`, `mes_referencia`, `competencia`, `valor_aluguel`,
`valor_condominio`, `valor_iptu`, `valor_seguro_incendio`,
`valor_seguro_fianca`, `valor_caucao_parcela`, `valor_total`,
`taxa_administracao_pct`, `valor_taxa_adm`, **campos de repasse**:
`valor_repasse`, `status_repasse` (`'aguardando' | 'repassado'`),
`data_repasse_prevista`, `data_repasse_realizada`; **status da cobrança**:
`status_cobranca` (`'pendente' | 'pago'`, mais `'em_atraso'` usado em
lugares pontuais da UI); campos de boleto/Pix: `boleto_url`,
`boleto_linha_digitavel`, `pix_qr_code`, `pix_qr_code_base64`,
`mp_payment_id`, `lembrete_7d_enviado_em`, `lembrete_2d_enviado_em`.

### `imoveis`
`id`, `organization_id`, `proprietario_id` (é o locador dono do imóvel —
FK direta pra `clientes`, existe independente de haver contrato),
`corretor_id`, `titulo`, `endereco`, `bairro`, `cidade`, `estado`, `cep`,
`status` (`'disponivel' | 'alugado' | 'vendido' | 'em_analise' | 'inativo'
| 'rascunho'`).

### `vistorias`
`id`, `organization_id`, `imovel_id`, `vistoriador_id`, `tipo`
(`'entrada' | 'saida' | 'periodica'`), `data_vistoria`, `status`,
`ambientes` (jsonb), `locadores` e `locatarios` — **atenção: esses dois
últimos são arrays de texto livre (nomes digitados na hora), não são
foreign keys pra `clientes`**. **Não existe `contrato_id` nem
`locador_id`/`locatario_id` reais em `vistorias`** — a única forma
confiável de ligar uma vistoria a um locador/locatário é via
`vistorias.imovel_id = contratos.imovel_id`.

### Tabela `documentos`
Existe no `schema.sql` (histórico por cliente/contrato), **mas não é
referenciada em nenhum lugar do código da aplicação** — busquei
`.from('documentos')` em todo `app/` e só existem chamadas de
`.storage.from('documentos')` (o **bucket** de Storage, que é uma coisa
completamente diferente). Essa tabela parece ser legado morto — confirmar
com a equipe antes de decidir se entra no escopo do app mobile.

---

## 3. Função `get_portal_cliente_id()`

```sql
create or replace function public.get_portal_cliente_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select id from public.clientes where usuario_portal_id = auth.uid() limit 1
$$;
```

- **Retorno**: `uuid` (o `clientes.id`, não o `auth.users.id`).
- **Segurança**: `security definer` com `set search_path = ''` — hardening
  correto (evita sequestro de search_path, uma técnica comum de escalonar
  privilégio em funções `security definer`).
- **Usa `auth.uid()`**: sim, é a única fonte de identidade.
- **Pode retornar mais de um registro?** A função em si retorna um único
  escalar (`limit 1`), então não. Mas a query interna, sem esse `limit 1`,
  poderia bater em mais de uma linha se dois `clientes` tivessem o mesmo
  `usuario_portal_id` — **não encontrei nenhuma constraint `UNIQUE` em
  `clientes.usuario_portal_id`** em nenhum dos dois `schema.sql`.
  Recomendo confirmar/adicionar essa constraint (fora do escopo desta
  migration, é mudança de schema em tabela existente).
- **Comportamento quando não encontra cliente**: retorna `NULL`. Como as
  políticas comparam `coluna = get_portal_cliente_id()`, e em SQL
  `qualquer_coisa = NULL` nunca é verdadeiro, o resultado prático é "nenhuma
  linha visível" — comportamento seguro por padrão (fail closed).
- **Risco de duplicidade**: baixo na prática (sem `ORDER BY`, se algum dia
  houver duas linhas com o mesmo vínculo, a escolha de qual `limit 1` prevalece
  não é determinística) — mas não é um buraco de segurança entre
  organizações, só um possível bug de "veio o cliente errado" dentro do
  mesmo `auth.users.id`, cenário que hoje não deveria existir.
- **Diferencia locador de locatário?** Não, e não deveria — a função só
  resolve "qual `cliente_id` é este usuário logado", de forma agnóstica ao
  tipo. A diferenciação é responsabilidade de cada política, que escolhe
  comparar contra `locador_id` ou `locatario_id` conforme a tabela.

Não alterei a função.

---

## 4. Proposta de políticas para o locador

Ver `supabase/migrations/20260714000000_portal_locador_rls.sql` (criado,
não aplicado). Resumo:

| Tabela | Nova política | Regra |
|---|---|---|
| `contratos` | `portal_locador` (SELECT) | `locador_id = get_portal_cliente_id()` |
| `demandas` | `portal_locador` (SELECT) | `locador_id = get_portal_cliente_id()` |
| `cobrancas` | `portal_locador_select` (SELECT) | `locador_id = get_portal_cliente_id()` |
| `imoveis` | `portal_leitura` (SELECT) | dono direto (`proprietario_id`) OU vínculo via `contratos` (locador ou locatário) |
| `vistorias` | `portal_leitura` (SELECT) | via `contratos.imovel_id = vistorias.imovel_id`, checando locador ou locatário |

Todas são **somente leitura** (`for select`). Nenhuma dá ao locador
permissão de `UPDATE`/`INSERT`/`DELETE` em nada — nem em `contratos`
(não pode alterar o próprio contrato), nem em `cobrancas` (não pode marcar
como pago nem mudar valor), nem em `demandas` (aprovar/recusar orçamento
precisa de uma função própria — ver Seção 7).

Um locador não consegue, com essas políticas:
- ver contratos, cobranças ou demandas de outro locador (a comparação é
  sempre contra o `cliente_id` do próprio `auth.uid()`);
- ver nada de outra organização (as tabelas continuam com `org_isolation`
  pro staff; o portal nunca usa esse caminho, usa `get_portal_cliente_id()`,
  que só resolve pra um `clientes.id` — e `clientes` de outra organização
  nunca teria `locador_id`/`locatario_id` apontando pra um contrato desta
  organização, por causa da FK);
- editar valor de contrato, cobrança ou demanda (só políticas de `SELECT`);
- acessar telas administrativas internas (isso é controlado pela própria
  aplicação — `app/(interno)/**` — não por RLS de dado).

---

## 5. Isolamento por organização — como cada camada se combina

- **Staff interno**: `organization_id = get_org_id()`, e `get_org_id()` só
  resolve pra quem tem linha em `users` (equipe interna). Portal nunca cai
  nesse caminho porque `usuario_portal_id` do cliente não é o mesmo
  `auth.uid()` de um funcionário.
- **Portal (locatário/locador)**: nunca depende de `organization_id`
  sozinho — sempre `locador_id`/`locatario_id`/`proprietario_id` = o
  `cliente_id` do próprio usuário logado, que por sua vez só existe dentro
  de UMA organização (a FK de `contratos.locador_id` aponta pra
  `clientes.id`, e cada `clientes` pertence a uma `organization_id` só).
  Ou seja: um cliente da organização A nunca consegue ver linha de
  organização B, porque nenhum contrato de B jamais vai ter
  `locador_id`/`locatario_id` apontando pro `clientes.id` dele.
- Isso satisfaz a exigência de não depender só de `organization_id` pro
  portal — a proteção real do portal é o vínculo direto de dono do
  registro, não a organização.

---

## 6. Revisão do locatário — riscos encontrados

O locatário consegue hoje (segundo as políticas encontradas):
- ✅ ler o próprio contrato (`contratos` → `portal_locatario`);
- ✅ ler as próprias cobranças (`cobrancas` → `portal_locatario_select`);
- ✅ ler e, em tese, **criar/editar/apagar** suas demandas
  (`demandas` → `portal_locatario`, `FOR ALL`);
- ⚠️ **atualizar campos que não deveria poder tocar**, em duas tabelas
  (ver riscos abaixo);
- ❌ hoje NÃO consegue ler imóvel nem vistoria (lacunas cobertas na Seção 4).

### 🔴 Risco R0 (mais grave) — `cobrancas.portal_locatario_update`

```sql
create policy portal_locatario_update on public.cobrancas
  for update using (locatario_id = get_portal_cliente_id())
  with check (locatario_id = get_portal_cliente_id());
```

Essa política restringe **qual linha** o locatário pode atualizar (a
própria), mas **não restringe quais colunas**. Um locatário autenticado
poderia, via uma chamada REST direta (não pelo app, mas pela API do
Supabase com o token dele), fazer um `PATCH` na própria cobrança e:
- marcar `status_cobranca = 'pago'` sem ter pago nada — **contorna
  completamente o webhook do Mercado Pago**;
- alterar `valor_aluguel`, `valor_total`, `valor_repasse` pra qualquer
  número;
- mexer em `status_repasse`, `data_pagamento`, `boleto_url`.

Isso bate direto num dos testes que você pediu na Seção 11
("locatário não altera valor"), e no dia a dia é o tipo de política que
some antes ninguém testar porque o app oficial nunca manda esse tipo de
PATCH — mas RLS não protege contra "o app não faz isso", protege contra
"o que a API permite", e essa API permite.

**Não alterei essa política.** Recomendo tratá-la como prioridade máxima
de correção, em uma migration própria e separada desta, com sua aprovação
explícita — reduzir pra `SELECT`-only (a confirmação de pagamento já é
feita corretamente pelo webhook, com service role, então o locatário não
deveria ter UPDATE nenhum aqui).

> **Atualizado 2026-07-15**: corrigido em
> `supabase/migrations/20260714010000_hardening_cobrancas_demandas.sql`
> (`drop policy if exists "portal_locatario_update" on public.cobrancas;`,
> sem recriar nenhum UPDATE pro locatário) — nome confirmado ao vivo,
> igual ao que este documento já apontava. **Ainda não aplicada.**

### 🔴 Risco R1 — `demandas.portal_locatario` (`FOR ALL`)

```sql
create policy portal_locatario on public.demandas
  for all using (locatario_id = get_portal_cliente_id());
```

Mesmo problema: `FOR ALL` sem `WITH CHECK` e sem restrição de coluna
libera, na prática, `UPDATE` em qualquer campo da própria demanda —
incluindo `orcamento`, `valor_final`, `status`, `autorizado_por`. Um
locatário poderia, em tese, aprovar a própria demanda sozinho
(`status = 'autorizada'`) ou inflar o orçamento.

**Não alterei.** Recomendo separar em duas políticas: uma `INSERT`
restrita (só campos de abertura: título, descrição, tipo, urgência, fotos
— e sempre com `locatario_id`/`contrato_id`/`imovel_id` batendo com o
próprio vínculo) e uma `SELECT`, removendo o `UPDATE`/`DELETE` genérico —
qualquer mudança de status/orçamento passa a exigir RPC (ver Seção 7).

> **Atualizado 2026-07-15**: corrigido em
> `supabase/migrations/20260714010000_hardening_cobrancas_demandas.sql`
> (`drop policy if exists "portal_locatario" on public.demandas;`, nome
> confirmado ao vivo) — substituída por `portal_locatario_select`
> (SELECT), `portal_locatario_insert` (INSERT com allowlist de campos +
> vínculo real de contrato) e `portal_locatario_update` (UPDATE só
> enquanto `status = 'aberta'`, mais uma trigger que bloqueia qualquer
> coluna fora de título/descrição/urgência/fotos). Sem DELETE. A
> aprovação/recusa pelo locador virou uma RPC dedicada (Seção 7 abaixo
> segue com a mesma recomendação), não um UPDATE direto. **Ainda não
> aplicada.**

> 🔴 **Atualizado de novo em 2026-07-15 (auditoria pós-merge, revisado)**:
> a correção acima, ao trocar `portal_locatario` por
> `portal_locatario_insert`, introduziu dois gaps não detectados na
> hora: (1) crítico — o `WITH CHECK` nunca validava `organization_id`,
> só `locatario_id`, permitindo um locatário inserir demanda em
> **outra organização** via REST direto; (2) adicional — `imovel_id`
> só era sobrescrito quando já vinha nulo do client, sobrevivendo sem
> validação se enviado junto com um `contrato_id` inválido. Corrigidos
> juntos em migration separada:
> `supabase/migrations/20260715000000_fix_portal_demanda_organization.sql`
> (branch `hotfix/rls-demandas-organization`) — a trigger
> `preencher_locador_demanda_portal` passa a **rejeitar o INSERT**
> quando `contrato_id` é nulo ou inválido (investigado: não existe
> fluxo de produto que crie demanda sem contrato, só um caso de borda
> de frontend — ver `docs/SECURITY_HARDENING_REVIEW.md`), e, quando o
> contrato é válido, sobrescreve incondicionalmente `locatario_id`,
> `organization_id`, `locador_id` e `imovel_id` — nunca aceita nenhum
> desses quatro campos do jeito que o client enviou. A policy passa a
> exigir os quatro (cinco, com `locador_id`) campos consistentes entre
> si. Detalhe completo em `docs/SECURITY_HARDENING_REVIEW.md`. **Ainda
> não commitada, não aplicada.**

### `portal_proprio_registro` em `clientes` — ok, mas leitura ampla da própria linha

`for select using (usuario_portal_id = auth.uid())`, sem restringir
colunas — o cliente lê a própria linha inteira, o que é esperado (é o
próprio cadastro dele). Não achei problema aqui.

---

## 7. Estratégia para demandas — escrita seletiva

Recomendação: **não fazer o app escrever direto em `demandas` para nada
além da criação inicial pelo locatário** (e mesmo essa, com colunas
restritas). Todo o resto — aprovação/recusa pelo locador, mudança de
status administrativo, definição de fornecedor/orçamento — deve passar
por uma **função RPC `security definer`** no Postgres, chamada via
`supabase.rpc(...)`. Ela valida a regra de negócio no servidor, onde RLS
sozinho não alcança (restrição por coluna, transições de estado válidas,
quem pode fazer o quê).

Funções sugeridas (ainda não criadas — proposta):

- `portal_criar_demanda(titulo, descricao, tipo, urgencia, contrato_id,
  fotos)` — valida que `contrato_id` pertence ao locatário chamador
  (via `get_portal_cliente_id()`), preenche `locatario_id`/`imovel_id`
  automaticamente a partir do contrato (o cliente nunca envia esses IDs
  direto), força `status = 'aberta'`.
- `portal_locador_decidir_demanda(demanda_id, decisao, justificativa)` —
  `decisao` só aceita `'autorizada'` ou `'recusada'`; valida que
  `demandas.locador_id = get_portal_cliente_id()` e que
  `status = 'aguardando_locador'` antes de mudar; nunca deixa o locador
  escrever em `orcamento`/`valor_final`/`fornecedor_id`.

Isso também resolve um ponto em aberto: a implementação que já construí
no portal (Fase 7 deste projeto, `app/portal/page.tsx`, funções
`aprovarDemanda`/`recusarDemanda`) hoje faz um
`supabase.from('demandas').update({status: ...})` **direto do cliente**.
Funciona hoje porque ainda não existe nenhuma política de `UPDATE`
restrita pro locador em `demandas` (só teria acesso de leitura, com a
proposta desta revisão) — ou seja, **assim que uma política de RLS mais
rígida for aplicada em `demandas`, esse fluxo do portal para de funcionar**
e precisa migrar pra uma chamada `supabase.rpc('portal_locador_decidir_demanda', ...)`.
Sinalizando aqui como próximo passo, não fiz essa mudança de código agora.

- Comentários (se quiserem virar uma funcionalidade separada, tipo chat
  na demanda): tabela nova `demandas_comentarios` (autor, demanda_id,
  texto, criado_em), com policy filtrando por
  `exists (select 1 from demandas d where d.id = demanda_id and
  (d.locador_id = get_portal_cliente_id() or d.locatario_id =
  get_portal_cliente_id()))`. Não existe hoje — só proposta.

---

## 8. Storage do bucket `documentos`

**Política atual** (já ligada, segundo a migration de referência):

```sql
create policy documentos_authenticated_all on storage.objects
  for all to authenticated
  using (bucket_id = 'documentos')
  with check (bucket_id = 'documentos');
```

Isso libera **qualquer usuário autenticado** — de qualquer organização,
locatário ou locador de qualquer imobiliária — a listar, ler, subir e
apagar **qualquer arquivo do bucket inteiro**, porque a condição só
checa `bucket_id`, nunca o caminho do arquivo. Não há isolamento por
organização, contrato ou papel na política em si.

**Achado mais crítico desta seção**: o código da aplicação usa
`getPublicUrl()` em **todos os lugares**, em nenhum lugar usa
`createSignedUrl()`. `getPublicUrl()` só faz sentido pra um bucket
**marcado como público** — e se o bucket é público, a política de RLS
acima **nem entra em jogo pra quem só tem a URL**: URLs de bucket público
respondem sem token nenhum, RLS de `storage.objects` só se aplica a
chamadas autenticadas via SDK (list/upload/download por API), não ao
fetch direto da URL pública. **Não tenho como confirmar isso sem acesso
ao painel** (é uma configuração no nível do bucket, não algo que apareça
no código) — mas o padrão de uso é um forte indício. Se for esse o caso,
qualquer CPF/RG/contrato/laudo já enviado tem uma URL que, uma vez
conhecida ou adivinhada, é baixável por qualquer pessoa, sem login.

O caminho atual dos arquivos:
```
contratos/{id_do_contrato}/kit/{categoria}/{arquivo}
vistorias/{organization_id}/{arquivo}
analises/{id_da_analise}/{arquivo}
chamados/{organization_id}/{arquivo}
logos/{organization_id}.{ext}
```

**Não é suficiente pra montar RLS seguro por usuário do portal**: o
`{id_do_contrato}` no caminho não carrega organização nem
locador_id/locatario_id — pra uma política de `storage.objects` filtrar
por dono, seria preciso fazer parsing do path (`storage.foldername(name)`)
e cruzar com `contratos`, o que é frágil (qualquer mudança de convenção de
pasta quebra a policy) e ainda não resolve o problema de fundo se o bucket
for público.

**Recomendação** (nenhuma implementada agora):
1. Confirmar no painel do Supabase se o bucket `documentos` está marcado
   como público ou privado — isso muda tudo.
2. Se estiver público: tornar privado, e trocar todo uso de
   `getPublicUrl()` por `createSignedUrl()` com expiração curta (ex.: 5-15
   minutos), **gerada numa API Route do servidor** (não no client), que
   valida antes o vínculo do usuário logado com aquele contrato/pasta —
   mesmo modelo que já existe hoje pra outras coisas sensíveis do projeto.
3. Não tentar resolver isso só com RLS de `storage.objects` — o
   parsing de path é frágil demais pro nível de granularidade que vocês
   precisam (por contrato, por papel). Prefira o modelo de URL assinada
   gerada no servidor.
4. Não tornar o bucket público de propósito, nem manter assim se já
   estiver.

Não alterei a policy nem o bucket.

---

## 9. Migration criada (aguardando aprovação)

`supabase/migrations/20260714000000_portal_locador_rls.sql` — criada
neste commit, **não aplicada**. Conteúdo:
- 5 políticas novas de `SELECT`, idempotentes (`drop policy if exists` +
  `create policy`, cada uma só do próprio nome novo).
- Não remove nem modifica nenhuma política existente.
- Não mexe em Storage.
- Não cria função nova (reaproveita `get_portal_cliente_id()` já
  existente).

---

## 10. Testes necessários (antes de aplicar em produção)

Matriz de usuários fictícios (a criar num ambiente de teste, nunca com
dado real de cliente):

| Usuário | Organização | Tipo |
|---|---|---|
| Locador A | Org 1 | locador |
| Locador B | Org 1 (ou Org 2, testar os dois casos) | locador |
| Locatário A | Org 1 | locatario |
| Locatário B | Org 1 | locatario |
| Staff Org 1 | Org 1 | interno |
| Staff Org 2 | Org 2 | interno |

Testes mínimos (todos como `SELECT` via cliente autenticado, nunca via
service role):

1. Locador A não vê contratos/cobranças/demandas do Locador B.
2. Locatário A não vê contratos/cobranças/demandas do Locatário B.
3. Cliente da Org 1 não vê nenhuma linha de Org 2 (contrato, cobrança,
   imóvel, vistoria).
4. Locador vê exatamente os contratos onde é `locador_id`, nem mais nem
   menos.
5. Locatário vê exatamente o(s) contrato(s) onde é `locatario_id`.
6. Locatário tenta `UPDATE` em `cobrancas.status_cobranca` ou
   `valor_aluguel` da própria cobrança → **hoje passaria (Risco R0)** —
   este teste deve falhar até a correção separada ser aplicada; depois da
   correção, deve ser negado.
7. Locador tenta `UPDATE` em `cobrancas` (qualquer campo) → deve ser
   negado (a proposta desta migration não dá UPDATE nenhum ao locador).
8. Usuário não autenticado (`anon`) não lê nada em nenhuma das tabelas
   revisadas.
9. Links de documentos: confirmar se expiram (só se aplica depois da
   migração pra signed URL — hoje, se o bucket for público, não expiram
   nunca, o que também é um resultado de teste a registrar).
10. Tentativa de acessar dado sem vínculo (ex.: locador tentando ler um
    contrato pelo ID de um contrato que não é dele) retorna vazio/negado,
    não erro 500 nem vazamento parcial.

Ambiente recomendado: rodar esses testes num projeto Supabase de
homologação (ou branch de banco, se o plano do Supabase suportar),
nunca direto em produção.

---

## 11. Plano de rollback

Como a migration proposta só **adiciona** políticas novas (nenhum
`ALTER`/`DROP` em política existente, nenhuma mudança de dado), o
rollback é simples: `DROP POLICY` das 5 políticas criadas, pelo nome:

```sql
drop policy if exists "portal_locador" on public.contratos;
drop policy if exists "portal_locador" on public.demandas;
drop policy if exists "portal_locador_select" on public.cobrancas;
drop policy if exists "portal_leitura" on public.imoveis;
drop policy if exists "portal_leitura" on public.vistorias;
```

Isso não afeta o funcionamento atual do site nem do portal do locatário
em produção — reverte só o que essa migration teria adicionado.

---

## 12. Confirmações finais

- ✅ Nada foi aplicado ao Supabase.
- ✅ Nenhuma policy existente foi removida ou alterada.
- ✅ Nenhuma service role foi usada para contornar permissão de leitura
  de dado de aplicação (a chave de serviço só foi usada, em fases
  anteriores desta sessão, num script local de limpeza de storage já
  aprovado e concluído — não nesta análise).
- ✅ Nenhum RLS foi desativado.
- ✅ Nenhuma migration foi executada — só criada como arquivo, pra
  revisão.
- ⚠️ A Seção 1 (políticas reais) é baseada no arquivo de migration
  encontrado no histórico do `main`, **não confirmada ao vivo no
  Supabase** — precisa de verificação direta antes de qualquer decisão
  final.
