import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { UserPlus, Search } from 'lucide-react'

const clientes = [
  { id: 1, nome: 'Maria Costa', tipo: 'Locatária', cpf: '123.456.789-00', telefone: '(11) 99123-4567', status: 'ativo', portal: true, iniciais: 'MC', cor: 'blue' },
  { id: 2, nome: 'Ana Faria', tipo: 'Locadora', cpf: '987.654.321-00', telefone: '(11) 96543-2109', status: 'ativo', portal: true, iniciais: 'AF', cor: 'green' },
  { id: 3, nome: 'Carlos Lima', tipo: 'Locatário', cpf: '456.789.123-00', telefone: '(11) 97654-3210', status: 'ativo', portal: false, iniciais: 'CL', cor: 'blue' },
  { id: 4, nome: 'Lucas Ferreira', tipo: 'Lead', cpf: '321.654.987-00', telefone: '(11) 94321-0987', status: 'lead', portal: false, iniciais: 'LF', cor: 'yellow' },
]

const corAvatar: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
}

const badgeStatus: Record<string, string> = {
  ativo: 'badge badge-green',
  lead: 'badge badge-yellow',
  inativo: 'badge badge-gray',
}

export default function ClientesPage() {
  return (
    <AppLayout>
      <Topbar titulo="Clientes e proprietários">
        <button className="btn btn-primary">
          <UserPlus size={14} /> Novo cliente
        </button>
      </Topbar>
      <div className="flex-1 overflow-y-auto p-6">

        {/* Busca */}
        <div className="card mb-4 py-3">
          <div className="flex items-center gap-2">
            <Search size={15} className="text-gray-400" />
            <input className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400" placeholder="Buscar por nome, CPF ou telefone..." />
          </div>
        </div>

        {/* Tabela */}
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">CPF</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Telefone</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Portal</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${corAvatar[c.cor]}`}>
                        {c.iniciais}
                      </div>
                      <span className="font-medium text-gray-900">{c.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.tipo}</td>
                  <td className="px-4 py-3 text-gray-500">{c.cpf}</td>
                  <td className="px-4 py-3 text-gray-500">{c.telefone}</td>
                  <td className="px-4 py-3">
                    <span className={badgeStatus[c.status]}>
                      {c.status === 'ativo' ? 'Ativo' : c.status === 'lead' ? 'Lead' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${c.portal ? 'badge-blue' : 'badge-gray'}`}>
                      {c.portal ? 'Portal ativo' : 'Sem portal'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="btn text-xs py-1 px-2.5">Ver ficha</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  )
}
