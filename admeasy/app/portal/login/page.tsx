'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginPortal } from '@/lib/portal-auth'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'

export default function PortalLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    const { user, erro: erroLogin } = await loginPortal(email, senha)

    setCarregando(false)

    if (erroLogin || !user) {
      setErro(erroLogin || 'Não foi possível entrar.')
      return
    }

    router.push('/portal')
  }

  return (
    <div style={{ background: '#060D1C', minHeight: '100vh' }} className="flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-white font-bold text-xl mb-1">Portal do locatário</h1>
          <p style={{ color: '#8b9ab4' }} className="text-sm">Entre com seu e-mail e senha</p>
        </div>

        <form
          onSubmit={entrar}
          style={{ background: '#0d1b2e', border: '0.5px solid #1e3a5f' }}
          className="rounded-2xl p-6 space-y-4"
        >
          <div>
            <label style={{ color: '#8b9ab4' }} className="block text-xs mb-1.5">E-mail</label>
            <div style={{ background: '#060D1C', border: '0.5px solid #1e3a5f' }} className="flex items-center gap-2 rounded-lg px-3">
              <Mail size={15} style={{ color: '#8b9ab4' }} />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                style={{ color: '#f4f4f3' }}
                className="w-full py-2.5 bg-transparent text-sm focus:outline-none placeholder-gray-600"
              />
            </div>
          </div>

          <div>
            <label style={{ color: '#8b9ab4' }} className="block text-xs mb-1.5">Senha</label>
            <div style={{ background: '#060D1C', border: '0.5px solid #1e3a5f' }} className="flex items-center gap-2 rounded-lg px-3">
              <Lock size={15} style={{ color: '#8b9ab4' }} />
              <input
                type={mostrarSenha ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="••••••••"
                style={{ color: '#f4f4f3' }}
                className="w-full py-2.5 bg-transparent text-sm focus:outline-none placeholder-gray-600"
              />
              <button type="button" onClick={() => setMostrarSenha(v => !v)} style={{ color: '#8b9ab4' }}>
                {mostrarSenha ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {erro && (
            <div style={{ background: '#2e1717', border: '0.5px solid #4a2424' }} className="rounded-lg p-3">
              <p style={{ color: '#ef4444' }} className="text-xs">{erro}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            style={{ background: '#1A7FFF' }}
            className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p style={{ color: '#5b5e6b' }} className="text-xs text-center mt-6">
          Esqueceu a senha? Fale com a imobiliária responsável pelo seu contrato.
        </p>
      </div>
    </div>
  )
}
