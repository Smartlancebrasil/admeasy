'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { Plus, X, Edit2, Save, Truck, Star, Phone, Mail } from 'lucide-react'
import { registrarLog } from '@/lib/logs'

type Fornecedor = {
  id: string
  nome: string
  especialidade?: string
  cnpj_cpf?: string
  registro_profissional?: string
  telefone?: string
  whatsapp?: string
  email?: string
  area_atendimento?: string
  avaliacao: number
  total_servicos: number
  ativo: boolean
  observacoes?: string
}

const especialidades = [
  { value: 'hidraulica', label: 'Hidráulica' },
  { value: 'eletrica', label: 'Elétrica' },
  { value: 'pintura', label: 'Pintura' },
  { value: 'serralheria', label: 'Serralheria' },
  { value: 'ar_condicionado', label: 'Ar-condicionado' },
  { value: 'limpeza', label: 'Limpeza' },
  { value: 'geral', label: 'Manutenção geral' },
  { value: 'outro', label: 'Outro' },
]

const espCor: Record<string, { bg: string; color: string }> = {
  hidraulica: { bg: '#16243a', color: '#5b9bf5' },
  eletrica: { bg: '#2e2515', color: '#f59e0b' },
  pintura: { bg: '#1a2e1f', color: '#3fb950' },
  serralheria: { bg: '#1f2430', color: '#a8aab5' },
  ar_condicionado: { bg: '#142e36', color: '#4dd0e1' },
  limpeza: { bg: '#251f3a', color: '#a78bfa' },
  geral: { bg: '#2e2215', color: '#f0975a' },
  outro: { bg: '#1f2430', color: '#8b8d98' },
}

const formVazio = {
  nome: '', especialidade: 'geral', cnpj_cpf: '', registro_profissional: '',
  telefone: '', whatsapp: '', email: '', area_atendimento: '',
  avaliacao: '5', observacoes: '',
}

function Estrelas({ val }: { val: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={12} style={i <= val ? { color: '#fbbf24', fill: '#fbbf24' } : { color: '#2a2f3a', fill: '#2a2f3a' }} />
      ))}
    </div>
  )
}

function FormFornecedor({ inicial, onSalvar, onCancelar }: {
  inicial: Record<string,string>
  onSalvar: (dados: Record<string,string>) => Promise<void>
  onCancelar: () => void
}) {
  const [form, setForm] = useState(inicial)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const set = (campo: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(f => ({...f, [campo]: e.target.value}))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro('')
    try { await onSalvar(form) } catch(err: any) { setErro(err.message) }
    setSalvando(false)
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ color: '#f4f4f3' }} className="text-sm font-semibold">{inicial.id ? `Editando: ${inicial.nome}` : 'Cadastrar fornecedor'}</h2>
        <button onClick={onCancelar} className="btn btn-sm"><X size={13} /></button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Nome / Razão social *</label>
            <input className="input" required value={form.nome} onChange={set('nome')} placeholder="Ex: Hidráulica Santos" />
          </div>
          <div>
            <label className="label">Especialidade *</label>
            <select className="input" value={form.especialidade} onChange={set('especialidade')}>
              {especialidades.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">CNPJ ou CPF</label>
            <input className="input" value={form.cnpj_cpf} onChange={set('cnpj_cpf')} placeholder="00.000.000/0001-00" />
          </div>
          <div>
            <label className="label">Telefone</label>
            <input className="input" value={form.telefone} onChange={set('telefone')} placeholder="(11) 99999-9999" />
          </div>
          <div>
            <label className="label">WhatsApp</label>
            <input className="input" value={form.whatsapp} onChange={set('whatsapp')} placeholder="(11) 99999-9999" />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} />
          </div>
          <div>
            <label className="label">Registro profissional (CREA, CRF, etc.)</label>
            <input className="input" value={form.registro_profissional} onChange={set('registro_profissional')} />
          </div>
          <div className="col-span-2">
            <label className="label">Área de atendimento</label>
            <input className="input" value={form.area_atendimento} onChange={set('area_atendimento')} placeholder="Ex: SP capital e Grande SP" />
          </div>
          <div>
            <label className="label">Avaliação inicial (1-5)</label>
            <select className="input" value={form.avaliacao} onChange={set('avaliacao')}>
              {[5,4,3,2,1].map(n => <option key={n} value={n}>{'★'.repeat(n)} {n}/5</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Observações</label>
            <textarea className="input" rows={2} value={form.observacoes} onChange={set('observacoes')} placeholder="Condições, horários, referências..." />
          </div>
        </div>
        {erro && <div style={{ background: '#2e1717', border: '0.5px solid #4a2424', color: '#ef4444' }} className="text-sm px-3 py-2 rounded-lg mt-3">{erro}</div>}
        <div className="flex gap-2 mt-4">
          <button type="submit" disabled={salvando} className="btn btn-primary">
            <Save size={13} />{salvando ? 'Salvando...' : inicial.id ? 'Salvar alterações' : 'Cadastrar'}
          </button>
          <button type="button" className="btn" onClick={onCancelar}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [formInicial, setFormInicial] = useState<Record<string,string> | null>(null)
  const [sucesso, setSucesso] = useState('')
  const [filtroEsp, setFiltroEsp] = useState('todos')

  useEffect(() => { buscar() }, [])

  async function buscar() {
    setLoading(true)
    const { data } = await supabase.from('fornecedores').select('*').order('nome')
    if (data) setFornecedores(data)
    setLoading(false)
  }

  function abrirNovo() {
    setFormInicial({...formVazio, id: ''})
  }

  function abrirEdicao(f: Fornecedor) {
    setFormInicial({
      id: f.id, nome: f.nome||'', especialidade: f.especialidade||'geral',
      cnpj_cpf: f.cnpj_cpf||'', registro_profissional: f.registro_profissional||'',
      telefone: f.telefone||'', whatsapp: f.whatsapp||'', email: f.email||'',
      area_atendimento: f.area_atendimento||'', avaliacao: f.avaliacao?.toString()||'5',
      observacoes: f.observacoes||'',
    })
  }

  async function salvar(dados: Record<string,string>) {
    const payload = {
      nome: dados.nome, especialidade: dados.especialidade,
      cnpj_cpf: dados.cnpj_cpf||null, registro_profissional: dados.registro_profissional||null,
      telefone: dados.telefone||null, whatsapp: dados.whatsapp||null,
      email: dados.email||null, area_atendimento: dados.area_atendimento||null,
      avaliacao: parseFloat(dados.avaliacao)||5,
      observacoes: dados.observacoes||null, ativo: true,
    }

    let error
    if (dados.id) {
      const res = await supabase.from('fornecedores').update(payload).eq('id', dados.id)
      error = res.error
    } else {
      const res = await supabase.from('fornecedores').insert([{...payload, total_servicos: 0}])
      error = res.error
    }
    if (error) throw new Error(error.message)

    await registrarLog({
      acao: dados.id ? 'editou' : 'criou',
      modulo: 'fornecedor',
      registro_nome: dados.nome,
      descricao: `${dados.id ? 'Editou' : 'Cadastrou'} o fornecedor ${dados.nome}`,
    })

    setFormInicial(null)
    setSucesso(dados.id ? 'Fornecedor atualizado!' : 'Fornecedor cadastrado!')
    buscar()
    setTimeout(() => setSucesso(''), 3000)
  }

  async function excluir(id: string, nome: string) {
    if (!confirm(`Excluir ${nome}?`)) return
    await supabase.from('fornecedores').delete().eq('id', id)
    await registrarLog({ acao: 'excluiu', modulo: 'fornecedor', registro_id: id, registro_nome: nome, descricao: `Excluiu o fornecedor ${nome}` })
    buscar()
  }

  const filtrados = filtroEsp === 'todos' ? fornecedores : fornecedores.filter(f => f.especialidade === filtroEsp)

  return (
    <AppLayout>
      <div style={{ background: '#0d1117', minHeight: '100vh' }} className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1600px] mx-auto">

          <div className="flex items-center justify-between mb-5">
            <h1 style={{ color: '#f4f4f3' }} className="text-lg font-medium">Fornecedores</h1>
            <button className="btn btn-primary" onClick={abrirNovo}><Plus size={14} />Cadastrar fornecedor</button>
          </div>

          {sucesso && <div style={{ background: '#1a2e1f', border: '0.5px solid #2d4a35', color: '#3fb950' }} className="px-4 py-3 rounded-lg mb-4 text-sm">{sucesso}</div>}

          {formInicial !== null && (
            <FormFornecedor key={formInicial.id||'novo'} inicial={formInicial} onSalvar={salvar} onCancelar={() => setFormInicial(null)} />
          )}

          <div className="flex gap-2 mb-4 flex-wrap">
            <button onClick={() => setFiltroEsp('todos')} className={`btn btn-sm ${filtroEsp==='todos' ? 'btn-primary' : ''}`}>Todos ({fornecedores.length})</button>
            {especialidades.map(e => {
              const count = fornecedores.filter(f => f.especialidade === e.value).length
              if (count === 0) return null
              return (
                <button key={e.value} onClick={() => setFiltroEsp(e.value)}
                  className={`btn btn-sm ${filtroEsp===e.value ? 'btn-primary' : ''}`}>
                  {e.label} ({count})
                </button>
              )
            })}
          </div>

          {loading ? (
            <div style={{ color: '#8b8d98' }} className="text-center py-12 text-sm">Carregando...</div>
          ) : filtrados.length === 0 ? (
            <div className="card text-center py-12" style={{ color: '#8b8d98' }}>
              <Truck size={36} className="mx-auto mb-2 opacity-30" />
              <div style={{ color: '#c3c2b7' }} className="font-medium">Nenhum fornecedor cadastrado</div>
              <div className="text-sm mt-1">Clique em "Cadastrar fornecedor" para começar</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filtrados.map(f => {
                const cor = espCor[f.especialidade || 'outro']
                return (
                  <div key={f.id} className="card flex items-center gap-4">
                    <div style={{ background: cor.bg }} className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">
                      {f.especialidade === 'hidraulica' ? '🔧' :
                       f.especialidade === 'eletrica' ? '⚡' :
                       f.especialidade === 'pintura' ? '🎨' :
                       f.especialidade === 'limpeza' ? '🧹' :
                       f.especialidade === 'ar_condicionado' ? '❄️' : '🔨'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span style={{ color: '#f4f4f3' }} className="font-medium">{f.nome}</span>
                        <span style={{ background: cor.bg, color: cor.color }} className="badge text-[10px]">
                          {especialidades.find(e => e.value === f.especialidade)?.label || f.especialidade}
                        </span>
                        {!f.ativo && <span className="badge badge-gray text-[10px]">Inativo</span>}
                      </div>
                      <div className="flex items-center gap-4 mt-1 flex-wrap">
                        {f.telefone && <span style={{ color: '#8b8d98' }} className="text-xs flex items-center gap-1"><Phone size={10} />{f.telefone}</span>}
                        {f.email && <span style={{ color: '#8b8d98' }} className="text-xs flex items-center gap-1"><Mail size={10} />{f.email}</span>}
                        {f.area_atendimento && <span style={{ color: '#8b8d98' }} className="text-xs">{f.area_atendimento}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <Estrelas val={f.avaliacao||5} />
                        <span style={{ color: '#8b8d98' }} className="text-xs">{f.total_servicos} serviço(s)</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button className="btn btn-sm" onClick={() => abrirEdicao(f)}><Edit2 size={12} />Editar</button>
                      <button className="btn btn-sm" style={{ color: '#ef4444' }} onClick={() => excluir(f.id, f.nome)}><X size={12} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
