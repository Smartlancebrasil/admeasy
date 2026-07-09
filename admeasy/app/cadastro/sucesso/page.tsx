'use client'

import { CheckCircle2 } from 'lucide-react'

export default function CadastroSucessoPage() {
  return (
    <div style={{ background: '#0d1117' }} className="min-h-screen flex items-center justify-center p-4 py-10">
      <div className="max-w-md w-full text-center">
        <img src="/logo-admeasy.png" alt="AdmEasy" className="w-28 h-auto object-contain mx-auto mb-6" />
        <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-2xl p-8 mb-4">
          <CheckCircle2 size={48} style={{ color: '#3fb950' }} className="mx-auto mb-4" />
          <h1 style={{ color: '#f4f4f3' }} className="text-xl font-semibold mb-2">Tudo certo!</h1>
          <p style={{ color: '#8b9ab4' }} className="text-sm mb-6">
            Sua conta foi criada e seus 7 dias grátis já começaram. Nada foi cobrado hoje — a primeira cobrança só acontece depois do período de teste.
          </p>
          <a href="/login" className="btn btn-primary w-full justify-center py-2.5">
            Entrar no AdmEasy
          </a>
        </div>
      </div>
    </div>
  )
}
