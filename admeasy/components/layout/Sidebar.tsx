'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard, Building2, Users, FileText, TrendingUp,
  Calculator, Wrench, Truck, Calendar, DollarSign,
  UserCircle, BuildingIcon, Settings, ChevronRight, LogOut, FileSearch
} from 'lucide-react'

const navItems = [
  { section: 'Principal' },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/imoveis', label: 'Imóveis', icon: Building2 },
  { href: '/contratos', label: 'Contratos', icon: FileText, badge: 3 },
  { href: '/reajuste', label: 'Reajuste', icon: TrendingUp },
  { href: '/rescisao', label: 'Calc. rescisão', icon: Calculator },
  { section: 'Partes' },
  { href: '/analise-cadastral', label: 'Análise cadastral', icon: ClipboardCheck },
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

      const { data } = await supabase
        .from('users')
        .select('nome, perfil')
        .eq('id', user.id)
        .single()

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
    <aside className="w-56 min-w-[224px] bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm">
            🏢
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">AdmEasy</div>
            <div className="text-[10px] text-gray-400">Gestão imobiliária</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2">
        {navItems.map((item, i) => {
          if ('section' in item) {
            return (
              <div key={i} className="text-[10px] font-medium text-gray-400 uppercase tracking-wider px-2 pt-4 pb-1">
                {item.section}
              </div>
            )
          }

          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + '/')

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm mb-0.5 transition-all',
                active
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon size={15} className="flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-gray-100">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50">
          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium">
            {iniciaisUsuario}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-900 truncate">{nomeUsuario}</div>
            <div className="text-[10px] text-gray-400 capitalize">{perfilUsuario}</div>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/login'
            }}
            title="Sair"
            className="text-gray-300 hover:text-red-500 transition-colors"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}