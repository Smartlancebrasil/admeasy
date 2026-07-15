-- ============================================================
-- Storage — remove a policy ampla e cria substitutas mínimas
-- Admeasy Connect — proposta para revisão, NÃO APLICADA
-- ============================================================
-- ATENÇÃO: proposta para revisão. Não foi rodada contra o banco de
-- produção. Ver docs/SECURITY_HARDENING_REVIEW.md e
-- docs/STORAGE_PRIVATE_MIGRATION_PROPOSAL.md.
--
-- Só faz sentido DEPOIS de 20260714030000_storage_bucket_privado.sql
-- já ter sido aplicada (bucket privado) — aplicar esta migration com
-- o bucket ainda público não resolve nada, porque leitura direta por
-- URL pública nem passa por policy de storage.objects.
--
-- IMPORTANTE — confirmação necessária antes de aplicar: o nome exato
-- da policy hoje ao vivo é "documentos_authenticated_all" (confirmado
-- por você em 2026-07-14). Se o nome real for diferente, o
-- "drop policy if exists" abaixo não erra, só não remove nada — e a
-- policy antiga (ampla) continuaria valendo ao lado das novas
-- (mínimas), o que anularia o propósito desta migration. Reconferir
-- o nome exato em pg_policies antes de aplicar.
--
-- IDEMPOTÊNCIA (corrigido em 2026-07-14): a versão anterior deste
-- arquivo criava "documentos_upload"/"documentos_delete" sem
-- "drop policy if exists" antes — rodar o arquivo duas vezes (cenário
-- real, já que a aplicação hoje é manual via SQL Editor, sem sessão de
-- CLI ativa) falhava na segunda execução com "policy already exists"
-- na primeira CREATE POLICY que encontrasse, deixando a migration
-- parcialmente aplicada. Toda CREATE POLICY abaixo agora tem um DROP
-- POLICY IF EXISTS correspondente logo antes.
--
-- ============================================================
-- ⚠️ "documentos_upload_staff" e "documentos_delete_staff"
-- (definidas mais abaixo) SÃO PROVISÓRIAS — NÃO APROVADAS COMO
-- DESENHO FINAL DE PRODUÇÃO.
-- ============================================================
-- Elas liberam INSERT/DELETE pra "qualquer staff autenticado, em
-- qualquer path do bucket" — sem confirmar que o arquivo pertence à
-- organização desse staff (ver limitação detalhada logo abaixo).
-- Ficam neste arquivo só pra a migration não deixar o sistema sem
-- nenhum caminho de upload/exclusão de staff funcionando enquanto o
-- frontend ainda não foi trocado.
--
-- O caminho recomendado e já preparado (não wireado no frontend ainda)
-- é app/api/documentos/upload/route.ts e
-- app/api/documentos/excluir/route.ts — validam organização real via
-- "contratos"/"analises_cadastrais" antes de gravar/apagar, com
-- service role, sem depender de Storage RLS pra essa garantia. Depois
-- que as telas de staff (Kit de documentos, Análise Locatários, Nova
-- Vistoria, Configurações → logo) forem trocadas pra usar essas rotas
-- em vez de chamar storage.upload()/storage.remove() direto do client,
-- "documentos_upload_staff"/"documentos_delete_staff" devem ser
-- removidas por completo — não é pra conviver as duas formas
-- indefinidamente.
--
-- ============================================================
-- LEITURA (sem mudança de desenho — mantido)
-- ============================================================
-- Em vez de tentar expressar toda a regra de posse (organização/
-- contrato/papel) dentro de uma policy de storage.objects — frágil,
-- porque o path nem sempre carrega essa informação (vistorias/chamados
-- só têm organization_id, não o id específico do registro) — a LEITURA
-- é feita exclusivamente pela API Route (service role, bypassa RLS,
-- valida a posse de verdade consultando as tabelas reais). Por isso
-- não há policy de SELECT/UPDATE para o role "authenticated" em
-- nenhum ponto deste arquivo.

drop policy if exists "documentos_authenticated_all" on storage.objects;
drop policy if exists "documentos_upload" on storage.objects;
drop policy if exists "documentos_delete" on storage.objects;
drop policy if exists "documentos_upload_staff" on storage.objects;
drop policy if exists "documentos_upload_locatario_chamado" on storage.objects;
drop policy if exists "documentos_delete_staff" on storage.objects;

-- ============================================================
-- UPLOAD (INSERT) — redesenhado (2026-07-14) por papel
-- ============================================================
-- Antes: uma única policy ALL liberava qualquer authenticated em
-- qualquer path do bucket — staff e portal, sem distinção de papel nem
-- de organização. O pedido explícito de revisão foi: sem DELETE amplo,
-- staff só na própria organização, locatário só anexo da própria
-- demanda, locador nada nesta primeira versão, nenhum usuário do
-- portal excluindo contrato/vistoria/apólice/documento administrativo.
--
-- LIMITAÇÃO CONHECIDA E ACEITA NESTA VERSÃO: path-based RLS em
-- storage.objects não consegue expressar com segurança "staff só pode
-- gravar dentro da PRÓPRIA organização" para os prefixos
-- "contratos/{contratoId}/..." e "analises/{analiseId}/..." — o id da
-- organização não está no path nesses dois casos (só nos casos
-- "vistorias/{org}/...", "chamados/{org}/...", "logos/{org}.{ext}"),
-- só é possível saber a organização dona consultando "contratos"/
-- "analises_cadastrais" pelo id embutido no path — exatamente o que a
-- API Route de leitura já faz em código, mas repetir essa lógica aqui
-- em SQL cria uma segunda cópia da regra de autorização, que pode
-- divergir da rota com o tempo sem ninguém perceber (o mesmo tipo de
-- risco operacional já documentado para a policy de "cobrancas"/
-- "demandas" no hardening anterior — duas fontes de verdade para a
-- mesma regra). Por isso, a policy de staff abaixo é deliberadamente
-- "qualquer staff autenticado, qualquer path do bucket" — MESMA
-- superfície de organização que a policy ampla de hoje já tinha, só
-- que agora restrita a quem é staff de verdade (exclui qualquer
-- usuário do portal) e restrita a INSERT (não mais ALL).
--
-- RECOMENDAÇÃO (não implementada nesta migration): mover upload e
-- exclusão de staff para uma API Route server-side (mesmo padrão da
-- rota de leitura, app/api/documentos/url-assinada), que já resolve
-- organização/contrato/analise a partir de tabela real antes de deixar
-- gravar — isso fecha esse gap por completo, e uma vez migrado, a
-- policy de INSERT/DELETE para "authenticated" pode ser removida de
-- vez (só o service role escreveria no bucket). Ver seção "Upload e
-- exclusão" em docs/STORAGE_PRIVATE_MIGRATION_PROPOSAL.md.
-- ⚠️ PROVISÓRIA — não aprovada como desenho final, ver banner acima.
create policy "documentos_upload_staff" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'documentos'
    and exists (select 1 from public.users u where u.id = auth.uid())
  );

-- Locatário só pode enviar anexo de chamado (demanda), só dentro da
-- pasta da PRÓPRIA organização — "chamados/{organization_id}/{arquivo}"
-- (storage.foldername(name) retorna os segmentos de pasta, sem o nome
-- do arquivo: [1] = 'chamados', [2] = organization_id). Isto por si só
-- não garante que o arquivo vai ficar vinculado a uma demanda
-- específica dele (isso é responsabilidade da aplicação, ao gravar
-- demandas.fotos só com paths que ele mesmo acabou de enviar) — mas já
-- impede um locatário de gravar em qualquer outro prefixo do bucket
-- (contratos, analises, vistorias, logos) ou na pasta de chamados de
-- outra organização.
create policy "documentos_upload_locatario_chamado" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = 'chamados'
    and exists (
      select 1 from public.clientes c
      where c.usuario_portal_id = auth.uid()
        and c.tipo = 'locatario'
        and c.organization_id::text = (storage.foldername(name))[2]
    )
  );

-- Locador: nenhuma policy de INSERT nesta primeira versão — não há
-- hoje nenhum fluxo do produto em que o locador envie arquivo (o
-- Portal do locador só lê contrato/laudo/apólices, nunca escreve em
-- Storage). Se isso mudar, precisa de uma policy nova, não de alargar
-- alguma das duas acima.

-- ============================================================
-- EXCLUSÃO (DELETE) — só staff
-- ============================================================
-- Nenhum usuário do portal (locatário ou locador) tem policy de
-- DELETE — nem para os próprios anexos de chamado. Hoje o código do
-- portal (app/portal/page.tsx) nunca chama .remove(), então isso não
-- tira nenhuma funcionalidade existente; só fecha explicitamente a
-- possibilidade de um usuário do portal excluir qualquer objeto do
-- bucket, incluindo contrato assinado, laudo de vistoria, apólice ou
-- qualquer documento administrativo de terceiros — que é exatamente o
-- requisito pedido.
--
-- Mesma limitação de escopo por organização descrita acima (staff é
-- "qualquer staff autenticado", não validado contra a organização dona
-- do arquivo dentro da policy) — mesma recomendação de migrar para API
-- Route server-side quando esse nível de garantia for necessário.
-- ⚠️ PROVISÓRIA — não aprovada como desenho final, ver banner acima.
create policy "documentos_delete_staff" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'documentos'
    and exists (select 1 from public.users u where u.id = auth.uid())
  );

-- ============================================================
-- Rollback (se algo quebrar depois de aplicado):
--   drop policy if exists "documentos_upload_staff" on storage.objects;
--   drop policy if exists "documentos_upload_locatario_chamado" on storage.objects;
--   drop policy if exists "documentos_delete_staff" on storage.objects;
--   create policy "documentos_authenticated_all" on storage.objects
--     for all to authenticated
--     using (bucket_id = 'documentos')
--     with check (bucket_id = 'documentos');
-- ============================================================
