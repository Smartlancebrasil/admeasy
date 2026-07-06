'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Organizacao = {
  id: string
  nome: string
  plano: string
  status_assinatura: string
  cor_primaria: string | null
  logo_url: string | null
}

type OrganizationContextType = {
  organizacao: Organizacao | null
  loading: boolean
  erro: string
}

const OrganizationContext = createContext<OrganizationContextType>({
  organizacao: null,
  loading: true,
  erro: '',
})

export function useOrganization() {
  return useContext(OrganizationContext)
}

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [organizacao, setOrganizacao] = useState<Organizacao | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    carregarOrganizacao()
  }, [])

  async function carregarOrganizacao() {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        console.error('[OrganizationContext] Erro ao buscar sessão:', sessionError)
        setErro('Erro ao verificar sessão. Tente atualizar a página.')
        setLoading(false)
        return
      }

      const user = sessionData?.session?.user

      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('usuarios_organizacao')
        .select('papel, organization:organizations(id, nome, plano, status_assinatura, cor_primaria, logo_url)')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        console.error('[OrganizationContext] Erro na query:', error)
        setErro('Erro ao carregar sua organização. Tente atualizar a página.')
        setLoading(false)
        return
      }

      if (!data || !data.organization) {
        console.warn('[OrganizationContext] Usuário sem vínculo de organização.')
        setErro('Seu usuário não está vinculado a nenhuma organização. Fale com o suporte.')
        setLoading(false)
        return
      }

      const org = Array.isArray(data.organization) ? data.organization[0] : data.organization

      if (org.status_assinatura === 'suspenso' || org.status_assinatura === 'cancelado') {
        setErro('Sua assinatura está inativa. Entre em contato para regularizar o acesso.')
        setLoading(false)
        return
      }

      setOrganizacao(org)
      setLoading(false)
    } catch (e) {
      console.error('[OrganizationContext] Exceção inesperada:', e)
      setErro('Erro inesperado ao carregar a organização. Tente atualizar a página.')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#0d1117' }}>
        <span style={{ color: '#8b8d98' }} className="text-sm">Carregando...</span>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4" style={{ background: '#0d1117' }}>
        <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a', color: '#fca5a5' }} className="rounded-xl p-6 max-w-sm text-center text-sm">
          {erro}
        </div>
      </div>
    )
  }

  return (
    <OrganizationContext.Provider value={{ organizacao, loading, erro }}>
      {children}
    </OrganizationContext.Provider>
  )
}
