# Proposta — tornar o bucket `documentos` privado

**Nada foi aplicado. Nenhum commit, push ou deploy foi feito. O bucket
continua público e a policy `documentos_authenticated_all` continua
ativa exatamente como está.** Este documento descreve o pacote completo
de correção, para revisão e aprovação.

## 🔴 Status: risco confirmado ao vivo (2026-07-14)

Você consultou diretamente o Supabase e confirmou:

```
storage.buckets:
  id = documentos
  public = true
  file_size_limit = NULL
  allowed_mime_types = NULL

storage.objects policy "documentos_authenticated_all":
  role authenticated, command ALL
  USING / WITH CHECK: bucket_id = 'documentos'
```

Isso não é mais um indício — é fato. O bucket é público, sem limite de
tamanho nem de tipo de arquivo, e a única policy de `storage.objects`
não restringe por organização, contrato ou papel — só exige estar
autenticado, e isso nem entra em jogo pra quem só tem a URL pública.

---

## 0. Correções da auditoria final (2026-07-14, duas rodadas)

Nada aplicado, commitado ou deployado em nenhuma das duas rodadas.
Primeira rodada: três bloqueadores identificados na auditoria estática
da rota + das duas migrations (0.1, 0.3, 0.4), mais um achado novo
(vistorias) sinalizado mas não corrigido ainda. Segunda rodada: o
achado de vistorias foi corrigido (0.2), e o item de upload/exclusão de
staff (0.5) ganhou as API Routes recomendadas, preparadas mas ainda não
religadas ao frontend.

### 0.1 `demandas.fotos` — parava de funcionar assim que o bucket virasse privado

**Causa**: `app/portal/page.tsx` (`FormularioDemanda`) gravava a **URL
pública inteira** do anexo do chamado em `demandas.fotos`, não o path
do objeto. Uma URL pública persistida no banco não tem como virar
signed URL depois — o bucket privado responde 403 pra ela pra sempre,
mesmo com a API Route funcionando perfeitamente.

**Corrigido**:
- `uploadAnexo()` (upload de anexo, dentro do formulário de nova/editar
  demanda) agora guarda o **path** do objeto (`chamados/{org}/{arquivo}`)
  em vez da URL pública. O preview durante a própria sessão de upload
  usa `URL.createObjectURL(file)` — um blob local, não depende do
  bucket ser público nem gera nenhuma chamada de rede.
- `enviar()` grava `fotos: anexos.map(a => a.path)` — path, nunca URL.
- Exibição de anexos já salvos (no próprio formulário, ao editar uma
  demanda "aberta", e no `CardDemanda` usado tanto no Portal do
  locatário quanto no Portal do locador) resolve cada valor de
  `fotos[]` sob demanda via `lib/documentosSignedUrl.ts` →
  `POST /api/documentos/url-assinada`. No `CardDemanda`, a resolução só
  acontece quando o card é expandido (`aberto === true`), pra não gerar
  signed URL de fotos que ninguém abriu.
- **Suporta os dois formatos**: se o valor salvo já for uma URL pública
  legada (`http://`/`https://`), o helper usa ela direto (funciona
  enquanto o bucket ainda for público); se for um path, resolve via
  signed URL. Nenhuma leitura quebra por causa do formato antigo ainda
  existir no banco.

**Dados antigos**: criado `scripts/migrar-fotos-demandas.mjs` — varre
`demandas.fotos`, identifica entradas que são URL pública do bucket
`documentos`, extrai o path com segurança (rejeita e preserva o valor
original se o path decodificado contiver `".."`, se a URL não bater com
o padrão esperado, ou se a decodificação falhar), e gera um relatório
JSON dos registros não convertíveis. Roda em modo **dry-run por
padrão** (só imprime relatório, nada é gravado) — só grava com a flag
explícita `--apply`. **Não foi executado.**

Arquivos: [app/portal/page.tsx](../app/portal/page.tsx),
[lib/documentosSignedUrl.ts](../lib/documentosSignedUrl.ts) (novo),
[lib/storagePath.ts](../lib/storagePath.ts) (novo, funções puras
compartilhadas entre o helper de cliente e a API Route),
[scripts/migrar-fotos-demandas.mjs](../scripts/migrar-fotos-demandas.mjs) (novo).

### 0.2 `vistorias.ambientes[].fotos[]` — corrigido em 2026-07-14 (segunda rodada)

Identificado na auditoria anterior e **corrigido nesta rodada**:
`app/(interno)/vistorias/nova/page.tsx` (`adicionarFoto`) tinha
exatamente o mesmo padrão de `demandas.fotos` — gravava a URL pública
em `ambientes[].fotos[]`, persistido em `vistorias.ambientes` (jsonb).
E `app/(interno)/vistorias/[id]/page.tsx` (geração de PDF do laudo)
fazia `await fetch(amb.fotos[fi])` **direto na URL salva** — um oitavo
ponto de uso do bucket fora do inventário original de 7 telas.

**Corrigido**:
- `adicionarFoto()` agora grava o **path** do objeto; preview durante o
  upload usa `URL.createObjectURL(file)` (blob local).
- `carregarVistoriaParaEdicao()` carrega `ambientes[].fotos[]` como
  `{ path, previewUrl: null }` e resolve os previews de forma
  assíncrona via `resolverUrlExibicao()`, casando por `nome do
  ambiente + path` (não por índice) pra não gravar num slot errado se o
  usuário remover uma foto ou ambiente enquanto a resolução está em
  andamento.
- `salvar()` grava `fotos: a.fotos.map(f => f.path)` — path, nunca URL.
- `app/(interno)/vistorias/[id]/page.tsx`: a galeria em tela (exibição
  do laudo) resolve cada valor de `fotos[]` via `resolverUrlExibicao()`
  antes de renderizar (`fotosResolvidas`, populado ao carregar a
  vistoria). A geração de PDF (`gerarPdf()`) não faz mais `fetch()`
  direto no valor salvo — resolve uma signed URL pelo servidor primeiro
  (mesma rota `url-assinada`, que já valida organização e vínculo real
  da vistoria — ver 0.6), baixa o binário só dessa signed URL, embute
  no PDF, e não grava a signed URL em lugar nenhum.
- Suporta os dois formatos (path novo e URL legada), igual a
  `demandas.fotos`.

**Dados antigos**: criado `scripts/migrar-fotos-vistorias.mjs` — mesmo
padrão do script de demandas, mas percorrendo `vistorias.ambientes`
(jsonb aninhado, não uma coluna `text[]` simples). Dry-run por padrão,
**não executado**.

Arquivos: [app/(interno)/vistorias/nova/page.tsx](../app/(interno)/vistorias/nova/page.tsx),
[app/(interno)/vistorias/[id]/page.tsx](<../app/(interno)/vistorias/[id]/page.tsx>),
[scripts/migrar-fotos-vistorias.mjs](../scripts/migrar-fotos-vistorias.mjs) (novo).

### 0.3 Idempotência da migration de policies

`20260714040000_storage_remover_policy_publica.sql` criava
`documentos_upload`/`documentos_delete` sem `drop policy if exists`
antes — rodar o arquivo duas vezes (cenário real, aplicação é manual
via SQL Editor) falhava na segunda execução em "policy already
exists", deixando o banco num estado parcial. Corrigido: toda
`create policy` agora tem um `drop policy if exists` correspondente
logo antes, para as três policies novas (ver 0.4).

### 0.4 MIME de Word ausente na lista original

A lista original de `allowed_mime_types` (pdf/jpeg/png/webp) não cobria
dois pontos de upload reais que aceitam Word:
`app/analise-cadastral/page.tsx:347` e `app/portal/page.tsx:440`
(anexo de chamado). Aplicar a migration como estava quebraria upload de
`.doc`/`.docx` nessas duas telas no mesmo instante da aplicação.
Adicionados `application/msword` e
`application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
Limite de tamanho mantido em 10 MB — nenhum upload do sistema hoje
indica necessidade de arquivo maior.

### 0.5 Upload e exclusão — redesenhado por papel

A policy antiga (e a versão anterior da proposta) liberava
INSERT/DELETE pra **qualquer** `authenticated` — staff e portal, sem
distinção. Redesenhado em `20260714040000`:

- `documentos_upload_staff`: INSERT, só quem tem linha em `public.users`
  (exclui qualquer usuário do portal).
- `documentos_upload_locatario_chamado`: INSERT, só locatário
  (`clientes.tipo = 'locatario'`), só dentro de
  `chamados/{sua_organizacao}/...`.
- **Sem nenhuma policy de INSERT para locador** — ele não envia
  documento nesta primeira versão, conforme pedido.
- `documentos_delete_staff`: DELETE, só staff. **Nenhuma policy de
  DELETE pra usuário de portal** — nem locatário exclui o próprio
  anexo de chamado (o código de hoje não faz isso, então não é perda de
  funcionalidade) — fecha por completo a possibilidade de um usuário do
  portal excluir contrato assinado, laudo de vistoria, apólice ou
  qualquer documento administrativo.

**⚠️ `documentos_upload_staff` e `documentos_delete_staff` são
PROVISÓRIAS — não aprovadas como desenho final de produção**, marcado
explicitamente com um banner na própria migration
(`20260714040000_storage_remover_policy_publica.sql`). Nenhuma das duas
verifica a organização dona do arquivo (só confirma "é staff") —
path-based RLS não consegue expressar isso com segurança para os
prefixos `contratos/{id}/...` e `analises/{id}/...`, porque o id da
organização não está no path (só é resolvível consultando a tabela
real pelo id embutido). Reimplementar essa mesma regra em SQL criaria
uma segunda fonte de verdade que pode divergir da rota com o tempo — o
mesmo risco operacional já documentado para a policy de
`cobrancas`/`demandas` no hardening anterior. Elas existem só pra a
migration não deixar o sistema sem nenhum caminho de upload/exclusão de
staff funcionando enquanto o frontend não foi trocado — não é pra
conviver com o item abaixo indefinidamente.

**Preparado nesta rodada (2026-07-14, segunda auditoria)**: as duas API
Routes recomendadas foram construídas —
[app/api/documentos/upload/route.ts](../app/api/documentos/upload/route.ts)
e
[app/api/documentos/excluir/route.ts](../app/api/documentos/excluir/route.ts).
Ambas exigem linha em `public.users` (staff real), resolvem
`organization_id` sempre do staff autenticado (nunca do corpo da
requisição), e validam contra `contratos`/`analises_cadastrais` reais
antes de gravar/apagar — igual ao padrão já usado em
`url-assinada`. Reaproveitam a allowlist única de extensão/MIME/tamanho
em `lib/documentosPermitidos.ts` (criada nesta rodada, também usada por
`url-assinada`, pra não deixar duas listas divergirem).

**Limitação herdada, não introduzida por estas rotas**: pros prefixos
`vistorias/` e `logos/`, que não carregam id de registro específico no
path (só `organization_id`), a validação possível continua sendo só
"este staff pertence a esta organização" — a mesma limitação que já
existia. Documentado no cabeçalho de cada rota.

**Não incluído nesta rodada**: trocar as telas de staff
(`app/(interno)/contratos/page.tsx`, `app/analise-cadastral/page.tsx`,
`app/(interno)/vistorias/nova/page.tsx`,
`app/(interno)/configuracoes/page.tsx`) para chamar essas rotas em vez
de `supabase.storage.from('documentos').upload()/remove()` direto do
client. As rotas estão prontas e testadas por `tsc`, mas nenhuma tela
foi religada a elas — é o próximo passo antes de considerar
`documentos_upload_staff`/`documentos_delete_staff` removíveis.

### 0.6 Validação reforçada na API Route

`app/api/documentos/url-assinada/route.ts` ganhou, nesta revisão:

- **Allowlist de extensão** (`pdf, jpg, jpeg, png, webp, doc, docx`) —
  rejeitada antes de qualquer consulta ao banco.
- **MIME real do objeto**, quando disponível: consulta
  `storage.list(pasta, { search: arquivo })` e confere
  `metadata.mimetype` contra a mesma lista de MIME da migration. Objeto
  sem metadata compatível é rejeitado por segurança (nunca liberado por
  omissão).
- **Validação por registro real para `chamados`**: antes checava só a
  organização; agora exige que o path esteja de fato referenciado em
  `demandas.fotos` de uma demanda real da organização, e — pra usuário
  de portal — que a demanda pertença a ele (locador ou locatário). A
  comparação normaliza tanto path novo quanto URL legada
  (`lib/storagePath.ts`), então não depende da ordem de execução do
  script de migração de dados.
- **Validação por registro real para `vistorias`**: mesma lógica,
  comparando contra `ambientes[].fotos[]` de vistorias reais da
  organização; para usuário de portal, confirma vínculo via contrato
  ativo do imóvel da vistoria (locador ou locatário), no mesmo padrão
  da policy `portal_leitura` de `20260714000000_portal_locador_rls.sql`.
- Bucket continua hardcoded (`'documentos'`) — nunca lido do corpo da
  requisição.
- Log de erro só grava a mensagem do erro, nunca `path`, token ou
  qualquer dado do corpo da requisição.

**Custo de performance aceito conscientemente**: a validação de
`chamados`/`vistorias` carrega todas as demandas/vistorias da
organização (com `fotos`/`ambientes`) para comparar em memória, porque
Postgres/PostgREST não filtra bem "path está dentro de um jsonb
aninhado" nem "path normalizado bate com URL legada" numa única query.
Aceitável para o volume esperado (dezenas a poucas centenas de
registros por organização); se isso crescer muito, vale revisitar com
uma tabela de metadados dedicada em vez de regex/scan em memória.

---

## 1. Inventário completo — todos os locais que usam `getPublicUrl()`

Confirmado por busca em todo `app/` — exatamente 7 ocorrências, todas no
bucket `documentos`, nenhuma usa `createSignedUrl()`:

| # | Arquivo | Tela (nome visível no sistema) | Caminho gerado |
|---|---|---|---|
| 1 | `app/(interno)/contratos/page.tsx:707` | **Contratos** → editar contrato → "Kit de documentos" | `contratos/{id}/kit/{categoria}/{arquivo}` |
| 2 | `app/portal/page.tsx:650` | **Portal do locador** → "Meus imóveis" → Documentos | `contratos/{id}/kit/{categoria}/{arquivo}` |
| 3 | `app/portal/page.tsx:772` | **Portal do locatário** → "Meu contrato" → Documentos | `contratos/{id}/kit/{categoria}/{arquivo}` |
| 4 | `app/portal/page.tsx:324` | **Portal do locatário** → "Solicitações" → anexo de nova demanda | `chamados/{organization_id}/{arquivo}` |
| 5 | `app/analise-cadastral/page.tsx:92` | **Análise Locatários** → documentos da análise | `analises/{id}/{arquivo}` |
| 6 | `app/(interno)/configuracoes/page.tsx:347` | **Configurações** → logo da imobiliária | `logos/{organization_id}.{ext}` |
| 7 | `app/(interno)/vistorias/nova/page.tsx:159` | **Laudo de Vistoria** → nova/editar vistoria → fotos dos ambientes | `vistorias/{organization_id}/{arquivo}` |

## 2. Classificação — público aceitável vs. privado obrigatório

| Prefixo | Classificação | Motivo |
|---|---|---|
| `contratos/{id}/kit/{categoria}/` | 🔴 **Privado obrigatório** | CPF, RG, comprovante de endereço, comprovante de estado civil, contrato assinado, apólices — a categoria mais sensível de todas |
| `analises/{id}/` | 🔴 **Privado obrigatório** | documentos de análise de crédito/cadastral de locatário |
| `chamados/{organization_id}/` | 🟡 **Privado obrigatório** (sensibilidade média, mas ainda privado) | fotos de manutenção — podem mostrar interior/pertences |
| `vistorias/{organization_id}/` | 🟡 **Privado obrigatório** (sensibilidade média) | mesma natureza de `chamados` |
| `logos/{organization_id}.{ext}` | 🟢 **Público aceitável** | só o logo da imobiliária, sem dado pessoal — **não precisa ficar privado**, conforme pedido explicitamente |

Nenhum item ficou como "precisa de confirmação" — os 7 usos mapeiam
claramente em uma dessas duas categorias.

### Achado à parte sobre o logo

Bucket público/privado no Supabase Storage é uma configuração **do
bucket inteiro**, não por pasta — não dá pra deixar só `logos/` público
e o resto privado dentro do mesmo bucket `documentos`. Recomendo migrar
os logos pra um **bucket separado e público** (ex.: `logos-publicos`),
mantendo `documentos` 100% privado sem exceção. É uma migração pequena
(poucos arquivos, um por organização) — ver Seção 6.

Confirmei também que, hoje, o logo só aparece dentro de telas já
autenticadas (Sidebar do sistema interno, cabeçalho do portal) — nunca
numa página pública sem login. Ainda assim, mantenho a recomendação de
bucket público separado pra logo (evita um round-trip de API só pra
mostrar uma imagem que se repete em toda tela).

## 3. API Route segura para URL assinada

Criada (não commitada, não deployada): `app/api/documentos/url-assinada/route.ts`.

Fluxo:
1. **Verificação de sessão** — mesmo padrão de `app/api/portal/gerenciar-acesso/route.ts`: token Bearer validado direto no Supabase Auth, nunca confia em identidade declarada no corpo da requisição.
2. **Identifica o chamador** — consulta `users` (staff) e `clientes` (portal) pelo `auth.uid()` real; se não achar vínculo em nenhuma das duas, nega.
3. **Valida `organization_id`** — resolvido do lado do servidor a partir do vínculo confirmado, nunca recebido do cliente.
4. **Valida contrato/imóvel** — faz o parsing do `path` recebido e confere, consultando `contratos`/`analises_cadastrais`, se o arquivo pedido realmente pertence a uma entidade da organização (e, no caso do portal, do próprio locador/locatário) do chamador.
5. **Valida perfil/categoria** — um locatário só pode pedir `contrato_assinado`/`laudo_vistoria`; um locador também pode pedir as duas apólices; nenhum dos dois pode pedir CPF/RG/comprovantes de qualquer parte (essas categorias ficam só para staff). Essa é uma decisão de produto meio embutida no código — sinalizando aqui caso queiram revisar.
6. Só então gera a `createSignedUrl()` (5 minutos de validade) usando a service role, e devolve.

**Limitação conhecida e documentada no próprio arquivo**: para os
prefixos `vistorias/` e `chamados/`, o path só carrega
`organization_id` — não dá pra restringir "só a vistoria/chamado
específico do usuário" sem mudar a convenção de path ou criar uma
tabela de metadados (nenhuma das duas está feita). Por ora, a
verificação nesses dois prefixos é só por organização — mais estrita
que "qualquer autenticado de qualquer organização" (o estado atual),
mas ainda não é granular por registro específico.

## 4. Migrations separadas (criadas, não aplicadas)

| Arquivo | Conteúdo |
|---|---|
| `supabase/migrations/20260714030000_storage_bucket_privado.sql` | `update storage.buckets set public = false, file_size_limit = 10485760, allowed_mime_types = array[...]` (6 tipos, incluindo Word — ver 0.4) |
| `supabase/migrations/20260714040000_storage_remover_policy_publica.sql` | Remove `documentos_authenticated_all`; cria três policies por papel (`documentos_upload_staff`, `documentos_upload_locatario_chamado`, `documentos_delete_staff` — ver 0.5) — **nenhuma de SELECT**, leitura passa a ser só via API Route (service role). Idempotente (ver 0.3) |

## 5. Limites de tamanho e MIME recomendados

- **Tamanho**: 10 MB por arquivo (`10485760` bytes) — generoso pra PDF/foto de celular, evita abuso de custo de armazenamento.
- **Tipos permitidos**: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`,
  `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  (`.doc`/`.docx`) — **corrigido na auditoria final (ver 0.4)**: a lista
  original não incluía Word e quebraria upload em
  `app/analise-cadastral/page.tsx:347` e `app/portal/page.tsx:440`, que
  aceitam `.doc`/`.docx` no `accept=`. Bloqueia upload de executável,
  script, etc.

## 6. Plano de migração sem indisponibilidade

A ordem importa — bucket privado e código novo **precisam estar prontos
antes** de qualquer coisa quebrar, não depois:

1. Criar bucket novo `logos-publicos` (público), migrar os arquivos de
   `logos/*` do bucket `documentos` pra lá (poucos arquivos — um por
   organização que já configurou logo), e atualizar
   `organizations.logo_url` pra apontar pro novo caminho.
2. Deployar a API Route (`/api/documentos/url-assinada`) — funciona
   igual estando o bucket ainda público (gera signed URL válida de
   qualquer jeito), então não quebra nada só de existir.
3. Trocar os 6 pontos de `getPublicUrl()` restantes (excluindo o do
   logo, resolvido no passo 1) pra chamar essa API Route, aguardar a
   resposta, e só então exibir/baixar o arquivo.
4. Deployar essa troca de frontend e **testar em produção com o bucket
   ainda público** — nesse momento, nada muda pro usuário final, mas dá
   pra confirmar que a rota nova está funcionando de ponta a ponta antes
   do ponto de não-retorno.
5. Só então aplicar `20260714030000` (bucket privado + limites) e
   `20260714040000` (remove a policy ampla, cria as mínimas) — as duas
   juntas, na mesma janela.
6. Testar imediatamente as 7 telas (Seção 1) em produção.
7. Confirmar que uploads de arquivo grande (>10MB) ou tipo não permitido
   são rejeitados com uma mensagem clara (não um erro genérico).

Com essa ordem, a única janela de risco é entre os passos 5 e 6 (poucos
minutos) — e mesmo aí, o pior cenário é leitura falhar temporariamente,
não perda de dado.

## 7. Plano de rollback

Cada migration tem rollback de uma linha, documentado no próprio
arquivo:

```sql
-- Reverter 20260714030000
update storage.buckets
set public = true, file_size_limit = null, allowed_mime_types = null
where id = 'documentos';

-- Reverter 20260714040000
drop policy if exists "documentos_upload_staff" on storage.objects;
drop policy if exists "documentos_upload_locatario_chamado" on storage.objects;
drop policy if exists "documentos_delete_staff" on storage.objects;
create policy "documentos_authenticated_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'documentos')
  with check (bucket_id = 'documentos');
```

Reverter o bucket pra público imediatamente restaura o comportamento
atual (inclusive os links já gerados voltam a funcionar). O frontend
trocado pra usar a API Route continua funcionando normalmente mesmo com
o bucket público de novo (a rota não depende do bucket ser privado pra
funcionar) — ou seja, o rollback do banco não exige rollback de
frontend junto.

## 8. Quais telas quebrariam se o bucket fosse tornado privado HOJE (sem o resto do pacote)

Se alguém aplicasse só `20260714030000` (bucket privado) agora, sem
nenhuma das outras mudanças, **as 7 telas listadas na Seção 1 quebram
todas ao mesmo tempo** — toda URL já gerada por `getPublicUrl()` passa a
retornar acesso negado:

1. Contratos → Kit de documentos (staff não consegue mais abrir/baixar nenhum documento já enviado).
2. Portal do locador → Meus imóveis → Documentos.
3. Portal do locatário → Meu contrato → Documentos.
4. Portal do locatário → Solicitações → anexos de demanda (fotos já enviadas somem).
5. Análise Locatários → documentos anexados.
6. Configurações → **logo da imobiliária desaparece de toda a interface** (Sidebar interna e cabeçalho do portal, onde quer que `logo_url` seja usado).
7. Laudo de Vistoria → fotos dos ambientes.

**O que NÃO quebraria**: novos uploads e exclusões continuariam
funcionando normalmente (a policy `documentos_authenticated_all`
continua concedendo INSERT/DELETE pro role `authenticated`
independente do bucket ser público ou privado — só a leitura via URL
pública para de funcionar). Ou seja, o sintoma seria "consigo enviar um
documento novo, mas nem eu nem ninguém consegue ver o que já foi
enviado" — inclusive o que acabou de ser enviado nesse mesmo minuto.

**Por isso a ordem do plano de migração (Seção 6) existe** — nenhuma
dessas 7 telas deve quebrar, porque o código novo (API Route + troca de
frontend) é testado em produção *antes* do bucket virar privado, não
depois.

## 9. Checklist funcional de testes (não executados)

Nenhum item abaixo foi executado nesta sessão — sem ambiente Supabase
ativo. Testes estáticos que **foram** executados: `npx tsc --noEmit`,
rodado 3 vezes ao longo das duas rodadas de auditoria, limpo nas três.

Pré-requisito comum a quase todos: ambiente de teste/staging com bucket
`documentos` já **privado** e com as policies de `20260714040000`
aplicadas — nenhum destes testes é significativo com o bucket ainda
público (qualquer URL funciona, público ou não, então não valida nada).

1. **Upload e visualização de foto de demanda** — Portal do locatário,
   nova solicitação com anexo: confirmar que `demandas.fotos` grava um
   path (não URL), que a miniatura aparece no formulário (preview
   local/blob) e, depois de salva, no card expandido (signed URL).
2. **Upload e visualização de foto de vistoria** — Nova Vistoria,
   adicionar foto a um ambiente: confirmar que `vistorias.ambientes`
   grava path, que a miniatura aparece no formulário (preview local) e,
   depois de salva, na tela de detalhe da vistoria (signed URL).
3. **Geração de PDF com fotos** — abrir uma vistoria salva com fotos e
   gerar o laudo em PDF: confirmar que as fotos aparecem embutidas
   corretamente, sem exceção silenciosa (`catch {}` no loop de fotos
   hoje engole erro por foto — vale logar temporariamente durante o
   teste pra não confundir "foto não carregou" com "não tinha foto").
4. **Locatário acessando só os próprios anexos** — logado como
   locatário A, chamar `/api/documentos/url-assinada` com um `path` de
   `chamados/...` que pertence a uma demanda do locatário B (mesma
   organização) — esperado 403.
5. **Locador acessando só documentos autorizados** — logado como
   locador, tentar `path` de categoria fora da allowlist
   (`CATEGORIAS_PERMITIDAS_LOCADOR` — ex.: `{prefixo}_cpf_titular`) de
   um contrato do próprio locador — esperado 403, mesmo sendo dono do
   contrato.
6. **Staff de uma organização sem acesso à outra** — logado como staff
   da organização A, chamar a rota com `path` de `contratos/`,
   `analises/`, `vistorias/` ou `chamados/` pertencente à organização B
   — esperado 403 em todos os quatro prefixos.
7. **Arquivo inexistente** — `path` sintaticamente válido, autorizado
   por registro (ex.: categoria certa de um contrato real), mas o
   objeto nunca foi de fato enviado ao Storage — esperado erro ao
   assinar (`createSignedUrl` falha) ou, se a checagem de MIME rodar
   antes, "objeto sem metadata" tratado como rejeição.
8. **MIME divergente** — um arquivo renomeado pra `.pdf` mas cujo
   conteúdo real é outra coisa (upload direto via Storage API, não pelo
   app, pra simular metadata inconsistente) — esperado 400 na checagem
   de `metadata.mimetype` (quando o Storage tiver essa metadata
   disponível pro objeto).
9. **Extensão bloqueada** — `path` terminando em `.zip`/`.exe`/`.sh` —
   esperado 400 antes de qualquer consulta ao banco.
10. **Signed URL expirada** — gerar uma signed URL, esperar mais de 5
    minutos (`VALIDADE_SEGUNDOS`), tentar usá-la — esperado erro do
    próprio Storage (não é algo que a rota controla depois de emitida,
    só confirma que o TTL está mesmo em 5 min e não maior).
11. **Word até 10 MB** — upload de `.docx` de ~9 MB em
    `app/analise-cadastral/page.tsx` e em `app/portal/page.tsx` (anexo
    de chamado) — esperado sucesso (valida ao mesmo tempo a correção de
    MIME da 0.4 e o limite de tamanho).
12. **Tentativa de exclusão pelo locatário** — não há hoje nenhuma UI
    de exclusão pro locatário, então este teste é sobre a **ausência**
    de qualquer caminho: confirmar que não existe policy de DELETE pra
    `authenticated` que não seja `documentos_delete_staff`, e que
    chamar `storage.remove()` diretamente do client autenticado como
    locatário falha por RLS.
13. **Tentativa de path traversal** — `path` contendo `..` ou começando
    com `/` (ex.: `../../etc/passwd`, `/etc/passwd`) em
    `/api/documentos/url-assinada` **e** em
    `/api/documentos/excluir` — esperado 400 "Caminho inválido." nas
    duas rotas, antes de qualquer consulta ao banco.

### Testes adicionais específicos desta rodada

- `node scripts/migrar-fotos-demandas.mjs` e
  `node scripts/migrar-fotos-vistorias.mjs` (sem `--apply`) contra um
  ambiente de teste/staging com dados reais, pra conferir a contagem de
  convertidas vs. não convertíveis antes de cogitar rodar com `--apply`
  em produção.
- Editar uma demanda ou vistoria existente que já tenha fotos no
  formato URL legado (dado real de produção) e confirmar que a
  miniatura ainda aparece (fallback de URL legada) sem erro no console.
- Aplicar (em ambiente de teste, não produção) `20260714040000` duas
  vezes seguidas — confirmar que a segunda execução não falha (valida a
  correção de idempotência).
- `POST /api/documentos/upload` (staff) com `prefixo=contratos` e um
  `contratoId` de outra organização — esperado 403.
- `POST /api/documentos/excluir` (staff) com `path` de `analises/` de
  outra organização — esperado 403.
