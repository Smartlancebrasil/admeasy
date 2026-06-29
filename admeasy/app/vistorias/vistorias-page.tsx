'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { supabase } from '@/lib/supabase'
import { Plus, ClipboardList, ArrowDownToLine, ArrowUpFromLine, FileText } from 'lucide-react'

type Vistoria = {
  id: string
  tipo: 'entrada' | 'saida'
  data_vistoria: string
  status: 'rascunho' | 'concluida'
  observacoes_gerais?: string
  imovel?: { endereco: string; numero?: string; bairro?: string }
  vistoriador?: { nome: string }
}

export default function VistoriasPage() {
  const [vistorias, setVistorias] = useState<Vistoria[]>([])
  const [filtro, setFiltro] = useState<'todos' | 'entrada' | 'saida'>('todos')
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase
      .from('vistorias')
      .select('*, imovel:imoveis(endereco, numero, bairro), vistoriador:vistoriadores(nome)')
      .order('data_vistoria', { ascending: false })
    if (data) setVistorias(data)
    setLoading(false)
  }

  const filtradas = vistorias.filter(v => filtro === 'todos' || v.tipo === filtro)

  return (
    <AppLayout>
      <Topbar titulo="Vistorias" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {(['todos', 'entrada', 'saida'] as const).map(f => (
              <button key={f} onClick={() => setFiltro(f)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${filtro === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {f === 'todos' ? 'Todas' : f === 'entrada' ? 'Entrada' : 'Saída'}
              </button>
            ))}
          </div>
          <Link href="/vistorias/nova" className="btn btn-primary">
            <Plus size={14} />Nova vistoria
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-16">
            <ClipboardList size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">Nenhuma vistoria encontrada</p>
            <Link href="/vistorias/nova" className="btn btn-primary mt-4 inline-flex">
              <Plus size={14} />Nova vistoria
            </Link>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Tipo', 'Imóvel', 'Data', 'Vistoriador', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map(v => (
                  <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${v.tipo === 'entrada' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                        {v.tipo === 'entrada' ? <ArrowDownToLine size={11} /> : <ArrowUpFromLine size={11} />}
                        {v.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{v.imovel?.endereco}, {v.imovel?.numero}</div>
                      <div className="text-xs text-gray-400">{v.imovel?.bairro}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(v.data_vistoria + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{v.vistoriador?.nome || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${v.status === 'concluida' ? 'badge-green' : 'badge-yellow'}`}>
                        {v.status === 'concluida' ? 'Concluída' : 'Rascunho'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/vistorias/${v.id}`} className="btn btn-sm">
                        <FileText size={12} />Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
