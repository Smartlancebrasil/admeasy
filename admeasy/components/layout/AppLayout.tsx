'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [menuAberto, setMenuAberto] = useState(false)

  return (
    <div className="flex min-h-screen" style={{ background: '#0d1117' }}>
      {/* Overlay mobile */}
      {menuAberto && (
        <div
          onClick={() => setMenuAberto(false)}
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.6)' }}
        />
      )}

      {/* Sidebar: drawer no mobile, fixo no desktop */}
      <div
        className={`fixed lg:static inset-y-0 left-0 z-50 transition-transform duration-200 lg:translate-x-0 ${
          menuAberto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onNavigate={() => setMenuAberto(false)} />
      </div>

      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {/* Header mobile */}
        <div
          className="lg:hidden flex items-center gap-3 px-4 py-3 sticky top-0 z-30"
          style={{ background: '#0d1117', borderBottom: '0.5px solid #2a2f3a' }}
        >
          <button
            onClick={() => setMenuAberto(true)}
            style={{ color: '#c3c2b7' }}
            className="p-1"
            aria-label="Abrir menu"
          >
            <Menu size={22} />
          </button>
          <span style={{ color: '#f4f4f3' }} className="text-sm font-semibold">AdmEasy</span>
        </div>

        {children}
      </main>
    </div>
  )
}
