import AppLayout from '@/components/layout/AppLayout'

export default function Page() {
  return (
    <AppLayout>
      <div style={{ background: '#0d1117', minHeight: '100vh' }} className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1600px] mx-auto">
          <h1 style={{ color: '#f4f4f3' }} className="text-lg font-medium mb-5">Visitas</h1>
          <div className="card text-center py-16" style={{ color: '#8b8d98' }}>
            <div className="text-4xl mb-3">🚧</div>
            <div style={{ color: '#c3c2b7' }} className="font-medium">Módulo em desenvolvimento</div>
            <div className="text-sm mt-1">Em breve disponível</div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
