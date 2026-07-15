# Revisão de segurança — RLS para o Admeasy Connect (hardening)

**Nada foi aplicado ao Supabase. Nenhuma policy existente ao vivo foi
alterada. Nenhum RLS foi desativado. Nenhuma service role foi usada para
ler ou alterar dado de aplicação. Nenhum commit, push ou deploy foi
feito.** Este documento consolida a análise, a estratégia em duas etapas e
os artefatos criados, aguardando aprovação.

## 🟢 Addendum — nomes reais de `cobrancas`/`demandas` confirmados ao vivo (2026-07-15)

Você rodou a consulta somente-leitura em `pg_policies` que eu pedi no
addendum anterior. Resultado:

```
cobrancas:
  org_isolation           — ALL
  portal_locatario_select — SELECT
  portal_locatario_update — UPDATE

demandas:
  org_isolation    — ALL
  portal_locatario — ALL
```

### Resultado da checagem: SQL já estava correto, nada precisou mudar

Os dois `drop policy if exists` em
`20260714010000_hardening_cobrancas_demandas.sql` já usavam exatamente
esses nomes:
```sql
drop policy if exists "portal_locatario_update" on public.cobrancas;
...
drop policy if exists "portal_locatario" on public.demandas;
```
Não é coincidência — esses nomes vieram originalmente de
`20260712000000_habilitar_rls.sql` (que os cria) e a migration de
hardening sempre assumiu esse arquivo como fonte da verdade. A live
confirmation elimina o risco que eu tinha sinalizado como bloqueador
nº1 ("`DROP POLICY IF EXISTS` com nome errado não erra, só não remove
nada, e a policy antiga insegura continua ativa em paralelo via OR") —
**esse risco não se materializou**: os nomes batem exatamente.

Nenhuma linha de SQL precisou ser alterada nos três arquivos de
migration por causa desta confirmação. Revisei os três mesmo assim
(ver abaixo) — não há nenhuma outra referência a esses nomes de policy
em lugar nenhum que precisasse de ajuste.

### Verificação pedida: combinação com `org_isolation` via OR

`org_isolation` em `cobrancas` e `demandas` é `FOR ALL USING
(organization_id = get_org_id())` — permissiva, combina por OR com
`portal_locatario_select`/`portal_locatario_update`/`portal_locatario`
(e, depois de aplicada, com as três policies novas do hardening).
Postgres combina múltiplas policies permissivas do mesmo comando com
OR — ou seja, uma linha é visível/editável se **qualquer uma** das
policies aplicáveis permitir.

`get_org_id()` = `select organization_id from public.users where id =
auth.uid()`. `get_portal_cliente_id()` = `select id from
public.clientes where usuario_portal_id = auth.uid()`. Uma delas só
retorna não-nulo se existir a linha correspondente para aquele
`auth.uid()` — `users` pra staff, `clientes.usuario_portal_id` pra
portal.

**Se as duas nunca retornam não-nulo para o mesmo `auth.uid()`
simultaneamente**, a combinação OR não introduz nenhum acesso
inesperado: uma sessão de portal nunca satisfaz `org_isolation` (porque
`get_org_id()` dá null pra ela), e uma sessão de staff nunca satisfaz
as policies de portal (porque `get_portal_cliente_id()` dá null pra
ela). Cada sessão efetivamente só "ativa" o conjunto de policies do seu
próprio papel — é exatamente o comportamento pretendido.

**Isso depende inteiramente de não existir colisão entre `users.id` e
`clientes.usuario_portal_id`** — analisado abaixo.

### Verificação pedida: `get_org_id()` pode retornar organização para usuário do portal?

Rastreei os dois únicos pontos do código que criam identidade de auth
e vinculam a `users` ou a `clientes.usuario_portal_id`:

- **Staff** — `app/api/cadastro/route.ts`: chama
  `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm:
  true })` (linha 43) **sempre criando um usuário novo**, e só insere em
  `public.users` (linha 83) se essa criação for bem-sucedida. Se o
  e-mail já existir no Supabase Auth, a chamada falha e o código já
  trata isso explicitamente (`erroAuth?.code === 'email_exists'`,
  linha 50) — nunca chega a inserir em `users`.
- **Portal** — `app/api/portal/gerenciar-acesso/route.ts`: mesma
  chamada (`auth.admin.createUser`, linha 86), só quando
  `cliente.usuario_portal_id` ainda é nulo (linha 73), **sempre criando
  um usuário novo** também. Se falhar (inclusive por e-mail já
  existente), retorna erro e não grava `usuario_portal_id` (linha 92).
- Busquei todos os `INSERT` em `public.users` no código
  (`grep -rn "from('users').insert"`) — existe exatamente um, o de
  `cadastro/route.ts` citado acima, e ele nunca reaproveita um id que
  já existe em outro lugar.

**Conclusão da análise estática**: não encontrei nenhum caminho de
código que possa fazer um `auth.uid()` acabar em `public.users.id` E em
`clientes.usuario_portal_id` ao mesmo tempo — os dois fluxos de
provisionamento sempre criam uma identidade nova no Supabase Auth
(que exige e-mail único por padrão), nunca reaproveitam uma existente
para o papel oposto.

**🟡 Risco residual, documentado explicitamente como pedido**: essa
garantia vem inteiramente do código da aplicação e da constraint de
e-mail único do Supabase Auth — nenhuma das duas é verificável por
análise estática de 100% das formas como uma linha pode parar nessas
tabelas (ex.: inserção manual via SQL Editor, script administrativo
futuro, migração de dados que ignore esse cuidado). Recomendo rodar,
antes de aplicar `20260714010000` em produção, esta consulta
**somente leitura**:

```sql
select u.id, u.email, c.id as cliente_id, c.nome as cliente_nome
from public.users u
join public.clientes c on c.usuario_portal_id = u.id;
```

Resultado esperado: **zero linhas**. Se retornar alguma linha, isso
confirma o cenário de risco descrito acima — a pessoa nessa linha teria
`get_org_id()` E `get_portal_cliente_id()` não-nulos na mesma sessão,
e enxergaria dados por `org_isolation` (todos os dados da organização,
não só os próprios) misturados com o acesso de portal. Nesse caso, a
migration de hardening não deveria ser aplicada até esse dado ser
corrigido (redefinir o acesso de portal dessa pessoa com um novo
`auth.uid()`, não reaproveitando o do staff).

### Revisão dos outros dois arquivos

- **`20260714000000_portal_locador_rls.sql`**: não referencia
  `portal_locatario` nem `portal_locatario_update` em nenhum ponto —
  só cria políticas novas (`portal_locador`, `portal_locador_select`,
  `portal_leitura`), todas com `drop policy if exists` do próprio nome.
  Nenhuma mudança necessária.
- **`20260714020000_rpc_decisao_demanda.sql`**: não referencia nomes de
  policy (é uma função `security definer`, autorização acontece dentro
  da função, não via RLS). A premissa documentada no cabeçalho ("o
  locador só tem SELECT em demandas via RLS") permanece válida com o
  estado confirmado — `demandas` hoje só tem `org_isolation` e
  `portal_locatario` (locatário), nenhuma policy de locador ainda
  aplicada. Nenhuma mudança necessária.

### Status atualizado da Fase B

**As migrations em si não precisaram de nenhuma correção** — os nomes
já estavam certos. O que falta antes de aplicar em produção:
1. Rodar a consulta de colisão acima (zero linhas esperadas).
2. Remover a linha redundante de update em `cobrancas` no frontend
   (já documentada nas seções anteriores deste arquivo).
3. Confirmar em staging que operações internas da imobiliária
   continuam funcionando por `org_isolation` (sem mudança nela, mas
   vale testar depois de `portal_locatario_update` sair de cena).
4. Confirmar que service role (webhooks do Mercado Pago,
   `/api/boleto`, crons) continua fora do escopo de RLS — é
   estruturalmente garantido (service role sempre ignora RLS,
   independente de qualquer policy), não depende de nenhuma mudança
   deste pacote.

## 🟡 Addendum — achado de vistorias corrigido + API Routes de staff preparadas (2026-07-14, segunda rodada)

Continuação do addendum abaixo. Nada aplicado, commitado ou deployado.

1. **`vistorias.ambientes[].fotos[]` corrigido** — tinha o mesmo bug de
   URL pública persistida que `demandas.fotos` tinha (sinalizado no
   addendum anterior como "achado novo, não corrigido"). Corrigido em
   `app/(interno)/vistorias/nova/page.tsx` (grava path, preview local) e
   `app/(interno)/vistorias/[id]/page.tsx` (galeria em tela resolve
   signed URL; geração de PDF do laudo não faz mais `fetch()` direto na
   URL salva — resolve signed URL pelo servidor primeiro, nunca grava
   essa signed URL em lugar nenhum). Criado
   `scripts/migrar-fotos-vistorias.mjs` para dados antigos — dry-run,
   **não executado**.
2. **API Routes de upload/exclusão administrativa preparadas** —
   `app/api/documentos/upload/route.ts` e
   `app/api/documentos/excluir/route.ts`, staff-only, validação real de
   organização via `contratos`/`analises_cadastrais`. **Não religadas a
   nenhuma tela ainda** — só preparadas.
3. **`documentos_upload_staff`/`documentos_delete_staff` marcadas
   explicitamente como PROVISÓRIAS** na migration
   `20260714040000_storage_remover_policy_publica.sql` — banner
   explícito, não aprovadas como desenho final de produção, existem só
   pra não deixar staff sem caminho de upload/exclusão enquanto o
   frontend não foi trocado pras API Routes acima.
4. Checklist funcional de 13 cenários preparada em
   `docs/STORAGE_PRIVATE_MIGRATION_PROPOSAL.md`, Seção 9 — nenhum
   executado (sem ambiente Supabase ativo nesta sessão).

Detalhe completo nas Seções 0.2 e 0.5 (atualizada) de
`docs/STORAGE_PRIVATE_MIGRATION_PROPOSAL.md`.

## 🟡 Addendum — correção dos 3 bloqueadores da auditoria final de Storage (2026-07-14)

A auditoria estática final da rota `app/api/documentos/url-assinada` +
das duas migrations de Storage (registrada no addendum anterior a este
e detalhada em `docs/STORAGE_PRIVATE_MIGRATION_PROPOSAL.md`) apontou 3
bloqueadores para aprovação. Os três foram corrigidos — nada aplicado,
commitado ou deployado. Detalhe completo na Seção 0 de
`docs/STORAGE_PRIVATE_MIGRATION_PROPOSAL.md`; resumo aqui:

1. **`demandas.fotos` gravava URL pública permanente**, não path —
   corrigido em `app/portal/page.tsx` (grava path, preview local via
   blob, exibição via signed URL sob demanda). Suporta os dois formatos
   (path novo e URL legada). Criado
   `scripts/migrar-fotos-demandas.mjs` para converter dados antigos —
   dry-run por padrão, **não executado**.
2. **Migration `20260714040000` não era idempotente** — faltava
   `drop policy if exists` antes de cada `create policy`, o que faria a
   segunda execução falhar e deixar o banco em estado parcial.
   Corrigido, e aproveitado para redesenhar as policies de
   upload/exclusão por papel (staff / locatário-só-chamado / nenhuma
   para locador, sem DELETE amplo — ver Seção 0.5 do documento de
   Storage).
3. **MIME de Word ausente** em `20260714030000` — quebraria upload em
   2 dos 7 fluxos reais (`analise-cadastral`, anexo de chamado no
   portal). Adicionado `application/msword` e o MIME do `.docx`.

Achado novo, **não corrigido nesta rodada**: `vistorias.ambientes[].fotos[]`
tem o mesmo bug de URL pública persistida que `demandas.fotos` tinha, e
`app/(interno)/vistorias/[id]/page.tsx` (geração de PDF do laudo) faz
`fetch()` direto nessa URL — um 8º ponto de uso do bucket fora do
inventário original de 7 telas. Sinalizado para correção antes do
bucket virar privado, fora do escopo desta entrega (ver Seção 0.2 do
documento de Storage).

A rota `url-assinada` também foi reforçada: validação por registro real
para `chamados`/`vistorias` (antes só checava organização), allowlist
de extensão, checagem de MIME real do objeto quando disponível.

## 🔴 Addendum — Risco R3 (Storage) CONFIRMADO ao vivo (2026-07-14)

O que antes era "indício forte" na Seção 8/no documento de Storage agora
é **fato confirmado**, via consulta direta feita por você no painel do
Supabase:

```
storage.buckets:
  id = documentos
  public = true          <- CONFIRMADO: bucket é público
  file_size_limit = NULL <- sem limite de tamanho de arquivo
  allowed_mime_types = NULL <- sem restrição de tipo de arquivo

storage.objects policy "documentos_authenticated_all":
  role = authenticated, command = ALL
  USING / WITH CHECK: bucket_id = 'documentos'  <- confirma que a RLS
  de storage.objects não restringe por dono/organização/contrato
```

**Consequência prática, agora confirmada e não mais hipotética**: qualquer
pessoa com uma URL do bucket `documentos` — mesmo sem estar logada —
consegue baixar o arquivo, porque bucket público responde direto pela CDN
do Storage, sem passar pela política de `storage.objects` (essa só
governa list/upload/download/delete via SDK autenticado, não o fetch
direto da URL pública). Isso vale pra todos os documentos de CPF, RG,
contratos assinados e apólices já enviados até hoje. Além disso, sem
`file_size_limit`/`allowed_mime_types`, o bucket aceita upload de qualquer
tipo e tamanho de arquivo — risco secundário de abuso (custo de
armazenamento, upload de arquivo executável/malicioso).

Pacote completo de correção preparado (nenhuma parte aplicada) em
`docs/STORAGE_PRIVATE_MIGRATION_PROPOSAL.md`.

## Addendum — auditoria final antes do commit (2026-07-14)

Numa segunda passada, só estática, sobre os próprios arquivos de
migration já criados, encontrei e **corrigi diretamente nos arquivos**
(ainda não aplicados) dois problemas reais:

1. **Trigger de proteção de `demandas` estava incompleta** — a primeira
   versão listava colunas *proibidas* (denylist) e esqueceu várias
   colunas reais da tabela (`numero`, `tipo`, `local_imovel`, `origem`,
   `data_abertura`, `data_conclusao`, `prazo_estimado`, `observacoes`) —
   ou seja, um locatário ainda conseguiria alterar `data_conclusao`
   (conclusão administrativa) ou `prazo_estimado`, por exemplo. Reescrita
   como *allowlist* (só título/descrição/urgência/fotos passam; qualquer
   outra coluna, inclusive futuras, fica bloqueada por padrão).
2. **`demandas.locador_id` não era validado no INSERT** — um client
   malicioso poderia enviar qualquer `cliente_id` nesse campo. Adicionei
   uma trigger `BEFORE INSERT` que recalcula `locador_id` (e `imovel_id`,
   se ausente) a partir do `contrato_id` real, ignorando qualquer valor
   enviado pelo cliente — só para usuários do portal, staff continua
   controlando manualmente.

Também criei `supabase/migrations/20260714020000_rpc_decisao_demanda.sql`
(função `portal_locador_decidir_demanda`, RPC de aprovar/recusar — ver
Seção 9 abaixo) e identifiquei um **risco operacional que não é sobre
SQL**: os `DROP POLICY ... IF EXISTS` das duas migrations assumem que sei
o nome exato das políticas hoje ao vivo. Se o nome real for diferente
(por qualquer motivo — aplicado manualmente, renomeado etc.), o `DROP`
não erra, só não faz nada — **e a política antiga e insegura continua
ativa, coexistindo com as novas mais restritas**, porque políticas
permissivas de RLS se combinam por OR. Ou seja: aplicar esta migration
sem confirmar o nome exato ao vivo pode dar falsa sensação de segurança.
Ver Seção 9 (entrega) para o detalhamento completo item a item.

Continuação de `docs/MOBILE_APP_RLS_REVIEW.md` (análise anterior) — aqui o
foco é: revisar tecnicamente a migration do locador já proposta, e
detalhar a correção dos dois riscos mais graves encontrados naquela
análise (`cobrancas.portal_locatario_update` e `demandas.portal_locatario`).

---

## 1. Riscos confirmados pelo código (alta confiança)

Estes eu confirmei lendo o código real da aplicação, não só o arquivo de
migration — então a confiança é maior que "está escrito na migration":

### 🔴 R0 — `cobrancas`: locatário pode alterar status de pagamento e valores

A policy `portal_locatario_update` (`for update using (locatario_id =
get_portal_cliente_id()) with check (locatario_id = get_portal_cliente_id())`)
não restringe **coluna nenhuma** — só a linha. Um locatário autenticado
poderia, via chamada direta à API REST do Supabase (não precisa nem ser
pelo app oficial), fazer `PATCH` na própria cobrança e mudar
`status_cobranca` pra `'pago'`, ou qualquer valor (`valor_aluguel`,
`valor_repasse`, `boleto_url` etc.), sem passar pelo webhook do Mercado
Pago.

**Confirmado no código**: o único `UPDATE` de `cobrancas` feito pelo
portal hoje (`app/portal/page.tsx`, função `gerarBoleto`) é:
```ts
await supabase.from('cobrancas').update({ mp_payment_id: data.id }).eq('id', c.id)
```
E é **redundante** — a rota `/api/boleto` (`app/api/boleto/route.ts`,
linhas 141-147) já persiste esse mesmo campo (e mais quatro:
`boleto_url`, `boleto_linha_digitavel`, `pix_qr_code`,
`pix_qr_code_base64`) usando a service role, **antes** de responder ao
client. Ou seja: **remover essa policy não depende de nenhuma
funcionalidade legítima que hoje só funciona por causa dela** — a única
coisa que quebra é uma escrita redundante que já não fazia diferença.

### 🔴 R1 — `demandas`: `FOR ALL` sem restrição de coluna

Mesmo padrão de problema. A policy `portal_locatario` é `for all` — cobre
SELECT, INSERT, UPDATE e DELETE numa condição só, sem `with check`
separado nem restrição de coluna. Um locatário poderia, em tese, dar
UPDATE na própria demanda mudando `status`, `orcamento`, `valor_final`,
`fornecedor_id`, `autorizado_por` — ou seja, aprovar a própria demanda ou
inflar o orçamento sozinho.

### 🟡 Achado adicional (não é risco de segurança, é gap funcional)

Ao mapear exatamente o que o formulário do portal grava, encontrei dois
problemas que fazem o **fluxo de aprovação pelo locador (que eu já havia
construído na Fase 7) não funcionar na prática hoje**, independente de
RLS:

1. **`demandas.locador_id` nunca é preenchido** quando o locatário cria
   uma demanda pelo portal (`FormularioDemanda`, insert em
   `app/portal/page.tsx`) — só `locatario_id`. Sem `locador_id`
   preenchido, nenhuma política `locador_id = get_portal_cliente_id()`
   jamais mostraria essa demanda pro locador.
2. **Nenhum código do sistema hoje transiciona uma demanda pro status
   `'aguardando_locador'`** — nem o formulário interno de staff (só
   transita `aberta→deferida/indeferida` e `deferida→em_execucao→concluida`),
   nem o portal do locatário. É um status que existe no `CHECK` da coluna
   e nas legendas da UI, mas nenhum caminho de código o define.

**Consequência**: mesmo aplicando a migration do locador com sucesso, a
aba "Solicitações" do portal do locador continuaria vazia até essas duas
lacunas de aplicação serem corrigidas. Isso está fora do escopo desta
migration de RLS — é mudança de fluxo de produto, sinalizando aqui como
próximo passo.

---

## 2. Riscos que ainda dependem de confirmação ao vivo

Ver `docs/MOBILE_APP_RLS_REVIEW.md`, seção "Limitação importante desta
análise" — sem sessão do Supabase CLI nem acesso direto ao Postgres, não
consigo consultar `pg_policies` nem configuração de bucket ao vivo.
Continuam pendentes de confirmação direta no painel do Supabase:

1. **Se `supabase/migrations/20260712000000_habilitar_rls.sql` já foi
   aplicada em produção** — toda a análise de "estado atual" parte do
   texto desse arquivo, que traz o aviso "ainda não aplicado" na data em
   que foi escrito.
2. ~~Se o bucket `documentos` está marcado como público~~ — **CONFIRMADO
   ao vivo em 2026-07-14: `public = true`.** Ver addendum no topo deste
   documento e `docs/STORAGE_PRIVATE_MIGRATION_PROPOSAL.md`.
3. **Se existe constraint `UNIQUE` em `clientes.usuario_portal_id`** — não
   encontrada em nenhum `schema.sql`, relevante pro comportamento de
   `get_portal_cliente_id()` em caso de dado duplicado.
4. Qualquer política que exista ao vivo e **não** esteja no arquivo de
   migration encontrado (ex.: se alguém aplicou algo direto pelo painel do
   Supabase, sem passar por um arquivo de migration versionado).

---

## 3. Operações que deixariam de funcionar após a correção (Etapa 1)

| Operação | Antes | Depois | Impacto real |
|---|---|---|---|
| Locatário: `UPDATE` em `cobrancas` (qualquer campo, incluindo `status_cobranca`, valores) | Permitido pela RLS (não deveria estar sendo usado assim, mas a API permite) | Bloqueado — nenhuma policy de UPDATE pro portal em `cobrancas` | **Nenhum**, confirmado — o único UPDATE do app é redundante (Seção 1, R0) |
| Locatário: `UPDATE` em `demandas` mudando `orcamento`/`valor_final`/`fornecedor_id`/`status`/`autorizado_por` | Permitido pela RLS | Bloqueado pela trigger `proteger_colunas_demanda_portal` | **Nenhum uso legítimo hoje** — a UI nunca oferece esses campos pro locatário editar |
| Locatário: `UPDATE` em `demandas` mudando `titulo`/`descricao`/`urgencia`/`fotos`, só enquanto `status = 'aberta'` | Permitido | **Continua permitido** — política nova replica exatamente essa regra | Nenhum |
| Locatário: `INSERT` de nova demanda | Permitido (sem restrição de valores) | Continua permitido, mas com `WITH CHECK` forçando `status='aberta'`, `origem='locatario'`, campos financeiros nulos, e o contrato pertencer a ele | Nenhum — é exatamente o que o formulário já envia hoje |

---

## 4. Mudanças necessárias no frontend e backend

**Nenhuma foi implementada nesta revisão** — só identificadas, como pedido.

### Frontend (`app/portal/page.tsx`)

1. **Remover a linha redundante** em `gerarBoleto`:
   ```ts
   await supabase.from('cobrancas').update({ mp_payment_id: data.id }).eq('id', c.id)
   ```
   Ela para de funcionar assim que a policy de UPDATE for removida (é
   esperado — o dado já foi salvo pela API Route). Removê-la evita um erro
   de RLS visível pro usuário (mesmo não afetando o resultado final, hoje
   o erro seria silenciosamente ignorado porque o retorno não é checado,
   mas é código morto que vale limpar).

2. **Preencher `locador_id` ao criar uma demanda** (`FormularioDemanda`,
   insert): buscar o `locador_id` do contrato selecionado (mesmo padrão
   já usado no formulário interno, `app/(interno)/demandas/page.tsx`
   linha 249) e incluir no payload do insert. Sem isso, a política de
   leitura do locador nunca encontra nada mesmo depois de aplicada.

3. **`PainelLocador.aprovarDemanda`/`recusarDemanda`** (que eu já
   construí na Fase 7) fazem hoje um `update({status: ...})` direto do
   client. Uma vez que a Etapa 2 desta revisão só concede `SELECT` ao
   locador (sem UPDATE), **esse fluxo para de funcionar** assim que a
   migration do locador for aplicada — precisa migrar pra uma função RPC
   (`security definer`) antes ou junto da aplicação da migration, senão o
   botão "Aprovar orçamento"/"Recusar" do portal do locador quebra.

### Backend (novo)

4. **RPC `portal_locador_decidir_demanda(demanda_id, decisao,
   justificativa)`** — valida que quem chama é o `locador_id` daquela
   demanda, que o status atual é `'aguardando_locador'`, e só então
   atualiza `status` pra `'autorizada'`/`'recusada'` (mais
   `motivo_recusa`/`data_autorizacao`/`autorizado_por` conforme o caso).
   Não existe ainda.

5. **Algum ponto do fluxo precisa passar a definir `status =
   'aguardando_locador'`** — hoje nenhum existe (achado da Seção 1). Fica
   como decisão de produto: é automático assim que o staff "defere" uma
   demanda com um orçamento definido? É uma ação manual do staff? Não
   decidi isso por vocês, só sinalizando que falta.

6. **API Route de URL assinada** para o bucket `documentos` — ver
   `docs/STORAGE_PRIVATE_MIGRATION_PROPOSAL.md`, seção 4.2.

---

## 5. Migrations propostas (criadas, não aplicadas)

| Arquivo | Conteúdo |
|---|---|
| `supabase/migrations/20260714000000_portal_locador_rls.sql` | Etapa 2 — leitura do locador. **Revisado nesta rodada**: adicionei uma função `get_portal_organization_id()` e uma checagem explícita de `organization_id` em cada policy, como camada extra de isolamento além do vínculo direto por `locador_id`/`proprietario_id`. Continua estritamente `SELECT`, sem UPDATE/INSERT/DELETE. |
| `supabase/migrations/20260714010000_hardening_cobrancas_demandas.sql` | Etapa 1 — remove `cobrancas.portal_locatario_update`; substitui `demandas.portal_locatario` (FOR ALL) por três políticas (`select`/`insert`/`update`) mais uma trigger `proteger_colunas_demanda_portal` que bloqueia qualquer usuário do portal (locatário ou, futuramente, locador) de alterar colunas administrativas/financeiras em `demandas`, mesmo dentro do UPDATE permitido. |

Ambos os arquivos têm dependência um do outro? **Não** — são
independentes, podem ser aplicados em qualquer ordem (ou só um dos dois),
desde que `20260712000000_habilitar_rls.sql` já esteja aplicado antes de
qualquer um.

Ordem recomendada de aplicação, quando aprovado: primeiro a migration de
hardening (Etapa 1, remove risco existente), rodar os testes da Seção 6,
só depois a migration do locador (Etapa 2, adiciona superfície nova) —
junto com a correção de frontend (RPC de decisão, preenchimento de
`locador_id`), senão o botão do portal do locador quebra silenciosamente.

---

## 6. Plano de testes

### Etapa 1 (hardening)

1. Locatário autenticado tenta `PATCH` `cobrancas.status_cobranca` da
   própria cobrança → deve ser negado após a migration (hoje passa).
2. Locatário tenta `PATCH` `cobrancas.valor_aluguel` → negado.
3. Locatário edita a própria demanda `aberta` mudando só `titulo` →
   continua funcionando.
4. Locatário tenta mudar `orcamento`/`status`/`fornecedor_id` da própria
   demanda → a trigger deve levantar exceção.
5. Locatário cria uma demanda nova, tenta enviar `orcamento` preenchido no
   próprio insert → bloqueado pelo `WITH CHECK`.
6. Locatário cria uma demanda pra um `contrato_id` que não é dele →
   bloqueado pelo `WITH CHECK`.
7. Staff interno continua editando `demandas` (qualquer campo) e
   `cobrancas` normalmente — a trigger não deve disparar pra staff (checar
   explicitamente, é a premissa mais importante de não quebrar o sistema
   atual).
8. Fluxo real de gerar boleto pelo portal (locatário) continua
   funcionando de ponta a ponta mesmo sem o UPDATE de `mp_payment_id` no
   client (a API Route já persiste).

### Etapa 2 (locador) — retomando a matriz da revisão anterior

Locador A / Locador B / Locatário A / Locatário B / Staff Org 1 / Staff
Org 2 (ver `docs/MOBILE_APP_RLS_REVIEW.md`, Seção 10, para a lista
completa) — reforçando os itens específicos desta rodada:

9. Locador tenta `UPDATE`/`INSERT`/`DELETE` em `contratos`, `demandas` ou
   `cobrancas` → negado em todos os casos (nenhuma policy de escrita
   existe pra ele).
10. Locador A não vê `imoveis`/`vistorias` do Locador B, mesmo estando na
    mesma organização.
11. Depois de corrigido o preenchimento de `locador_id` e existir algum
    caminho pra `aguardando_locador`: locador vê a demanda referente ao
    próprio imóvel, com orçamento e prazo, e consegue (via RPC, não via
    RLS direto) aprovar/recusar.

Ambiente recomendado: projeto de homologação separado, nunca direto em
produção — mesma recomendação da revisão anterior.

---

## 7. Plano de rollback

Como as duas migrations só adicionam/substituem políticas próprias (sem
tocar em `org_isolation` nem em nenhuma outra política pré-existente que
não seja `cobrancas.portal_locatario_update` e `demandas.portal_locatario`),
o rollback é direto:

```sql
-- Reverter a migration de hardening (Etapa 1)
drop policy if exists "portal_locatario_select" on public.demandas;
drop policy if exists "portal_locatario_insert" on public.demandas;
drop policy if exists "portal_locatario_update" on public.demandas;
drop trigger if exists trg_proteger_colunas_demanda_portal on public.demandas;
drop function if exists public.proteger_colunas_demanda_portal();

-- Recria a policy antiga de demandas (só se precisar voltar ao estado
-- de antes — não recomendado, é o estado com o Risco R1)
create policy "portal_locatario" on public.demandas
  for all using (locatario_id = public.get_portal_cliente_id());

-- Recria a policy antiga de cobrancas (idem, só se necessário — é o
-- estado com o Risco R0)
create policy "portal_locatario_update" on public.cobrancas
  for update using (locatario_id = public.get_portal_cliente_id())
  with check (locatario_id = public.get_portal_cliente_id());
```

```sql
-- Reverter a migration do locador (Etapa 2)
drop policy if exists "portal_locador" on public.contratos;
drop policy if exists "portal_locador" on public.demandas;
drop policy if exists "portal_locador_select" on public.cobrancas;
drop policy if exists "portal_leitura" on public.imoveis;
drop policy if exists "portal_leitura" on public.vistorias;
drop function if exists public.get_portal_organization_id();
```

Nenhuma das duas reversões apaga dado — só políticas, função e trigger.

---

## 8. Confirmações finais

- ✅ Nada foi aplicado ao Supabase.
- ✅ Nenhuma policy existente ao vivo foi alterada (as duas migrations
  criadas nesta sessão, ainda não aplicadas, não contam como "existente
  ao vivo").
- ✅ Nenhum RLS foi desativado.
- ✅ Nenhuma service role foi usada para ler ou alterar dado de
  aplicação — só para leitura de código-fonte local (não houve nenhuma
  chamada ao Supabase nesta análise).
- ✅ Nenhum commit, push ou deploy foi feito.
- ⚠️ Toda a Seção 1 (e a análise anterior) depende de confirmação ao vivo
  no painel do Supabase antes de qualquer aplicação — ver Seção 2.
