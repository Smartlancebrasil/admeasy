'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

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
          <div style={{ background: '#fff' }} className="inline-flex items-center justify-center rounded-2xl p-4 mb-2">
            <img src="/logo-admeasy.png" alt="AdmEasy" className="w-40 h-40 object-contain" />
          </div>
        </div>

        {/* Card */}
        <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-2xl p-8">
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

          <p style={{ color: '#5b5e6b' }} className="text-xs text-center mt-6">
            Problemas para acessar? Fale com o administrador.
          </p>
        </div>
      </div>
    </div>
  )
}
