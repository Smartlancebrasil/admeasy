'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
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

const formVazio = {
  nome: '', tipo: 'locatario', cpf: '', rg: '', data_nascimento: '',
  estado_civil: '', profissao: '', renda_mensal: '', empresa: '',
  email: '', telefone: '', whatsapp: '',
  endereco: '', bairro: '', cidade: '', estado: '', cep: '',
  observacoes: '', status: 'ativo',
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

  const FormCliente = () => (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">{editando ? `Editando: ${editando.nome}` : 'Cadastrar novo cliente'}</h2>
        <button onClick={fecharForm} className="btn btn-sm"><X size={13} /></button>
      </div>
      <form onSubmit={salvar}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="label">Nome completo *</label>
            <input className="input" required value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Nome completo" /></div>
          <div><label className="label">Tipo *</label>
            <select className="input" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
              <option value="locatario">Locatário</option><option value="locador">Locador (proprietário)</option>
              <option value="comprador">Comprador</option><option value="vendedor">Vendedor</option><option value="lead">Lead</option>
            </select></div>
          <div><label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              <option value="ativo">Ativo</option><option value="lead">Lead</option><option value="inativo">Inativo</option>
            </select></div>
          <div><label className="label">CPF</label>
            <input className="input" value={form.cpf} onChange={e => setForm({...form, cpf: e.target.value})} placeholder="000.000.000-00" /></div>
          <div><label className="label">RG</label>
            <input className="input" value={form.rg} onChange={e => setForm({...form, rg: e.target.value})} /></div>
          <div><label className="label">Data de nascimento</label>
            <input className="input" type="date" value={form.data_nascimento} onChange={e => setForm({...form, data_nascimento: e.target.value})} /></div>
          <div><label className="label">Estado civil</label>
            <select className="input" value={form.estado_civil} onChange={e => setForm({...form, estado_civil: e.target.value})}>
              <option value="">Selecionar</option><option value="solteiro">Solteiro(a)</option>
              <option value="casado">Casado(a)</option><option value="divorciado">Divorciado(a)</option>
              <option value="viuvo">Viúvo(a)</option><option value="uniao_estavel">União estável</option>
            </select></div>
          <div><label className="label">Profissão</label>
            <input className="input" value={form.profissao} onChange={e => setForm({...form, profissao: e.target.value})} /></div>
          <div><label className="label">Renda mensal (R$)</label>
            <input className="input" type="number" value={form.renda_mensal} onChange={e => setForm({...form, renda_mensal: e.target.value})} /></div>
          <div><label className="label">Empresa</label>
            <input className="input" value={form.empresa} onChange={e => setForm({...form, empresa: e.target.value})} /></div>
          <div><label className="label">E-mail</label>
            <input className="input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
          <div><label className="label">Telefone</label>
            <input className="input" value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} /></div>
          <div><label className="label">WhatsApp</label>
            <input className="input" value={form.whatsapp} onChange={e => setForm({...form, whatsapp: e.target.value})} /></div>
          <div className="col-span-2"><label className="label">Endereço</label>
            <input className="input" value={form.endereco} onChange={e => setForm({...form, endereco: e.target.value})} placeholder="Rua, número, complemento" /></div>
          <div><label className="label">Bairro</label>
            <input className="input" value={form.bairro} onChange={e => setForm({...form, bairro: e.target.value})} /></div>
          <div><label className="label">Cidade</label>
            <input className="input" value={form.cidade} onChange={e => setForm({...form, cidade: e.target.value})} /></div>
          <div><label className="label">Estado</label>
            <select className="input" value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
              <option value="">UF</option>{UFs.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select></div>
          <div><label className="label">CEP</label>
            <input className="input" value={form.cep} onChange={e => setForm({...form, cep: e.target.value})} placeholder="00000-000" /></div>
          <div className="col-span-2"><label className="label">Observações</label>
            <textarea className="input" rows={2} value={form.observacoes} onChange={e => setForm({...form, observacoes: e.target.value})} /></div>
        </div>
        {erro && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg mt-3">{erro}</div>}
        <div className="flex gap-2 mt-4">
          <button type="submit" disabled={salvando} className="btn btn-primary">
            <Save size={13} />{salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar cliente'}
          </button>
          <button type="button" className="btn" onClick={fecharForm}>Cancelar</button>
        </div>
      </form>
    </div>
  )

  return (
    <AppLayout>
      <Topbar titulo="Clientes e proprietários">
        <button className="btn btn-primary" onClick={abrirNovo}><UserPlus size={14} />Novo cliente</button>
      </Topbar>
      <div className="flex-1 overflow-y-auto p-6">
        {sucesso && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">{sucesso}</div>}
        {showForm && <FormCliente />}
        <div className="card mb-4 py-3">
          <div className="flex items-center gap-2">
            <Search size={15} className="text-gray-400" />
            <input className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
              placeholder="Buscar por nome, CPF, telefone ou e-mail..."
              value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
        </div>
        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Carregando...</div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-3xl mb-2">👥</div>
              <div className="font-medium text-gray-500">Nenhum cliente cadastrado</div>
              <div className="text-sm mt-1">Clique em "Novo cliente" para começar</div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">CPF</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Telefone</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">E-mail</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium flex-shrink-0">
                          {iniciais(c.nome)}
                        </div>
                        <span className="font-medium text-gray-900">{c.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className={tipoBadge[c.tipo] || 'badge badge-gray'}>{tipoLabel[c.tipo] || c.tipo}</span></td>
                    <td className="px-4 py-3 text-gray-500">{c.cpf || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{c.telefone || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{c.email || '—'}</td>
                    <td className="px-4 py-3"><span className={statusBadge[c.status] || 'badge badge-gray'}>{c.status}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="btn btn-sm" onClick={() => abrirEdicao(c)}><Edit2 size={12} />Editar</button>
                        <button className="btn btn-sm" style={{color:'var(--text-danger)'}} onClick={() => excluir(c.id)}><X size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  )
}