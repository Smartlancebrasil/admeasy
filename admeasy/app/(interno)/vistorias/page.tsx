'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { Plus, ClipboardList, ArrowDownToLine, ArrowUpFromLine, FileText, Edit2, Trash2 } from 'lucide-react'

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
  const [excluindo, setExcluindo] = useState<string | null>(null)

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

  async function excluir(id: string) {
    if (!confirm('Excluir esta vistoria? Esta ação não pode ser desfeita.')) return
    setExcluindo(id)
    await supabase.from('vistorias').delete().eq('id', id)
    setExcluindo(null)
    carregar()
  }

  const filtradas = vistorias.filter(v => filtro === 'todos' || v.tipo === filtro)

  return (
    <AppLayout>
      <div style={{ background: '#0d1117', minHeight: '100vh' }} className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-[1600px] mx-auto">

          <h1 style={{ color: '#f4f4f3' }} className="text-lg font-medium mb-5">Vistorias</h1>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div className="flex gap-2 overflow-x-auto">
              {(['todos', 'entrada', 'saida'] as const).map(f => (
                <button key={f} onClick={() => setFiltro(f)}
                  style={filtro === f ? { background: '#2563eb', color: '#fff' } : { background: '#161b22', border: '0.5px solid #2a2f3a', color: '#a8aab5' }}
                  className="px-3 py-1.5 rounded-lg text-sm transition-all flex-shrink-0">
                  {f === 'todos' ? 'Todas' : f === 'entrada' ? 'Entrada' : 'Saída'}
                </button>
              ))}
            </div>
            <Link href="/vistorias/nova" className="btn btn-primary justify-center">
              <Plus size={14} />Nova vistoria
            </Link>
          </div>

          {loading ? (
            <div style={{ color: '#8b8d98' }} className="text-center py-12">Carregando...</div>
          ) : filtradas.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardList size={40} className="mx-auto mb-3 opacity-30" style={{ color: '#8b8d98' }} />
              <p style={{ color: '#8b8d98' }} className="text-sm">Nenhuma vistoria encontrada</p>
              <Link href="/vistorias/nova" className="btn btn-primary mt-4 inline-flex">
                <Plus size={14} />Nova vistoria
              </Link>
            </div>
          ) : (
            <>
              {/* Mobile: lista em cards (a tabela não cabe numa tela estreita) */}
              <div className="sm:hidden space-y-3">
                {filtradas.map(v => (
                  <div key={v.id} className="card">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span style={v.tipo === 'entrada' ? { background: '#1a2e1f', color: '#3fb950' } : { background: '#2e2515', color: '#f59e0b' }}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0">
                        {v.tipo === 'entrada' ? <ArrowDownToLine size={11} /> : <ArrowUpFromLine size={11} />}
                        {v.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                      <span className={`badge ${v.status === 'concluida' ? 'badge-green' : 'badge-yellow'} flex-shrink-0`}>
                        {v.status === 'concluida' ? 'Concluída' : 'Rascunho'}
                      </span>
                    </div>
                    <div style={{ color: '#f4f4f3' }} className="font-medium text-sm">{v.imovel?.endereco}, {v.imovel?.numero}</div>
                    <div style={{ color: '#8b8d98' }} className="text-xs mb-1">{v.imovel?.bairro}</div>
                    <div style={{ color: '#8b9ab4' }} className="text-xs mb-3">
                      {new Date(v.data_vistoria + 'T12:00:00').toLocaleDateString('pt-BR')} · {v.vistoriador?.nome || '—'}
                    </div>
                    <div className="flex gap-1.5">
                      <Link href={`/vistorias/${v.id}`} className="btn btn-sm flex-1 justify-center">
                        <FileText size={12} />Abrir
                      </Link>
                      <Link href={`/vistorias/nova?id=${v.id}`} className="btn btn-sm">
                        <Edit2 size={12} />
                      </Link>
                      <button onClick={() => excluir(v.id)} disabled={excluindo === v.id}
                        className="btn btn-sm" style={{ color: '#ef4444' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop/tablet: tabela normal */}
              <div className="hidden sm:block card p-0 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '0.5px solid #2a2f3a' }}>
                      {['Tipo', 'Imóvel', 'Data', 'Vistoriador', 'Status', ''].map(h => (
                        <th key={h} style={{ color: '#8b8d98' }} className="text-left px-4 py-3 text-xs font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map(v => (
                      <tr key={v.id} style={{ borderBottom: '0.5px solid #1c2128' }} className="hover:bg-[#161b22]">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span style={v.tipo === 'entrada' ? { background: '#1a2e1f', color: '#3fb950' } : { background: '#2e2515', color: '#f59e0b' }}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium">
                            {v.tipo === 'entrada' ? <ArrowDownToLine size={11} /> : <ArrowUpFromLine size={11} />}
                            {v.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div style={{ color: '#f4f4f3' }} className="font-medium whitespace-nowrap">{v.imovel?.endereco}, {v.imovel?.numero}</div>
                          <div style={{ color: '#8b8d98' }} className="text-xs whitespace-nowrap">{v.imovel?.bairro}</div>
                        </td>
                        <td style={{ color: '#c3c2b7' }} className="px-4 py-3 whitespace-nowrap">
                          {new Date(v.data_vistoria + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td style={{ color: '#c3c2b7' }} className="px-4 py-3 whitespace-nowrap">{v.vistoriador?.nome || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`badge ${v.status === 'concluida' ? 'badge-green' : 'badge-yellow'}`}>
                            {v.status === 'concluida' ? 'Concluída' : 'Rascunho'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex gap-1.5">
                            <Link href={`/vistorias/${v.id}`} className="btn btn-sm">
                              <FileText size={12} />Abrir
                            </Link>
                            <Link href={`/vistorias/nova?id=${v.id}`} className="btn btn-sm">
                              <Edit2 size={12} />
                            </Link>
                            <button onClick={() => excluir(v.id)} disabled={excluindo === v.id}
                              className="btn btn-sm" style={{ color: '#ef4444' }}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
