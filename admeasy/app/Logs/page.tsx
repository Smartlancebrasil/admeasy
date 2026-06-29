'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { supabase } from '@/lib/supabase'
import { Clock, User, Building2, FileText, DollarSign, Wrench, RefreshCw } from 'lucide-react'

type Log = {
  id: string
  usuario_nome?: string
  acao: string
  modulo: string
  registro_nome?: string
  descricao: string
  dados_anteriores?: any
  dados_novos?: any
  created_at: string
}

const moduloCor: Record<string, string> = {
  cliente: 'bg-blue-100 text-blue-700',
  imovel: 'bg-purple-100 text-purple-700',
  contrato: 'bg-green-100 text-green-700',
  cobranca: 'bg-yellow-100 text-yellow-700',
  demanda: 'bg-orange-100 text-orange-700',
}

const acaoCor: Record<string, string> = {
  criou: 'text-green-600',
  editou: 'text-blue-600',
  excluiu: 'text-red-600',
  pagamento_confirmado: 'text-green-600',
  repasse_realizado: 'text-green-600',
}

function formatDateTime(dt: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(dt))
}

function tempoRelativo(dt: string) {
  const diff = Date.now() - new Date(dt).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}min atrás`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroModulo, setFiltroModulo] = useState('todos')
  const [logExpandido, setLogExpandido] = useState<string | null>(null)

  useEffect(() => { buscarLogs() }, [])

  async function buscarLogs() {
    setLoading(true)
    const { data } = await supabase.from('logs').select('*').order('created_at', { ascending: false }).limit(200)
    if (data) setLogs(data)
    setLoading(false)
  }

  const modulos = ['todos', ...Array.from(new Set(logs.map(l => l.modulo)))]
  const filtrados = filtroModulo === 'todos' ? logs : logs.filter(l => l.modulo === filtroModulo)

  return (
    <AppLayout>
      <Topbar titulo="Logs de atividade">
        <button className="btn" onClick={buscarLogs}><RefreshCw size={13} />Atualizar</button>
      </Topbar>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="card mb-4 py-3 px-4">
          <div className="flex items-center gap-4">
            <label className="text-xs text-gray-500 font-medium">Módulo:</label>
            <select className="input py-1 text-xs" style={{width:'auto'}} value={filtroModulo} onChange={e => setFiltroModulo(e.target.value)}>
              {modulos.map(m => <option key={m} value={m}>{m === 'todos' ? 'Todos' : m}</option>)}
            </select>
            <div className="ml-auto text-xs text-gray-400">{filtrados.length} registros</div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Carregando logs...</div>
        ) : filtrados.length === 0 ? (
          <div className="card text-center py-16 text-gray-400">
            <Clock size={36} className="mx-auto mb-3 opacity-30" />
            <div className="font-medium text-gray-500">Nenhuma atividade registrada ainda</div>
            <div className="text-sm mt-1">As ações do sistema aparecerão aqui automaticamente</div>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            {filtrados.map(log => (
              <div key={log.id}>
                <div className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                  onClick={() => setLogExpandido(logExpandido === log.id ? null : log.id)}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${moduloCor[log.modulo] || 'bg-gray-100 text-gray-600'}`}>
                    {log.modulo === 'cliente' ? <User size={13} /> : log.modulo === 'imovel' ? <Building2 size={13} /> :
                     log.modulo === 'contrato' ? <FileText size={13} /> : log.modulo === 'cobranca' ? <DollarSign size={13} /> :
                     <Wrench size={13} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold ${acaoCor[log.acao] || 'text-gray-600'}`}>{log.acao.replace(/_/g,' ')}</span>
                      <span className="text-xs text-gray-900">{log.descricao}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-gray-400">{log.usuario_nome || 'Sistema'}</span>
                      <span className="text-[10px] text-gray-400">{tempoRelativo(log.created_at)} · {formatDateTime(log.created_at)}</span>
                      {log.registro_nome && <span className={`text-[10px] px-1.5 py-0.5 rounded ${moduloCor[log.modulo] || 'bg-gray-100 text-gray-600'}`}>{log.registro_nome}</span>}
                    </div>
                  </div>
                  <div className="text-gray-300 text-xs mt-1">{logExpandido === log.id ? '▲' : '▼'}</div>
                </div>
                {logExpandido === log.id && (log.dados_anteriores || log.dados_novos) && (
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="grid grid-cols-2 gap-4">
                      {log.dados_anteriores && (
                        <div>
                          <div className="text-[10px] font-medium text-gray-400 mb-1 uppercase">Antes</div>
                          <pre className="text-[10px] text-gray-600 bg-white border border-gray-200 rounded p-2 overflow-auto max-h-40">{JSON.stringify(log.dados_anteriores, null, 2)}</pre>
                        </div>
                      )}
                      {log.dados_novos && (
                        <div>
                          <div className="text-[10px] font-medium text-gray-400 mb-1 uppercase">Depois</div>
                          <pre className="text-[10px] text-gray-600 bg-white border border-gray-200 rounded p-2 overflow-auto max-h-40">{JSON.stringify(log.dados_novos, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}