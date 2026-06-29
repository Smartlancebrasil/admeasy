import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { FilePlus } from 'lucide-react'

const contratos = [
  { num: '#042', imovel: 'Ap. 304 Bloco B', locatario: 'Maria Costa', locador: 'Ana Faria', inicio: '01/07/23', fim: '05/07/24', valor: 2800, indice: 'IGP-M', status: 'vencendo' },
  { num: '#039', imovel: 'Casa Jd. América', locatario: 'Carlos Lima', locador: 'Roberto M.', inicio: '15/08/22', fim: '18/07/24', valor: 4200, indice: 'IPCA', status: 'atencao' },
  { num: '#028', imovel: 'Studio 12A', locatario: 'Ana Beatriz', locador: 'Fernanda L.', inicio: '01/03/24', fim: '01/03/25', valor: 1900, indice: 'IGP-M', status: 'ativo' },
]

const statusBadge: Record<string, string> = {
  vencendo: 'badge badge-red',
  atencao: 'badge badge-yellow',
  ativo: 'badge badge-green',
}
const statusLabel: Record<string, string> = {
  vencendo: 'Vencendo',
  atencao: 'Atenção',
  ativo: 'Ativo',
}

export default function ContratosPage() {
  return (
    <AppLayout>
      <Topbar titulo="Contratos">
        <button className="btn btn-primary"><FilePlus size={14} /> Novo contrato</button>
      </Topbar>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['#', 'Imóvel', 'Locatário', 'Locador', 'Início', 'Vencimento', 'Valor', 'Índice', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contratos.map((c) => (
                <tr key={c.num} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 text-xs">{c.num}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.imovel}</td>
                  <td className="px-4 py-3 text-gray-600">{c.locatario}</td>
                  <td className="px-4 py-3 text-gray-600">{c.locador}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{c.inicio}</td>
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: c.status === 'vencendo' ? '#dc2626' : c.status === 'atencao' ? '#d97706' : '#16a34a' }}>{c.fim}</td>
                  <td className="px-4 py-3 font-medium">R$ {c.valor.toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.indice}</td>
                  <td className="px-4 py-3"><span className={statusBadge[c.status]}>{statusLabel[c.status]}</span></td>
                  <td className="px-4 py-3"><button className="btn text-xs py-1 px-2.5">Ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  )
}
