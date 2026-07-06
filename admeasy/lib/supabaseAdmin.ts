import { createClient } from '@supabase/supabase-js'

/**
 * Client administrativo do Supabase — usa a chave SECRETA (service_role)
 * e tem acesso total ao banco, ignorando qualquer RLS.
 *
 * NUNCA importe este arquivo em componentes 'use client' ou em qualquer
 * código que rode no navegador. Use apenas dentro de rotas de API
 * (arquivos app/api/.../route.ts), que rodam no servidor.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
