'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ============================================================
// Página intermediária pública — existe pra nunca deixar o e-mail de
// recuperação apontar direto pro link de uso único do Supabase.
//
// Scanners de segurança de provedores de e-mail (Outlook Safe Links,
// filtros corporativos, o próprio preview do Resend) fazem um GET
// automático em qualquer link de um e-mail recebido, pra checar se é
// seguro. Como quem recebe esse GET é sempre /api/auth/recuperacao/
// iniciar (nunca o Supabase diretamente), e essa rota nunca consome
// nada, um scanner que a acesse só recebe um cookie na própria sessão
// HTTP efêmera dele — nunca no navegador real do usuário.
//
// Esta página em si NUNCA recebe o token em parâmetro de URL — a URL
// é sempre limpa (sem query string). Ela só pergunta ao servidor
// (via /status) se existe uma recuperação pendente, e só troca o
// cookie pelo token (via /token) depois de um clique humano real em
// "Continuar redefinição".
// ============================================================

type Estado = 'carregando' | 'pronto' | 'confirmando' | 'invalido'

export default function ConfirmarRecuperacaoPage() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>('carregando')

  useEffect(() => {
    let cancelado = false

    fetch('/api/auth/recuperacao/status', { cache: 'no-store' })
      .then(resposta => resposta.json())
      .then((dados: { pronto: boolean }) => {
        if (cancelado) return
        setEstado(dados.pronto ? 'pronto' : 'invalido')
      })
      .catch(() => {
        if (!cancelado) setEstado('invalido')
      })

    return () => {
      cancelado = true
    }
  }, [])

  async function continuar() {
    setEstado('confirmando')

    try {
      const resposta = await fetch('/api/auth/recuperacao/token', { method: 'POST', cache: 'no-store' })
      if (!resposta.ok) {
        setEstado('invalido')
        return
      }

      const { token_hash, type } = (await resposta.json()) as { token_hash: string; type: 'recovery' }

      // Verificação client-side (mesmo client já usado no resto do
      // app) — mantém a sessão em localStorage, sem precisar migrar a
      // aplicação inteira pra sessão em cookie. Dispara o evento
      // PASSWORD_RECOVERY, o mesmo que /redefinir-senha já escuta.
      const { error } = await supabase.auth.verifyOtp({ type, token_hash })

      if (error) {
        console.warn('[confirmar-recuperacao] verifyOtp rejeitado pelo Supabase:', error.message)
        setEstado('invalido')
        return
      }

      router.push('/redefinir-senha')
    } catch {
      setEstado('invalido')
    }
  }

  return (
    <div style={{ background: '#0d1117' }} className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo-admeasy.png" alt="AdmEasy" className="w-28 h-auto object-contain mx-auto" />
        </div>

        <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-2xl p-8">
          {estado === 'carregando' && (
            <p style={{ color: '#8b8d98' }} className="text-sm text-center py-6">Verificando o link...</p>
          )}

          {estado === 'invalido' && (
            <>
              <h2 style={{ color: '#f4f4f3' }} className="text-lg font-semibold mb-3">Link inválido ou expirado</h2>
              <p style={{ color: '#8b8d98' }} className="text-sm mb-6">
                Este link de confirmação não é mais válido — pode já ter sido usado, aberto em outra aba, ou
                expirado. Solicite um novo link de redefinição de senha.
              </p>
              <button
                onClick={() => router.replace('/login?recuperar=1')}
                className="btn btn-primary w-full justify-center py-2.5"
              >
                Solicitar novo link
              </button>
            </>
          )}

          {(estado === 'pronto' || estado === 'confirmando') && (
            <>
              <h2 style={{ color: '#f4f4f3' }} className="text-lg font-semibold mb-3">Redefinição de senha solicitada</h2>
              <p style={{ color: '#8b8d98' }} className="text-sm mb-6">
                Recebemos uma solicitação para redefinir a senha da sua conta Admeasy. Se foi você quem
                solicitou, clique no botão abaixo para continuar. Se você não fez essa solicitação, pode
                ignorar esta página com segurança — nada será alterado.
              </p>
              <button
                onClick={continuar}
                disabled={estado === 'confirmando'}
                className="btn btn-primary w-full justify-center py-2.5"
              >
                {estado === 'confirmando' ? 'Confirmando...' : 'Continuar redefinição'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
