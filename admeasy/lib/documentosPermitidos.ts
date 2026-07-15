// Allowlist única de extensão/MIME/tamanho pro bucket "documentos" —
// compartilhada entre a rota de leitura (url-assinada), a rota de
// upload administrativo e a migration de bucket, pra não deixar listas
// divergentes em lugares diferentes (ver docs/STORAGE_PRIVATE_MIGRATION_PROPOSAL.md,
// Seção 0.4). Se mudar aqui, mudar também em
// supabase/migrations/20260714030000_storage_bucket_privado.sql
// (allowed_mime_types do bucket) — não há como um código TypeScript
// alterar uma migration SQL automaticamente, então essa cópia não é
// eliminável, só minimizada a estes dois lugares.

export const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024 // 10 MB — mesmo limite do bucket

export const EXTENSOES_PERMITIDAS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx'])

export const MIME_PERMITIDOS = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

export function extensaoDoNome(nomeArquivo: string): string {
  return nomeArquivo.includes('.') ? nomeArquivo.split('.').pop()!.toLowerCase() : ''
}
