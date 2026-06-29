'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { supabase } from '@/lib/supabase'
import { Save, Plus, X, Edit2, Building2, Users, Shield } from 'lucide-react'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

type Org = {
  id: string; nome: string; cnpj?: string; creci?: string
  email?: string; telefone?: string; whatsapp?: string
  endereco?: string; numero?: string; complemento?: string
  bairro?: string; cidade?: string; estado?: string; cep?: string
  site?: string; instagram?: string; logo_url?: string
  cor_primaria?: string; responsavel_nome?: string; responsavel_cpf?: string
}

type Vistoriador = {
  id: string; nome: string; cpf?: string; crea?: string
  telefone?: string; email?: string; ativo: boolean
}

const UFs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

function FormVistoriador({ inicial, onSalvar, onCancelar }: {
  inicial: Record<string,string>
  onSalvar: (d: Record<string,string>) => Promise<void>
  onCancelar: () => void
}) {
  const [form, setForm] = useState(inicial)
  const [salvando, setSalvando] = useState(false)
  const set = (c: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f=>({...f,[c]:e.target.value}))

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true)
    await onSalvar(form); setSalvando(false)
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-3">
      <form onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="label">Nome completo *</label>
            <input className="input" required value={form.nome} onChange={set('nome')} /></div>
          <div><label className="label">CPF</label>
            <input className="input" value={form.cpf} onChange={set('cpf')} placeholder="000.000.000-00" /></div>
          <div><label className="label">CREA / Registro</label>
            <input className="input" value={form.crea} onChange={set('crea')} /></div>
          <div><label className="label">Telefone</label>
            <input className="input" value={form.telefone} onChange={set('telefone')} /></div>
          <div><label className="label">E-mail</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} /></div>
        </div>
        <div className="flex gap-2 mt-3">
          <button type="submit" disabled={salvando} className="btn btn-primary btn-sm">
            <Save size={12} />{salvando ? 'Salvando...' : inicial.id ? 'Salvar' : 'Cadastrar'}
          </button>
          <button type="button" className="btn btn-sm" onClick={onCancelar}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

export default function ConfiguracoesPage() {
  const [aba, setAba] = useState<'imobiliaria'|'vistoriadores'|'usuarios'>('imobiliaria')
  const [org, setOrg] = useState<Partial<Org>>({})
  const [salvandoOrg, setSalvandoOrg] = useState(false)
  const [sucessoOrg, setSucessoOrg] = useState('')
  const [vistoriadores, setVistoriadores] = useState<Vistoriador[]>([])
  const [formVist, setFormVist] = useState<Record<string,string>|null>(null)

  useEffect(() => { carregarOrg(); carregarVistoriadores() }, [])

  async function carregarOrg() {
    const { data } = await supabase.from('organizations').select('*').eq('id', ORG_ID).single()
    if (data) setOrg(data)
  }

  async function carregarVistoriadores() {
    const { data } = await supabase.from('vistoriadores').select('*').eq('organization_id', ORG_ID).order('nome')
    if (data) setVistoriadores(data)
  }

  async function salvarOrg(e: React.FormEvent) {
    e.preventDefault(); setSalvandoOrg(true)
    await supabase.from('organizations').update(org).eq('id', ORG_ID)
    setSucessoOrg('Dados salvos com sucesso!')
    setSalvandoOrg(false)
    setTimeout(() => setSucessoOrg(''), 3000)
  }

  async function salvarVistoriador(dados: Record<string,string>) {
    const payload = {
      nome: dados.nome, cpf: dados.cpf||null, crea: dados.crea||null,
      telefone: dados.telefone||null, email: dados.email||null,
      organization_id: ORG_ID, ativo: true,
    }
    if (dados.id) {
      await supabase.from('vistoriadores').update(payload).eq('id', dados.id)
    } else {
      await supabase.from('vistoriadores').insert([payload])
    }
    setFormVist(null)
    carregarVistoriadores()
  }

  async function excluirVistoriador(id: string) {
    if (!confirm('Excluir vistoriador?')) return
    await supabase.from('vistoriadores').delete().eq('id', id)
    carregarVistoriadores()
  }

  const setOrg_ = (campo: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
    setOrg(o => ({...o, [campo]: e.target.value}))

  return (
    <AppLayout>
      <Topbar titulo="Configurações" />
      <div className="flex-1 overflow-y-auto p-6">

        {/* Abas */}
        <div className="flex gap-0 border-b border-gray-200 mb-6">
          {[
            { key: 'imobiliaria', label: 'Dados da imobiliária', icon: Building2 },
            { key: 'vistoriadores', label: 'Vistoriadores', icon: Users },
            { key: 'usuarios', label: 'Usuários', icon: Shield },
          ].map(a => (
            <button key={a.key} onClick={() => setAba(a.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-all ${aba===a.key ? 'border-blue-500 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <a.icon size={14} />{a.label}
            </button>
          ))}
        </div>

        {/* ABA: IMOBILIÁRIA */}
        {aba === 'imobiliaria' && (
          <form onSubmit={salvarOrg}>
            {sucessoOrg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">{sucessoOrg}</div>}

            <div className="grid grid-cols-2 gap-5">
              <div className="card col-span-2">
                <h3 className="text-sm font-semibold mb-4">Identidade da imobiliária</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><label className="label">Nome da imobiliária *</label>
                    <input className="input" value={org.nome||''} onChange={setOrg_('nome')} placeholder="Ex: Echelli Negócios Imobiliários" /></div>
                  <div><label className="label">CNPJ</label>
                    <input className="input" value={org.cnpj||''} onChange={setOrg_('cnpj')} placeholder="00.000.000/0001-00" /></div>
                  <div><label className="label">CRECI</label>
                    <input className="input" value={org.creci||''} onChange={setOrg_('creci')} placeholder="Ex: 12345-F" /></div>
                  <div><label className="label">Responsável técnico</label>
                    <input className="input" value={org.responsavel_nome||''} onChange={setOrg_('responsavel_nome')} /></div>
                  <div><label className="label">CPF do responsável</label>
                    <input className="input" value={org.responsavel_cpf||''} onChange={setOrg_('responsavel_cpf')} /></div>
                </div>
              </div>

              <div className="card">
                <h3 className="text-sm font-semibold mb-4">Contato</h3>
                <div className="space-y-3">
                  <div><label className="label">E-mail</label>
                    <input className="input" type="email" value={org.email||''} onChange={setOrg_('email')} /></div>
                  <div><label className="label">Telefone</label>
                    <input className="input" value={org.telefone||''} onChange={setOrg_('telefone')} /></div>
                  <div><label className="label">WhatsApp</label>
                    <input className="input" value={org.whatsapp||''} onChange={setOrg_('whatsapp')} placeholder="(11) 99999-9999" /></div>
                  <div><label className="label">Site</label>
                    <input className="input" value={org.site||''} onChange={setOrg_('site')} placeholder="www.suaimobiliaria.com.br" /></div>
                  <div><label className="label">Instagram</label>
                    <input className="input" value={org.instagram||''} onChange={setOrg_('instagram')} placeholder="@suaimobiliaria" /></div>
                </div>
              </div>

              <div className="card">
                <h3 className="text-sm font-semibold mb-4">Endereço</h3>
                <div className="space-y-3">
                  <div><label className="label">Rua / Avenida</label>
                    <input className="input" value={org.endereco||''} onChange={setOrg_('endereco')} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="label">Número</label>
                      <input className="input" value={org.numero||''} onChange={setOrg_('numero')} /></div>
                    <div><label className="label">Complemento</label>
                      <input className="input" value={org.complemento||''} onChange={setOrg_('complemento')} /></div>
                  </div>
                  <div><label className="label">Bairro</label>
                    <input className="input" value={org.bairro||''} onChange={setOrg_('bairro')} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="label">Cidade</label>
                      <input className="input" value={org.cidade||''} onChange={setOrg_('cidade')} /></div>
                    <div><label className="label">Estado</label>
                      <select className="input" value={org.estado||''} onChange={setOrg_('estado')}>
                        <option value="">UF</option>
                        {UFs.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                      </select></div>
                  </div>
                  <div><label className="label">CEP</label>
                    <input className="input" value={org.cep||''} onChange={setOrg_('cep')} placeholder="00000-000" /></div>
                </div>
              </div>

              <div className="card col-span-2">
                <h3 className="text-sm font-semibold mb-4">Aparência nos documentos</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="label">Cor principal</label>
                    <div className="flex items-center gap-2">
                      <input type="color" className="h-9 w-16 rounded border border-gray-200 p-0.5" value={org.cor_primaria||'#185FA5'} onChange={setOrg_('cor_primaria')} />
                      <input className="input flex-1" value={org.cor_primaria||'#185FA5'} onChange={setOrg_('cor_primaria')} />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="label">Logo da imobiliária</label>
                    <div className="flex items-center gap-3">
                      {org.logo_url && <img src={org.logo_url} alt="Logo" className="h-12 object-contain rounded border border-gray-200 px-2" />}
                      <input type="file" accept="image/*" className="text-xs text-gray-500"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const ext = file.name.split('.').pop()
                          const path = `logos/${ORG_ID}.${ext}`
                          const { data } = await supabase.storage.from('documentos').upload(path, file, { upsert: true })
                          if (data) {
                            const { data: url } = supabase.storage.from('documentos').getPublicUrl(path)
                            setOrg(o => ({...o, logo_url: url.publicUrl}))
                          }
                        }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">PNG ou JPG, fundo transparente recomendado. Aparecerá em todos os documentos PDF.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <button type="submit" disabled={salvandoOrg} className="btn btn-primary">
                <Save size={14} />{salvandoOrg ? 'Salvando...' : 'Salvar dados da imobiliária'}
              </button>
            </div>
          </form>
        )}

        {/* ABA: VISTORIADORES */}
        {aba === 'vistoriadores' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">Cadastre os vistoriadores que realizam laudos de vistoria.</p>
              <button className="btn btn-primary btn-sm" onClick={() => setFormVist({id:'',nome:'',cpf:'',crea:'',telefone:'',email:''})}>
                <Plus size={13} />Novo vistoriador
              </button>
            </div>

            {formVist && formVist.id === '' && (
              <FormVistoriador inicial={formVist} onSalvar={salvarVistoriador} onCancelar={() => setFormVist(null)} />
            )}

            <div className="card p-0 overflow-hidden">
              {vistoriadores.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">Nenhum vistoriador cadastrado</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Nome</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">CPF</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">CREA</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Telefone</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">E-mail</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {vistoriadores.map(v => (
                      <tr key={v.id}>
                        {formVist?.id === v.id ? (
                          <td colSpan={7} className="px-4 py-2">
                            <FormVistoriador inicial={formVist} onSalvar={salvarVistoriador} onCancelar={() => setFormVist(null)} />
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-3 font-medium">{v.nome}</td>
                            <td className="px-4 py-3 text-gray-500">{v.cpf||'—'}</td>
                            <td className="px-4 py-3 text-gray-500">{v.crea||'—'}</td>
                            <td className="px-4 py-3 text-gray-500">{v.telefone||'—'}</td>
                            <td className="px-4 py-3 text-gray-500">{v.email||'—'}</td>
                            <td className="px-4 py-3"><span className={`badge ${v.ativo ? 'badge-green' : 'badge-gray'}`}>{v.ativo ? 'Ativo' : 'Inativo'}</span></td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <button className="btn btn-sm" onClick={() => setFormVist({id:v.id,nome:v.nome||'',cpf:v.cpf||'',crea:v.crea||'',telefone:v.telefone||'',email:v.email||''})}>
                                  <Edit2 size={12} />Editar
                                </button>
                                <button className="btn btn-sm" style={{color:'var(--text-danger)'}} onClick={() => excluirVistoriador(v.id)}>
                                  <X size={12} />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ABA: USUÁRIOS */}
        {aba === 'usuarios' && (
          <div className="card">
            <h3 className="text-sm font-semibold mb-4">Usuários do sistema</h3>
            <p className="text-sm text-gray-400">Gerencie quem tem acesso ao AdmEasy. Para adicionar usuários, acesse o painel do Supabase em Authentication → Users.</p>
          </div>
        )}

      </div>
    </AppLayout>
  )
}