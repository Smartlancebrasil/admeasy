'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { UserPlus, Search, X, Edit2, Save } from 'lucide-react'

type Cliente = {
  id: string
  nome: string
  tipo: string
  cpf?: string
  rg?: string
  data_nascimento?: string
  estado_civil?: string
  profissao?: string
  renda_mensal?: number
  empresa?: string
  email?: string
  telefone?: string
  whatsapp?: string
  endereco?: string
  bairro?: string
  cidade?: string
  estado?: string
  cep?: string
  observacoes?: string
  status: string
  tem_portal: boolean
  created_at: string
}

const tipoBadge: Record<string, string> = {
  locatario: 'badge badge-blue', locador: 'badge badge-green',
  comprador: 'badge badge-purple', vendedor: 'badge badge-gray', lead: 'badge badge-yellow',
}
const tipoLabel: Record<string, string> = {
  locatario: 'Locatário', locador: 'Locador', comprador: 'Comprador', vendedor: 'Vendedor', lead: 'Lead',
}
const statusBadge: Record<string, string> = {
  ativo: 'badge badge-green', lead: 'badge badge-yellow', inativo: 'badge badge-gray', bloqueado: 'badge badge-red',
}

function iniciais(nome: string) {
  return nome.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase()
}

const UFs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const formVazio: Record<string, string> = {
  nome: '', tipo: 'locatario', cpf: '', rg: '', data_nascimento: '',
  estado_civil: '', profissao: '', renda_mensal: '', empresa: '',
  email: '', telefone: '', whatsapp: '',
  endereco: '', bairro: '', cidade: '', estado: '', cep: '',
  observacoes: '', status: 'ativo',
}

/**
 * IMPORTANTE: este componente fica FORA do componente da página.
 * Definir um componente dentro do corpo de outro componente faz o React
 * recriá-lo do zero a cada render do pai, o que derruba o foco dos
 * inputs a cada tecla digitada (era a causa do bug de "uma letra por vez").
 */
function FormCliente({
  form, setForm, editando, erro, salvando, onSubmit, onCancelar,
}: {
  form: Record<string, string>
  setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>
  editando: Cliente | null
  erro: string
  salvando: boolean
  onSubmit: (e: React.FormEvent) => void
  onCancelar: () => void
}) {
  const set = (campo: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [campo]: e.target.value }))

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ color: '#f4f4f3' }} className="text-sm font-semibold">{editando ? `Editando: ${editando.nome}` : 'Cadastrar novo cliente'}</h2>
        <button onClick={onCancelar} className="btn btn-sm"><X size={13} /></button>
      </div>
      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><label className="label">Nome completo *</label>
            <input className="input" required value={form.nome} onChange={set('nome')} placeholder="Nome completo" /></div>
          <div><label className="label">Tipo *</label>
            <select className="input" value={form.tipo} onChange={set('tipo')}>
              <option value="locatario">Locatário</option><option value="locador">Locador (proprietário)</option>
              <option value="comprador">Comprador</option><option value="vendedor">Vendedor</option><option value="lead">Lead</option>
            </select></div>
          <div><label className="label">Status</label>
            <select className="input" value={form.status} onChange={set('status')}>
              <option value="ativo">Ativo</option><option value="lead">Lead</option><option value="inativo">Inativo</option>
            </select></div>
          <div><label className="label">CPF</label>
            <input className="input" value={form.cpf} onChange={set('cpf')} placeholder="000.000.000-00" /></div>
          <div><label className="label">RG</label>
            <input className="input" value={form.rg} onChange={set('rg')} /></div>
          <div><label className="label">Data de nascimento</label>
            <input className="input" type="date" value={form.data_nascimento} onChange={set('data_nascimento')} /></div>
          <div><label className="label">Estado civil</label>
            <select className="input" value={form.estado_civil} onChange={set('estado_civil')}>
              <option value="">Selecionar</option><option value="solteiro">Solteiro(a)</option>
              <option value="casado">Casado(a)</option><option value="divorciado">Divorciado(a)</option>
              <option value="viuvo">Viúvo(a)</option><option value="uniao_estavel">União estável</option>
            </select></div>
          <div><label className="label">Profissão</label>
            <input className="input" value={form.profissao} onChange={set('profissao')} /></div>
          <div><label className="label">Renda mensal (R$)</label>
            <input className="input" type="number" value={form.renda_mensal} onChange={set('renda_mensal')} /></div>
          <div><label className="label">Empresa</label>
            <input className="input" value={form.empresa} onChange={set('empresa')} /></div>
          <div><label className="label">E-mail</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} /></div>
          <div><label className="label">Telefone</label>
            <input className="input" value={form.telefone} onChange={set('telefone')} /></div>
          <div><label className="label">WhatsApp</label>
            <input className="input" value={form.whatsapp} onChange={set('whatsapp')} /></div>
          <div className="sm:col-span-2"><label className="label">Endereço</label>
            <input className="input" value={form.endereco} onChange={set('endereco')} placeholder="Rua, número, complemento" /></div>
          <div><label className="label">Bairro</label>
            <input className="input" value={form.bairro} onChange={set('bairro')} /></div>
          <div><label className="label">Cidade</label>
            <input className="input" value={form.cidade} onChange={set('cidade')} /></div>
          <div><label className="label">Estado</label>
            <select className="input" value={form.estado} onChange={set('estado')}>
              <option value="">UF</option>{UFs.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select></div>
          <div><label className="label">CEP</label>
            <input className="input" value={form.cep} onChange={set('cep')} placeholder="00000-000" /></div>
          <div className="sm:col-span-2"><label className="label">Observações</label>
            <textarea className="input" rows={2} value={form.observacoes} onChange={set('observacoes')} /></div>
        </div>
        {erro && <div style={{ background: '#2e1717', border: '0.5px solid #4a2424', color: '#ef4444' }} className="text-sm px-3 py-2 rounded-lg mt-3">{erro}</div>}
        <div className="flex gap-2 mt-4">
          <button type="submit" disabled={salvando} className="btn btn-primary">
            <Save size={13} />{salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar cliente'}
          </button>
          <button type="button" className="btn" onClick={onCancelar}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [form, setForm] = useState<Record<string,string>>(formVazio)

  useEffect(() => { buscarClientes() }, [])

  async function buscarClientes() {
    setLoading(true)
    const { data } = await supabase.from('clientes').select('*').order('nome')
    if (data) setClientes(data)
    setLoading(false)
  }

  function abrirNovo() {
    setEditando(null)
    setForm(formVazio)
    setErro('')
    setShowForm(true)
  }

  function abrirEdicao(c: Cliente) {
    setEditando(c)
    setForm({
      nome: c.nome || '', tipo: c.tipo || 'locatario', cpf: c.cpf || '', rg: c.rg || '',
      data_nascimento: c.data_nascimento || '', estado_civil: c.estado_civil || '',
      profissao: c.profissao || '', renda_mensal: c.renda_mensal?.toString() || '',
      empresa: c.empresa || '', email: c.email || '', telefone: c.telefone || '',
      whatsapp: c.whatsapp || '', endereco: c.endereco || '', bairro: c.bairro || '',
      cidade: c.cidade || '', estado: c.estado || '', cep: c.cep || '',
      observacoes: c.observacoes || '', status: c.status || 'ativo',
    })
    setErro('')
    setShowForm(true)
  }

  function fecharForm() {
    setShowForm(false)
    setEditando(null)
    setForm(formVazio)
    setErro('')
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro('')

    const payload = {
      ...form,
      renda_mensal: form.renda_mensal ? parseFloat(form.renda_mensal) : null,
      data_nascimento: form.data_nascimento || null,
    }

    let error
    if (editando) {
      const res = await supabase.from('clientes').update(payload).eq('id', editando.id)
      error = res.error
    } else {
      const res = await supabase.from('clientes').insert([{ ...payload, tem_portal: false }])
      error = res.error
    }

    if (error) {
      setErro('Erro: ' + error.message)
    } else {
      setSucesso(editando ? 'Cliente atualizado!' : 'Cliente cadastrado!')
      fecharForm()
      buscarClientes()
      setTimeout(() => setSucesso(''), 3000)
    }
    setSalvando(false)
  }

  async function excluir(id: string) {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return
    await supabase.from('clientes').delete().eq('id', id)
    buscarClientes()
  }

  const filtrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.cpf?.includes(busca) || c.telefone?.includes(busca) ||
    c.email?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <AppLayout>
      <div style={{ background: '#0d1117', minHeight: '100vh' }} className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="max-w-[1600px] mx-auto">

          <div className="flex items-center justify-between mb-5">
            <h1 style={{ color: '#f4f4f3' }} className="text-lg font-medium">Clientes e proprietários</h1>
            <button className="btn btn-primary" onClick={abrirNovo}><UserPlus size={14} />Novo cliente</button>
          </div>

          {sucesso && <div style={{ background: '#1a2e1f', border: '0.5px solid #2d4a35', color: '#3fb950' }} className="px-4 py-3 rounded-lg mb-4 text-sm">{sucesso}</div>}
          {showForm && (
            <FormCliente
              form={form}
              setForm={setForm}
              editando={editando}
              erro={erro}
              salvando={salvando}
              onSubmit={salvar}
              onCancelar={fecharForm}
            />
          )}

          <div className="card mb-4 py-3">
            <div className="flex items-center gap-2">
              <Search size={15} style={{ color: '#8b8d98' }} />
              <input
                style={{ color: '#f4f4f3' }}
                className="flex-1 text-sm outline-none bg-transparent placeholder-[#8b8d98]"
                placeholder="Buscar por nome, CPF, telefone ou e-mail..."
                value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
          </div>

          <div className="card p-0 overflow-hidden overflow-x-auto">
            {loading ? (
              <div style={{ color: '#8b8d98' }} className="text-center py-12 text-sm">Carregando...</div>
            ) : filtrados.length === 0 ? (
              <div style={{ color: '#8b8d98' }} className="text-center py-12">
                <div className="text-3xl mb-2">👥</div>
                <div style={{ color: '#c3c2b7' }} className="font-medium">Nenhum cliente cadastrado</div>
                <div className="text-sm mt-1">Clique em "Novo cliente" para começar</div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '0.5px solid #2a2f3a' }}>
                    {['Cliente','Tipo','CPF','Telefone','E-mail','Status',''].map(h => (
                      <th key={h} style={{ color: '#8b8d98' }} className="text-left px-4 py-3 text-xs font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(c => (
                    <tr key={c.id} style={{ borderBottom: '0.5px solid #1c2128' }} className="hover:bg-[#161b22] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div style={{ background: '#16243a', color: '#5b9bf5' }} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                            {iniciais(c.nome)}
                          </div>
                          <span style={{ color: '#f4f4f3' }} className="font-medium whitespace-nowrap">{c.nome}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className={tipoBadge[c.tipo] || 'badge badge-gray'}>{tipoLabel[c.tipo] || c.tipo}</span></td>
                      <td style={{ color: '#8b8d98' }} className="px-4 py-3 whitespace-nowrap">{c.cpf || '—'}</td>
                      <td style={{ color: '#8b8d98' }} className="px-4 py-3 whitespace-nowrap">{c.telefone || '—'}</td>
                      <td style={{ color: '#8b8d98' }} className="px-4 py-3">{c.email || '—'}</td>
                      <td className="px-4 py-3"><span className={statusBadge[c.status] || 'badge badge-gray'}>{c.status}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button className="btn btn-sm" onClick={() => abrirEdicao(c)}><Edit2 size={12} />Editar</button>
                          <button className="btn btn-sm" style={{ color: '#ef4444' }} onClick={() => excluir(c.id)}><X size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
