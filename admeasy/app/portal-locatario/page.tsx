import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'

export default function Page() {
  return (
    <AppLayout>
      <Topbar titulo="Portal Locatario" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="card text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🚧</div>
          <div className="font-medium">Módulo em desenvolvimento</div>
          <div className="text-sm mt-1">Em breve disponível</div>
        </div>
      </div>
    </AppLayout>
  )
}
