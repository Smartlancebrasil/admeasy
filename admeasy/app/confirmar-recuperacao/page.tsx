'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { validarDominioConfirmacao } from '@/lib/passwordRecoverySeguranca'

// ============================================================
// Página intermediária pública — existe pra nunca deixar o e-mail de
// recuperação apontar direto pro link de uso único do Supabase.
//
// Scanners de segurança de provedores de e-mail (Outlook Safe Links,
// filtros corporativos, o próprio preview do Resend) fazem um GET
// automático em qualquer link de um e-mail recebido, pra checar se é
// seguro — isso consome o token de uso único do Supabase ANTES do
// usuário real clicar, resultando em "otp_expired" mesmo num link que
// nunca foi realmente usado por ninguém.
//
// Esta página quebra esse problema: o e-mail aponta pra cá (mesmo
// domínio da Admeasy), não pro Supabase. Um GET automático de scanner
// nesta página não consome nada — só renderiza um botão. O link real
// do Supabase (recebido como parâmetro, nunca logado) só é acessado
// quando o usuário clica deliberadamente em "Continuar redefinição" —
// scanners não simulam cliques.
// ============================================================

function ConteudoConfirmarRecuperacao() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [navegando, setNavegando] = useState(false)

  // Nunca logado, nunca exibido na tela — só usado internamente pra
  // navegação, e só depois de validado.
  const confirmationUrlBruta = searchParams.get('confirmation_url')

  const valido = useMemo(() => {
    if (!confirmationUrlBruta) return false
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) return false
    return validarDominioConfirmacao(confirmationUrlBruta, supabaseUrl)
  }, [confirmationUrlBruta])

  function continuar() {
    if (!valido || !confirmationUrlBruta) return
    setNavegando(true)
    // Navegação real do navegador — é o Supabase quem processa o token
    // e redireciona pra /redefinir-senha em seguida, exatamente como
    // já funcionava antes desta camada intermediária.
    window.location.href = confirmationUrlBruta
  }

  return (
    <div style={{ background: '#0d1117' }} className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo-admeasy.png" alt="AdmEasy" className="w-28 h-auto object-contain mx-auto" />
        </div>

        <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-2xl p-8">
          {!valido ? (
            <>
              <h2 style={{ color: '#f4f4f3' }} className="text-lg font-semibold mb-3">Link inválido</h2>
              <p style={{ color: '#8b8d98' }} className="text-sm mb-6">
                Este link de confirmação não é válido ou não pôde ser verificado. Solicite um novo link de
                redefinição de senha.
              </p>
              <button
                onClick={() => router.replace('/login?recuperar=1')}
                className="btn btn-primary w-full justify-center py-2.5"
              >
                Solicitar novo link
              </button>
            </>
          ) : (
            <>
              <h2 style={{ color: '#f4f4f3' }} className="text-lg font-semibold mb-3">Redefinição de senha solicitada</h2>
              <p style={{ color: '#8b8d98' }} className="text-sm mb-6">
                Recebemos uma solicitação para redefinir a senha da sua conta Admeasy. Se foi você quem
                solicitou, clique no botão abaixo para continuar. Se você não fez essa solicitação, pode
                ignorar esta página com segurança — nada será alterado.
              </p>
              <button
                onClick={continuar}
                disabled={navegando}
                className="btn btn-primary w-full justify-center py-2.5"
              >
                {navegando ? 'Redirecionando...' : 'Continuar redefinição'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ConfirmarRecuperacaoPage() {
  return (
    <Suspense fallback={null}>
      <ConteudoConfirmarRecuperacao />
    </Suspense>
  )
}
