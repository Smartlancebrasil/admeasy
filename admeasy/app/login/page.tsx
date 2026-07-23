'use client'

import { Suspense, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

function ConteudoLogin() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [modoRecuperacao, setModoRecuperacao] = useState(false)
  const [emailRecuperacao, setEmailRecuperacao] = useState('')
  const [enviandoRecuperacao, setEnviandoRecuperacao] = useState(false)
  const [mensagemRecuperacao, setMensagemRecuperacao] = useState('')

  // Link "Solicitar novo link" (de /redefinir-senha ou /confirmar-recuperacao
  // quando o link original expirou) já abre direto no formulário de
  // recuperação, sem precisar clicar em "Esqueci minha senha" de novo.
  useEffect(() => {
    if (searchParams.get('recuperar') === '1') {
      setModoRecuperacao(true)
    }
  }, [searchParams])

  async function handleRecuperarSenha(e: React.FormEvent) {
    e.preventDefault()
    setEnviandoRecuperacao(true)
    setMensagemRecuperacao('')

    // URL canônica fixa (sem www) — nunca window.location.origin, que
    // variava conforme o usuário acessasse com ou sem "www" e gerava um
    // redirectTo fora da allowlist do Supabase (404 "Invalid path
    // specified in request URL", diagnosticado em produção).
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://admeasy.com.br'
    const redirectTo = `${appUrl.replace(/\/$/, '')}/redefinir-senha`
    const { error } = await supabase.auth.resetPasswordForEmail(emailRecuperacao, {
      redirectTo,
    })

    setEnviandoRecuperacao(false)
    // Mensagem sempre genérica, mesmo em erro — não confirma nem nega se
    // o e-mail existe na base (mesmo padrão de outras rotas de auth
    // deste projeto).
    setMensagemRecuperacao(
      error
        ? 'Não foi possível enviar o link agora. Tente novamente em instantes.'
        : 'Se este e-mail estiver cadastrado, você vai receber um link para redefinir sua senha.'
    )
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error || !data.user) {
      setErro('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }

    // Se quem logou faz parte da equipe AdmEasy (admin master), vai pro
    // painel de administração da plataforma em vez do dashboard normal.
    const { data: admin } = await supabase
      .from('admeasy_admins')
      .select('user_id')
      .eq('user_id', data.user.id)
      .maybeSingle()

    router.push(admin ? '/admin' : '/dashboard')
  }

  return (
    <div style={{ background: '#0d1117' }} className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo-admeasy.png" alt="AdmEasy" className="w-28 h-auto object-contain mx-auto" />
        </div>

        {/* Card */}
        <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-2xl p-8">
          {!modoRecuperacao ? (
            <>
              <h2 style={{ color: '#f4f4f3' }} className="text-lg font-semibold mb-6">Entrar na sua conta</h2>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="label">E-mail</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Senha</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="••••••••"
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    required
                  />
                </div>

                {erro && (
                  <div style={{ background: '#2e1717', border: '0.5px solid #4a2424', color: '#ef4444' }} className="text-sm px-3 py-2 rounded-lg">
                    {erro}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary w-full justify-center py-2.5"
                >
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => { setModoRecuperacao(true); setMensagemRecuperacao(''); setEmailRecuperacao(email) }}
                style={{ color: '#5b9bf5' }}
                className="text-xs text-center mt-6 w-full hover:underline"
              >
                Esqueci minha senha
              </button>
            </>
          ) : (
            <>
              <h2 style={{ color: '#f4f4f3' }} className="text-lg font-semibold mb-3">Recuperar senha</h2>
              <p style={{ color: '#8b8d98' }} className="text-sm mb-6">
                Informe seu e-mail — se estiver cadastrado, enviaremos um link para redefinir sua senha.
              </p>

              <form onSubmit={handleRecuperarSenha} className="space-y-4">
                <div>
                  <label className="label">E-mail</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="seu@email.com"
                    value={emailRecuperacao}
                    onChange={e => setEmailRecuperacao(e.target.value)}
                    required
                  />
                </div>

                {mensagemRecuperacao && (
                  <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a', color: '#8b9ab4' }} className="text-sm px-3 py-2 rounded-lg">
                    {mensagemRecuperacao}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={enviandoRecuperacao}
                  className="btn btn-primary w-full justify-center py-2.5"
                >
                  {enviandoRecuperacao ? 'Enviando...' : 'Enviar link de recuperação'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => setModoRecuperacao(false)}
                style={{ color: '#5b5e6b' }}
                className="text-xs text-center mt-6 w-full hover:underline"
              >
                Voltar para o login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <ConteudoLogin />
    </Suspense>
  )
}
