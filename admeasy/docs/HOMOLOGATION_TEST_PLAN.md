# Plano de testes de homologação — RLS do portal + Storage privado

**Nenhum teste abaixo foi executado.** Esta sessão não tem acesso a um
ambiente Supabase ativo (sem sessão de CLI, sem conexão direta ao
Postgres). Este documento é o roteiro para ser seguido em homologação
antes de aplicar qualquer migration em produção.

Cobre as duas frentes preparadas nas branches `security/portal-rls-hardening`
(RLS de `cobrancas`/`demandas` + acesso do locador) e
`security/storage-private-preparation` (bucket privado + signed URLs), mais
as adaptações de frontend feitas em `integration/secure-portal-flows` para
deixar o app compatível com as duas.

## 0. Pré-requisitos e ordem de aplicação

Nenhuma migration deve ser aplicada antes dos passos abaixo, nessa ordem:

1. **Consulta de colisão** (bloqueador para a Fase RLS) — rodar em
   produção/homologação, somente leitura:
   ```sql
   select u.id, u.email, c.id as cliente_id, c.nome as cliente_nome
   from public.users u
   join public.clientes c on c.usuario_portal_id = u.id;
   ```
   Esperado: zero linhas. Se houver alguma, **parar** — ver
   `docs/SECURITY_HARDENING_REVIEW.md` para o que essa colisão significa.
2. Deployar o código desta branch (`integration/secure-portal-flows`)
   **antes** de aplicar qualquer migration — as rotas `/api/documentos/*`
   e a chamada à RPC precisam existir no ar antes das policies que as
   tornam necessárias entrarem em vigor, senão as telas quebram no meio
   do caminho.
3. Aplicar `supabase/migrations/20260714010000_hardening_cobrancas_demandas.sql`
   e `20260714000000_portal_locador_rls.sql` e `20260714020000_rpc_decisao_demanda.sql`
   (branch `security/portal-rls-hardening`) — testar os blocos 2, 3 e 4
   abaixo antes de prosseguir.
4. Só depois — com o bucket ainda **público** — testar os blocos 5 e 6
   abaixo (as rotas de signed URL/upload/exclusão funcionam com bucket
   público também, só ficam redundantes; é o momento de validar toda a
   troca de frontend sem risco de quebrar leitura).
5. Só então aplicar `20260714030000_storage_bucket_privado.sql` e
   `20260714040000_storage_remover_policy_publica.sql` juntas, na mesma
   janela — reteste os blocos 5, 6, 7, 8 e 9 imediatamente depois.

## 1. Regressão — o que NÃO deveria ter mudado

- [ ] Staff consegue continuar lendo/escrevendo `cobrancas` e `demandas`
      normalmente na tela **Financeiro** e na tela interna **Demandas**
      (`app/(interno)/demandas/page.tsx`) — nenhuma dessas telas foi
      alterada, dependem só de `org_isolation`, que não muda.
- [ ] Cron de lembrete de boleto (`app/api/cron/lembretes-boleto/route.ts`)
      continua gravando `cobrancas` normalmente (roda com service role,
      fora do escopo de RLS).
- [ ] Webhook/rota `/api/boleto` continua gravando `mp_payment_id`,
      `boleto_url`, `boleto_linha_digitavel`, `pix_qr_code*` normalmente.

## 2. Cobranças

- [ ] Locatário gera um boleto pelo portal (`gerarBoleto`) — confirmar
      que o boleto/PIX é criado e exibido normalmente **sem** nenhum
      `UPDATE` disparado pelo client (checar Network tab: não deve haver
      requisição PATCH para `cobrancas` vinda do browser do locatário).
- [ ] Confirmar no banco que `mp_payment_id`/`boleto_url` foram
      persistidos mesmo sem esse update — devem já estar lá, gravados
      por `/api/boleto` via service role.
- [ ] **Depois** de `20260714010000` aplicada: tentar via REST direta
      (token do locatário, fora do app) um `PATCH` em `cobrancas`
      alterando `status_cobranca`/`valor_aluguel`/`valor_total` da
      própria cobrança — esperado 403/RLS nega (a policy
      `portal_locatario_update` não existe mais).
- [ ] Staff marca uma cobrança como paga manualmente na tela Financeiro
      — continua funcionando (via `org_isolation`, não alterado).

## 3. Demandas — locatário

- [ ] Locatário abre uma demanda nova, com foto anexada — confirmar que
      `demandas.fotos` grava **path**, não URL (checar direto no banco
      ou pelo Network: o preview no formulário deve carregar sem
      requisição de rede, via blob local).
- [ ] Editar uma demanda ainda "aberta" (mudar título/descrição/
      urgência) — deve funcionar. Tentar (via REST direta, fora do app)
      alterar `status`/`orcamento`/`valor_final`/`fornecedor_id` na mesma
      chamada — esperado exceção da trigger
      `proteger_colunas_demanda_portal` ("só podem alterar título,
      descrição, urgência e fotos").
- [ ] Tentar editar uma demanda que já não está mais "aberta" — esperado
      falha (policy `portal_locatario_update` exige `status = 'aberta'`).
- [ ] Criar demanda com `contrato_id` de um contrato que NÃO é do
      próprio locatário (via REST direta) — esperado falha na policy de
      INSERT, ou `locador_id`/`imovel_id` ficam `null` (trigger
      `preencher_locador_demanda_portal` só deriva do contrato real).

## 4. Demandas — locador (RPC)

- [ ] Locador vê uma demanda com `status = 'aguardando_locador'` no
      Portal do locador → aba Solicitações.
- [ ] Clicar em "Aprovar" — confirmar que chama
      `supabase.rpc('portal_locador_decidir_demanda', { p_decisao:
      'autorizada' })`, sem nenhum `UPDATE` direto em `demandas` (checar
      Network: deve ser uma chamada `POST .../rpc/portal_locador_decidir_demanda`,
      não um PATCH em `/rest/v1/demandas`). Status muda pra "autorizada"
      na tela.
- [ ] Clicar em "Recusar" **sem** preencher o motivo (cancelar o prompt,
      ou confirmar vazio) — esperado que a ação seja abortada, nenhuma
      chamada à RPC é feita.
- [ ] Clicar em "Recusar" **com** motivo preenchido — RPC é chamada com
      `p_decisao: 'recusada'` e `p_justificativa` preenchida, status muda
      pra "recusada", `motivo_recusa` gravado.
- [ ] Tentar decidir a mesma demanda duas vezes (chamar a RPC de novo
      depois de já autorizada) — esperado exceção "não está aguardando
      decisão do locador".
- [ ] Locador A tenta decidir uma demanda que pertence ao locador B (via
      REST/RPC direta, passando o `p_demanda_id` de outra pessoa) —
      esperado exceção genérica "não encontrada ou sem permissão".
- [ ] **Dependência de aplicação conhecida** (documentada em
      `20260714000000_portal_locador_rls.sql`): hoje nenhum fluxo do
      sistema marca `status = 'aguardando_locador'` nem preenche
      `locador_id` a partir do portal do locatário sem passar por
      `contrato_id` — confirmar que existe pelo menos um caminho real
      (manual pelo staff, ou fluxo a construir) pra gerar esse estado,
      senão o teste acima não tem como ser reproduzido de ponta a ponta.

## 5. Storage privado

- [ ] Confirmar ao vivo, antes de aplicar: `storage.buckets` para
      `documentos` — `public`, `file_size_limit`, `allowed_mime_types`
      batem com o esperado antes do flip.
- [ ] Aplicar `20260714030000` + `20260714040000` juntas. Imediatamente
      depois, confirmar `public = false`, `file_size_limit = 10485760`,
      `allowed_mime_types` com os 6 tipos (pdf/jpeg/png/webp/doc/docx).
- [ ] Tentar acessar uma URL pública antiga já conhecida (copiada antes
      do flip) — esperado 400/403 do Storage.
- [ ] Confirmar que `documentos_authenticated_all` não existe mais em
      `pg_policies` e que `documentos_upload_staff`,
      `documentos_upload_locatario_chamado`, `documentos_delete_staff`
      existem.

## 6. Signed URLs — leitura

Para cada uma das seis telas, confirmar que o arquivo aparece
normalmente (nenhuma quebrou) e que a chamada de rede é
`POST /api/documentos/url-assinada`, não mais `getPublicUrl`:

- [ ] Contratos → Kit de documentos (staff).
- [ ] Portal do locador → Meus imóveis → Documentos.
- [ ] Portal do locatário → Meu contrato → Documentos.
- [ ] Portal do locatário → Solicitações → anexos de demanda.
- [ ] Análise Locatários → documentos anexados.
- [ ] Laudo de Vistoria → galeria em tela e PDF gerado.

Casos negativos:
- [ ] Locatário A tenta ler `path` de um documento do contrato do
      locatário B (mesma organização) — esperado 403.
- [ ] Locador tenta ler categoria de CPF/RG (fora da allowlist) do
      próprio contrato — esperado 403.
- [ ] Staff da organização A tenta ler `path` de `contratos/`,
      `analises/`, `vistorias/` ou `chamados/` da organização B —
      esperado 403 nos quatro prefixos.
- [ ] `path` com extensão fora da allowlist (`.zip`, `.exe`) — esperado
      400 antes de qualquer consulta ao banco.
- [ ] `path` com `..` ou começando com `/` — esperado 400 "Caminho
      inválido." (path traversal).
- [ ] Signed URL expira depois de 5 minutos — usar uma URL já gerada
      depois desse tempo, esperado erro do Storage.
- [ ] `path` sintaticamente válido mas o objeto nunca existiu — esperado
      erro ao assinar.

## 7. Uploads

- [ ] Staff envia documento no Kit de documentos (Contratos) — confirmar
      chamada `POST /api/documentos/upload` (não mais `storage.upload`
      direto do client), arquivo aparece na listagem depois.
- [ ] Staff envia documento em Análise Locatários — idem.
- [ ] Staff envia foto em Nova Vistoria — idem.
- [ ] Staff da organização A tenta enviar documento pra um
      `contratoId`/`analiseId` de outra organização (chamando a rota
      direto, fora do app) — esperado 403.
- [ ] Upload de `.docx` de ~9 MB nas telas que aceitam Word (Análise
      Locatários, anexo de chamado no portal) — esperado sucesso.
- [ ] Upload de arquivo > 10 MB — esperado rejeição (pelo bucket, depois
      do flip; a rota de upload administrativo não reforça esse limite
      no código, só a migration do bucket — width conhecida, ver Seção
      10).
- [ ] Upload de extensão fora da allowlist — esperado 400 da rota antes
      de qualquer tentativa de gravação.
- [ ] Locatário continua enviando anexo de chamado normalmente (fluxo
      **não** migrado para a rota administrativa, permanece upload
      direto coberto por `documentos_upload_locatario_chamado`).
- [ ] Configurações → logo da imobiliária continua funcionando via
      upload direto (fluxo também **não** migrado — ver Seção 10).

## 8. Exclusões

- [ ] Staff exclui um documento do Kit de documentos — confirma chamada
      `POST /api/documentos/excluir`, arquivo some da listagem.
- [ ] Staff exclui documento de Análise Locatários — idem.
- [ ] Staff da organização A tenta excluir `path` de `contratos/` ou
      `analises/` de outra organização — esperado 403.
- [ ] Confirmar que não existe, em nenhuma tela do portal (locatário ou
      locador), botão ou ação que chame exclusão de Storage.
- [ ] Tentar, via SDK direto com token de locatário/locador (fora do
      app), `storage.from('documentos').remove([...])` em qualquer path
      — esperado negado por RLS (nenhuma policy de DELETE pra portal).

## 9. Geração de PDF de vistoria

- [ ] Abrir uma vistoria com fotos salvas no formato novo (path) e gerar
      o laudo em PDF — fotos aparecem embutidas corretamente.
- [ ] Abrir uma vistoria com fotos salvas no formato antigo (URL
      pública, dado legado) e gerar o PDF **antes** do bucket virar
      privado — deve funcionar (fallback de URL legada).
- [ ] Mesma vistoria com fotos em formato antigo, gerar o PDF **depois**
      do bucket virar privado, sem ter rodado
      `scripts/migrar-fotos-vistorias.mjs` — esperado falha silenciosa
      por foto (o `catch {}` no loop engole o erro; a foto simplesmente
      não aparece no PDF) — confirma a necessidade de rodar o script de
      migração antes do flip em produção real.
- [ ] Rodar `node scripts/migrar-fotos-vistorias.mjs` (sem `--apply`) e
      `node scripts/migrar-fotos-demandas.mjs` (sem `--apply`) contra o
      ambiente de homologação, revisar o relatório de não convertíveis
      antes de decidir rodar com `--apply`.

## 10. Isolamento entre organizações e entre perfis

- [ ] Staff da organização A não vê nenhum registro de `cobrancas`,
      `demandas`, `contratos`, `imoveis`, `vistorias` da organização B
      em nenhuma tela interna.
- [ ] Locatário da organização A não vê nada da organização B (deveria
      ser impossível por design — `clientes.usuario_portal_id` é único
      por pessoa, mas vale testar diretamente via REST).
- [ ] Locador só vê os próprios contratos/imóveis/demandas/cobranças —
      nunca os de outro locador da mesma organização.
- [ ] Repetir os testes acima logo após aplicar cada migration
      isoladamente (não só no final) — se algo isolar mal, é mais fácil
      identificar qual migration causou.

## Limitações conhecidas, não corrigidas nesta rodada

- Upload/exclusão de logo (`Configurações`) continua fora das rotas
  administrativas — decisão deliberada, logo é o único caso "público
  aceitável" do pacote (ver `docs/STORAGE_PRIVATE_MIGRATION_PROPOSAL.md`).
- A rota `/api/documentos/upload` não reforça o limite de 10 MB no
  próprio código — depende do limite do bucket (`file_size_limit`), que
  só existe depois de `20260714030000` aplicada. Antes disso, um upload
  administrativo grande passa sem checagem de tamanho no servidor.
- As policies `documentos_upload_staff`/`documentos_delete_staff`
  continuam provisórias (sem escopo real de organização) — ver
  `docs/STORAGE_PRIVATE_MIGRATION_PROPOSAL.md`, Seção 0.5. As telas de
  staff já foram religadas às API Routes nesta rodada, então essas
  policies deixaram de ser o único caminho de escrita — mas ainda não
  foram removidas da migration (fariam falta se alguma tela ainda não
  migrada precisar escrever direto).
