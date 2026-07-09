'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CheckCircle2, Check, X } from 'lucide-react'

type Plano = {
  nome: string
  limite_imoveis: number | null
  permite_multiplos_usuarios: boolean
  modulos: string[]
}

// Mesma lista/ordem usada em app/cadastro/page.tsx
const MODULOS_ORDEM: { chave: string; label: string }[] = [
  { chave: 'imoveis', label: 'Cadastro de imóveis' },
  { chave: 'contratos', label: 'Contratos' },
  { chave: 'clientes', label: 'Clientes' },
  { chave: 'financeiro', label: 'Financeiro' },
  { chave: 'portal_locatario', label: 'Portal do locatário' },
  { chave: 'reajuste', label: 'Reajuste de aluguel' },
  { chave: 'rescisao', label: 'Cálculo de rescisão' },
  { chave: 'demandas', label: 'Chamados' },
  { chave: 'dashboard_bi', label: 'Dashboard BI executivo' },
  { chave: 'fornecedores', label: 'Fornecedores' },
  { chave: 'visitas', label: 'Visitas' },
  { chave: 'vistorias', label: 'Vistorias' },
  { chave: 'analise_cadastral', label: 'Análise de locatários' },
  { chave: 'processos_judiciais', label: 'Processos judiciais' },
]

function labelImoveis(p: Plano) {
  return p.limite_imoveis ? `até ${p.limite_imoveis} imóveis` : 'acima de 50 imóveis'
}

export default function CadastroSucessoPage() {
  const params = useSearchParams()
  const orgId = params.get('org')
  const [plano, setPlano] = useState<Plano | null>(null)

  useEffect(() => {
    if (!orgId) return
    async function carregar() {
      const { data } = await supabase
        .from('organizations')
        .select('plano:planos(nome, limite_imoveis, permite_multiplos_usuarios, modulos)')
        .eq('id', orgId)
        .single()
      if (data?.plano) setPlano(data.plano as any)
    }
    carregar()
  }, [orgId])

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

        {plano && (
          <div style={{ background: '#fff' }} className="rounded-2xl p-6 text-left">
            <div style={{ color: '#0d1117' }} className="font-semibold text-lg mb-0.5">{plano.nome}</div>
            <div style={{ color: '#6b7280' }} className="text-xs mb-4">{labelImoveis(plano)}</div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                {plano.permite_multiplos_usuarios
                  ? <Check size={14} style={{ color: '#16a34a' }} className="flex-shrink-0" />
                  : <X size={14} style={{ color: '#dc2626' }} className="flex-shrink-0" />}
                <span style={{ color: '#1f2937' }} className="text-xs">{plano.permite_multiplos_usuarios ? 'Múltiplos usuários' : 'Usuário único'}</span>
              </div>
              {MODULOS_ORDEM.map(mod => {
                const tem = plano.modulos.includes(mod.chave)
                return (
                  <div key={mod.chave} className="flex items-center gap-2">
                    {tem
                      ? <Check size={14} style={{ color: '#16a34a' }} className="flex-shrink-0" />
                      : <X size={14} style={{ color: '#dc2626' }} className="flex-shrink-0" />}
                    <span style={{ color: tem ? '#1f2937' : '#9ca3af' }} className="text-xs">{mod.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
