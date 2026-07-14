'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useOrganization } from '@/lib/OrganizationContext'
import {
  LayoutDashboard, Building2, Users, FileText, TrendingUp,
  Calculator, Wrench, Truck, Calendar, DollarSign,
  UserCircle, BuildingIcon, Settings, LogOut, FileSearch,
  ShieldCheck, X, Wallet
} from 'lucide-react'

// ORG_ID fixo removido — agora vem do useOrganization() (multi-tenant)

const STATUS_DEMANDA_FINALIZADA = ['concluida', 'recusada']

const navItems = [
  { section: 'Principal' },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/financeiro', label: 'Financeiro', icon: DollarSign },
  { href: '/custos', label: 'Custos', icon: Wallet },
  { href: '/imoveis', label: 'Cadastro Imóveis', icon: Building2 },
  { href: '/contratos', label: 'Contratos', icon: FileText, badge: 3 },
  { href: '/vistorias', label: 'Laudo de Vistoria', icon: FileSearch },
  { section: 'Partes' },
  { href: '/clientes', label: 'Cadastro Cliente', icon: Users },
  { href: '/portal-locatario', label: 'Portal locatário', icon: UserCircle },
  { href: '/fornecedores', label: 'Fornecedores', icon: Truck },
  { section: 'Operações' },
  { href: '/demandas', label: 'Chamados', icon: Wrench }, // badge agora é dinâmico, ver render
  { href: '/visitas', label: 'Visitas', icon: Calendar },
  { href: '/analise-cadastral', label: 'Análise Locatários', icon: ShieldCheck },
  { href: '/rescisao', label: 'Cálculo de Rescisão', icon: Calculator },
  { href: '/reajuste', label: 'Reajustes', icon: TrendingUp },
  { section: 'Config' },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
]

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { organizacao } = useOrganization()
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [perfilUsuario, setPerfilUsuario] = useState('Admin')
  const [iniciaisUsuario, setIniciaisUsuario] = useState('??')
  const [logoUrl, setLogoUrl] = useState('')
  const [nomeOrg, setNomeOrg] = useState('AdmEasy')
  const [demandasPendentes, setDemandasPendentes] = useState(0)

  useEffect(() => {
    async function carregarUsuario() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('users').select('nome, perfil').eq('id', user.id).maybeSingle()
      if (data) {
        setNomeUsuario(data.nome || user.email || '')
        setPerfilUsuario(data.perfil || 'Admin')
        const iniciais = (data.nome || user.email || '??')
          .split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()
        setIniciaisUsuario(iniciais)
      } else {
        const nome = user.email || '??'
        setNomeUsuario(nome)
        setIniciaisUsuario(nome.slice(0, 2).toUpperCase())
      }
    }
    carregarUsuario()
  }, [])

  useEffect(() => {
    if (!organizacao?.id) return

    // Nome/logo já vêm do OrganizationContext, mas se não vierem preenchidos
    // (ex: campos nulos), usamos os dados já carregados como fallback.
    setNomeOrg(organizacao.nome || 'AdmEasy')
    if (organizacao.logo_url) setLogoUrl(organizacao.logo_url)

    async function carregarDemandasPendentes(orgId: string) {
      const { count, error } = await supabase
        .from('demandas')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .not('status', 'in', `(${STATUS_DEMANDA_FINALIZADA.join(',')})`)

      if (!error && typeof count === 'number') {
        setDemandasPendentes(count)
      }
    }

    carregarDemandasPendentes(organizacao.id)
  }, [organizacao?.id, organizacao?.nome, organizacao?.logo_url])

  return (
    <aside
      style={{ background: '#0d1117', borderRight: '0.5px solid #2a2f3a' }}
      className="w-64 lg:w-56 min-w-[224px] flex flex-col h-screen sticky top-0"
    >
      <div style={{ borderBottom: '0.5px solid #2a2f3a' }} className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain flex-shrink-0" style={{ background: '#fff' }} />
          ) : (
            <div style={{ background: '#2563eb' }} className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm flex-shrink-0">🏢</div>
          )}
          <div className="min-w-0">
            <div style={{ color: '#f4f4f3' }} className="text-sm font-semibold truncate">{nomeOrg}</div>
            <div style={{ color: '#8b8d98' }} className="text-[10px]">Gestão imobiliária</div>
          </div>
        </div>
        <button
          onClick={onNavigate}
          style={{ color: '#5b5e6b' }}
          className="lg:hidden p-1 flex-shrink-0"
          aria-label="Fechar menu"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {navItems.map((item, i) => {
          if ('section' in item) {
            return (
              <div key={i} style={{ color: '#5b5e6b' }} className="text-[10px] font-medium uppercase tracking-wider px-2 pt-4 pb-1">
                {item.section}
              </div>
            )
          }
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const badgeValue = item.href === '/demandas' ? demandasPendentes : item.badge
          return (
            <Link key={item.href} href={item.href} onClick={onNavigate}
              style={active ? { background: '#1c2530', color: '#5b9bf5' } : { color: '#a8aab5' }}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm mb-0.5 transition-all hover:bg-[#161b22]">
              <Icon size={15} className="flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {!!badgeValue && (
                <span style={{ background: '#ef4444' }} className="text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">{badgeValue}</span>
              )}
            </Link>
          )
        })}
      </nav>

      <div style={{ borderTop: '0.5px solid #2a2f3a' }} className="p-3">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[#161b22]">
          <div style={{ background: '#1c2530', color: '#5b9bf5' }} className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
            {iniciaisUsuario}
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ color: '#f4f4f3' }} className="text-xs font-medium truncate">{nomeUsuario}</div>
            <div style={{ color: '#8b8d98' }} className="text-[10px] capitalize">{perfilUsuario}</div>
          </div>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
            title="Sair" style={{ color: '#5b5e6b' }} className="hover:text-red-400 transition-colors flex-shrink-0">
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}
