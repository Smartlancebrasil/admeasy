'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { LayoutDashboard, LogOut, Building2 } from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [verificando, setVerificando] = useState(true)

  useEffect(() => {
    async function verificar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data: admin } = await supabase
        .from('admeasy_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!admin) { router.replace('/login'); return }
      setVerificando(false)
    }
    verificar()
  }, [router])

  if (verificando) {
    return (
      <div style={{ background: '#0d1117', minHeight: '100vh' }} className="flex items-center justify-center">
        <div style={{ color: '#8b8d98' }} className="text-sm">Verificando acesso...</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#0d1117' }}>
      <aside style={{ background: '#0d1117', borderRight: '0.5px solid #2a2f3a' }} className="w-56 min-w-[224px] flex flex-col h-screen sticky top-0">
        <div style={{ borderBottom: '0.5px solid #2a2f3a' }} className="p-4">
          <div style={{ color: '#f4f4f3' }} className="text-sm font-semibold">AdmEasy</div>
          <div style={{ color: '#8b8d98' }} className="text-[10px]">Admin Master</div>
        </div>
        <nav className="flex-1 p-2">
          <Link href="/admin" style={{ color: '#5b9bf5' }} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm bg-[#1c2530]">
            <LayoutDashboard size={15} />Clientes
          </Link>
        </nav>
        <div style={{ borderTop: '0.5px solid #2a2f3a' }} className="p-2">
          <Link href="/dashboard" style={{ color: '#a8aab5' }} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm hover:bg-[#161b22] transition-all">
            <Building2 size={15} />Painel da Echelli
          </Link>
        </div>
        <div style={{ borderTop: '0.5px solid #2a2f3a' }} className="p-3">
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            style={{ color: '#5b5e6b' }}
            className="flex items-center gap-2 text-xs hover:text-red-400 transition-colors px-2 py-1.5"
          >
            <LogOut size={13} />Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
