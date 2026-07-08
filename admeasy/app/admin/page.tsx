'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Building2, AlertTriangle } from 'lucide-react'

type Organizacao = {
  id: string
  nome: string
  plano_id: string | null
  ciclo_cobranca: string
  status_assinatura: string
  data_proxima_cobranca: string | null
  taxa_implantacao_parcelas_pagas: number
  taxa_implantacao_parcelas_total: number
  plano?: { nome: string; limite_imoveis: number | null; preco_mensal: number; preco_anual_total: number }
}

const statusLabel: Record<string, string> = {
  trial: 'Trial', ativo: 'Ativo', inadimplente: 'Inadimplente', suspenso: 'Suspenso',
}
const statusBadge: Record<string, string> = {
  trial: 'badge badge-gray', ativo: 'badge badge-green', inadimplente: 'badge badge-yellow', suspenso: 'badge badge-red',
}

function formatVal(v?: number) {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export default function AdminPage() {
  const [orgs, setOrgs] = useState<Organizacao[]>([])
  const [imoveisPorOrg, setImoveisPorOrg] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data: organizacoes } = await supabase
      .from('organizations')
      .select('id, nome, plano_id, ciclo_cobranca, status_assinatura, data_proxima_cobranca, taxa_implantacao_parcelas_pagas, taxa_implantacao_parcelas_total, plano:planos(nome, limite_imoveis, preco_mensal, preco_anual_total)')
      .order('nome')

    const { data: imoveis } = await supabase.from('imoveis').select('organization_id')

    const contagem: Record<string, number> = {}
    imoveis?.forEach(im => {
      if (im.organization_id) contagem[im.organization_id] = (contagem[im.organization_id] || 0) + 1
    })

    if (organizacoes) setOrgs(organizacoes as any)
    setImoveisPorOrg(contagem)
    setLoading(false)
  }

  return (
    <div className="p-6">
      <div className="max-w-[1400px] mx-auto">
        <h1 style={{ color: '#f4f4f3' }} className="text-lg font-medium mb-1">Clientes AdmEasy</h1>
        <p style={{ color: '#8b8d98' }} className="text-sm mb-6">Todas as imobiliárias, corretores e proprietários assinantes da plataforma.</p>

        <div className="card p-0 overflow-hidden overflow-x-auto">
          {loading ? (
            <div style={{ color: '#8b8d98' }} className="text-center py-12 text-sm">Carregando...</div>
          ) : orgs.length === 0 ? (
            <div style={{ color: '#8b8d98' }} className="text-center py-12">
              <Building2 size={36} className="mx-auto mb-2 opacity-30" />
              <div style={{ color: '#c3c2b7' }} className="font-medium">Nenhum cliente cadastrado ainda</div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '0.5px solid #2a2f3a' }}>
                  {['Cliente', 'Plano', 'Ciclo', 'Imóveis', 'Implantação', 'Próx. cobrança', 'Status'].map(h => (
                    <th key={h} style={{ color: '#8b8d98' }} className="text-left px-4 py-3 text-xs font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orgs.map(org => {
                  const usados = imoveisPorOrg[org.id] || 0
                  const limite = org.plano?.limite_imoveis
                  const passouLimite = limite != null && usados > limite
                  const parcelasFaltando = (org.taxa_implantacao_parcelas_total || 0) - (org.taxa_implantacao_parcelas_pagas || 0)
                  return (
                    <tr key={org.id} style={{ borderBottom: '0.5px solid #1c2128' }} className="hover:bg-[#161b22]">
                      <td style={{ color: '#f4f4f3' }} className="px-4 py-3 font-medium whitespace-nowrap">{org.nome}</td>
                      <td style={{ color: '#c3c2b7' }} className="px-4 py-3 whitespace-nowrap">{org.plano?.nome || '—'}</td>
                      <td style={{ color: '#8b8d98' }} className="px-4 py-3 text-xs capitalize whitespace-nowrap">{org.ciclo_cobranca}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span style={{ color: passouLimite ? '#f59e0b' : '#c3c2b7' }} className="flex items-center gap-1">
                          {passouLimite && <AlertTriangle size={12} />}
                          {usados}{limite != null ? ` / ${limite}` : ' / ilimitado'}
                        </span>
                      </td>
                      <td style={{ color: '#8b8d98' }} className="px-4 py-3 text-xs whitespace-nowrap">
                        {org.taxa_implantacao_parcelas_total > 0
                          ? parcelasFaltando > 0
                            ? `${org.taxa_implantacao_parcelas_pagas}/${org.taxa_implantacao_parcelas_total} pagas`
                            : 'Quitada'
                          : '—'}
                      </td>
                      <td style={{ color: '#8b8d98' }} className="px-4 py-3 text-xs whitespace-nowrap">
                        {org.data_proxima_cobranca ? new Date(org.data_proxima_cobranca + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusBadge[org.status_assinatura] || 'badge badge-gray'}>
                          {statusLabel[org.status_assinatura] || org.status_assinatura}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
