'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard, Building2, Users, FileText, TrendingUp,
  Calculator, Wrench, Truck, Calendar, DollarSign,
  UserCircle, BuildingIcon, Settings, LogOut, FileSearch,
  ShieldCheck, Scale
} from 'lucide-react'

const navItems = [
  { section: 'Principal' },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/imoveis', label: 'Imóveis', icon: Building2 },
  { href: '/contratos', label: 'Contratos', icon: FileText, badge: 3 },
  { href: '/reajuste', label: 'Reajuste', icon: TrendingUp },
  { href: '/rescisao', label: 'Calc. rescisão', icon: Calculator },
  { href: '/processos-judiciais', label: 'Processos judiciais', icon: Scale },
  { section: 'Partes' },
  { href: '/analise-cadastral', label: 'Análise cadastral', icon: ShieldCheck },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/portal-locatario', label: 'Portal locatário', icon: UserCircle },
  { href: '/portal-locador', label: 'Portal locador', icon: BuildingIcon },
  { section: 'Operações' },
  { href: '/demandas', label: 'Demandas', icon: Wrench, badge: 4 },
  { href: '/fornecedores', label: 'Fornecedores', icon: Truck },
  { href: '/visitas', label: 'Visitas', icon: Calendar },
  { href: '/vistorias', label: 'Vistorias', icon: FileSearch },
  { href: '/financeiro', label: 'Financeiro', icon: DollarSign },
  { section: 'Config' },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [perfilUsuario, setPerfilUsuario] = useState('Admin')
  const [iniciaisUsuario, setIniciaisUsuario] = useState('??')

  useEffect(() => {
    async function carregarUsuario() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('users').select('nome, perfil').eq('id', user.id).single()
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

  return (
    <aside style={{ background: '#0d1117', borderRight: '0.5px solid #2a2f3a' }} className="w-56 min-w-[224px] flex flex-col h-screen sticky top-0">
      <div style={{ borderBottom: '0.5px solid #2a2f3a' }} className="p-4">
        <div className="flex items-center gap-2.5">
          <div style={{ background: '#2563eb' }} className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm">🏢</div>
          <div>
            <div style={{ color: '#f4f4f3' }} className="text-sm font-semibold">AdmEasy</div>
            <div style={{ color: '#8b8d98' }} className="text-[10px]">Gestão imobiliária</div>
          </div>
        </div>
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
          return (
            <Link key={item.href} href={item.href}
              style={active ? { background: '#1c2530', color: '#5b9bf5' } : { color: '#a8aab5' }}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm mb-0.5 transition-all hover:bg-[#161b22]">
              <Icon size={15} className="flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span style={{ background: '#ef4444' }} className="text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">{item.badge}</span>
              )}
            </Link>
          )
        })}
      </nav>

      <div style={{ borderTop: '0.5px solid #2a2f3a' }} className="p-3">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[#161b22]">
          <div style={{ background: '#1c2530', color: '#5b9bf5' }} className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium">
            {iniciaisUsuario}
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ color: '#f4f4f3' }} className="text-xs font-medium truncate">{nomeUsuario}</div>
            <div style={{ color: '#8b8d98' }} className="text-[10px] capitalize">{perfilUsuario}</div>
          </div>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
            title="Sair" style={{ color: '#5b5e6b' }} className="hover:text-red-400 transition-colors">
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}
