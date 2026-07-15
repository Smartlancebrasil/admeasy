-- ============================================================
-- Storage — tornar o bucket "documentos" privado + limites
-- Admeasy Connect — proposta para revisão, NÃO APLICADA
-- ============================================================
-- ATENÇÃO: proposta para revisão. Não foi rodada contra o banco de
-- produção. Ver docs/STORAGE_PRIVATE_MIGRATION_PROPOSAL.md — essa
-- migration SÓ deve ser aplicada DEPOIS que:
--   1) A API Route de URL assinada (app/api/documentos/url-assinada)
--      já estiver deployada e testada em produção.
--   2) As 7 telas listadas no documento de proposta já estiverem
--      usando essa rota em vez de getPublicUrl().
--   3) Os arquivos de logo já tiverem sido migrados pra um bucket
--      separado e público (ver Seção 6 do documento de proposta) —
--      senão os logos ficam quebrados junto com o resto.
--
-- Confirmado ao vivo em 2026-07-14 (consulta feita por você no
-- painel do Supabase): storage.buckets.public = true,
-- file_size_limit = null, allowed_mime_types = null.
--
-- Estado esperado ANTES de rodar esta migration (senão os arquivos já
-- enviados continuam expostos até esta parte ser aplicada):
--   - Todas as 7 telas já geram link via API Route, não mais via
--     getPublicUrl() direto.
--
-- CORRIGIDO em 2026-07-14 (achado da auditoria final): a lista original
-- de allowed_mime_types (pdf/jpeg/png/webp) não cobria dois pontos de
-- upload reais que aceitam Word — app/analise-cadastral/page.tsx:347
-- (accept=".pdf,.jpg,.jpeg,.png,.doc,.docx") e app/portal/page.tsx:440
-- (accept="image/*,.pdf,.doc,.docx", anexo de chamado). Sem esta
-- correção, aplicar a migration quebraria upload de .doc/.docx nessas
-- duas telas no mesmo instante em que fosse aplicada. Adicionados os
-- dois MIME types de Word (.doc e .docx); PDF/JPEG/PNG/WEBP mantidos.
-- Limite de tamanho mantido em 10 MB — nenhum input do sistema hoje
-- indica necessidade de arquivo maior que isso.

update storage.buckets
set
  public = false,
  file_size_limit = 10485760, -- 10 MB por arquivo — ver Seção 7 do documento de proposta
  allowed_mime_types = array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',                                                      -- .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'  -- .docx
  ]
where id = 'documentos';

-- ============================================================
-- Rollback (se algo quebrar depois de aplicado):
--   update storage.buckets
--   set public = true, file_size_limit = null, allowed_mime_types = null
--   where id = 'documentos';
-- ============================================================
