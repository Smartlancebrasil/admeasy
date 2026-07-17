'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type PapelUsuario = 'admin' | 'corretor' | 'locador' | 'locatario'

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
  papel: 'admin' | 'corretor' | null
  loading: boolean
  erro: string
}

const OrganizationContext = createContext<OrganizationContextType>({
  organizacao: null,
  papel: null,
  loading: true,
  erro: '',
})

export function useOrganization() {
  return useContext(OrganizationContext)
}

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [organizacao, setOrganizacao] = useState<Organizacao | null>(null)
  const [papel, setPapel] = useState<'admin' | 'corretor' | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    carregarOrganizacao()
  }, [])

  async function carregarOrganizacao() {
    try {
      const { data: sessionData, error: sessionError } = await supabase