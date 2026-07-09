'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Check } from 'lucide-react'

type Plano = {
  id: string
  nome: string
  limite_imoveis: number | null
  preco_mensal: number
  preco_anual_total: number
  taxa_implantacao: number
  taxa_implantacao_parcelas: number
  modulos: string[]
  permite_multiplos_usuarios: boolean
}

function formatVal(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export default function CadastroPage() {
  const router = useRouter()
  const [planos, setPlanos] = useState<Plano[]>([])
  const [planoId, setPlanoId] = useState('')
  const [ciclo, setCiclo] = useState<'mensal' | 'anual'>('mensal')
  const [nomeOrg, setNomeOrg] = useState('')
  const [nomeResponsavel, setNomeResponsavel] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => { carregarPlanos() }, [])

  async function carregarPlanos() {
    const { data } = await supabase.from('planos').select('*').order('preco_mensal')
    if (data) {
      setPlanos(data)
      if (data.length > 0) setPlanoId(data[0].id)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (!planoId) { setErro('Selecione um plano.'); return }
    if (senha.length < 6) { setErro('A senha precisa ter pelo menos 6 caracteres.'); return }
    if (senha !== confirmarSenha) { setErro('As senhas não coincidem.'); return }

    setEnviando(true)
    try {
      const res = await fetch('/api/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plano_id: planoId,
          ciclo_cobranca: ciclo,
          nome_organizacao: nomeOrg,
          nome_responsavel: nomeResponsavel,
          email,
          telefone,
          senha,
        }),
      })
      const dados = await res.json()
      if (!res.ok) {
        setErro(dados.erro || 'Não foi possível concluir o cadastro. Tente novamente.')
        setEnviando(false)
        return
      }
      // Cadastro concluído — loga automaticamente e manda pro dashboard
      await supabase.auth.signInWithPassword({ email, password: senha })
      router.push('/dashboard')
    } catch (err: any) {
      setErro('Não foi possível concluir o cadastro. Tente novamente.')
      setEnviando(false)
    }
  }

  const planoSel = planos.find(p => p.id === planoId)

  return (
    <div style={{ background: '#0d1117' }} className="min-h-screen py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <img src="/logo-admeasy.png" alt="AdmEasy" className="w-28 h-auto object-contain mx-auto mb-4" />
          <h1 style={{ color: '#f4f4f3' }} className="text-2xl font-semibold">Comece a usar o AdmEasy</h1>
          <p style={{ color: '#8b8d98' }} className="text-sm mt-1">Escolha seu plano e crie sua conta em poucos minutos.</p>
        </div>

        {/* Ciclo de cobrança */}
        <div className="flex justify-center mb-6">
          <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="inline-flex rounded-lg p-1">
            {(['mensal', 'anual'] as const).map(c => (
              <button key={c} type="button" onClick={() => setCiclo(c)}
                style={ciclo === c ? { background: '#2563eb', color: '#fff' } : { background: 'transparent', color: '#8b9ab4' }}
                className="px-5 py-2 rounded-md text-sm font-medium transition-all">
                {c === 'mensal' ? 'Mensal' : 'Anual (com desconto)'}
              </button>
            ))}
          </div>
        </div>

        {/* Planos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {planos.map(p => {
            const sel = p.id === planoId
            const precoMensalEquivalente = ciclo === 'anual' ? p.preco_anual_total / 12 : p.preco_mensal
            return (
              <button key={p.id} type="button" onClick={() => setPlanoId(p.id)}
                style={sel ? { border: '1.5px solid #2563eb', background: '#16243a' } : { border: '0.5px solid #2a2f3a', background: '#161b22' }}
                className="text-left rounded-2xl p-5 transition-all relative">
                {sel && (
                  <div style={{ background: '#2563eb' }} className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center">
                    <Check size={12} color="#fff" />
                  </div>
                )}
                <div style={{ color: '#f4f4f3' }} className="font-semibold mb-1">{p.nome}</div>
                <div style={{ color: '#8b8d98' }} className="text-xs mb-3">
                  {p.limite_imoveis ? `Até ${p.limite_imoveis} imóveis` : 'Imóveis ilimitados'}
                </div>
                <div style={{ color: '#f4f4f3' }} className="text-xl font-bold">
                  {formatVal(precoMensalEquivalente)}<span style={{ color: '#8b8d98' }} className="text-xs font-normal">/mês</span>
                </div>
                {ciclo === 'anual' && (
                  <div style={{ color: '#3fb950' }} className="text-xs mt-0.5">{formatVal(p.preco_anual_total)}/ano à vista no cartão</div>
                )}
                {p.taxa_implantacao > 0 && (
                  <div style={{ color: '#8b8d98' }} className="text-xs mt-2">
                    + {formatVal(p.taxa_implantacao)} de implantação
                    {ciclo === 'mensal' ? ` (10x no boleto)` : ` (no cartão)`}
                  </div>
                )}
                {p.permite_multiplos_usuarios && (
                  <div style={{ color: '#5b9bf5' }} className="text-xs mt-2">✓ Múltiplos usuários</div>
                )}
              </button>
            )
          })}
        </div>

        {/* Formulário */}
        <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-2xl p-6 sm:p-8 max-w-lg mx-auto">
          <h2 style={{ color: '#f4f4f3' }} className="text-lg font-semibold mb-5">Crie sua conta</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nome da imobiliária / seu nome comercial *</label>
              <input className="input" required value={nomeOrg} onChange={e => setNomeOrg(e.target.value)} placeholder="Ex: Texas Imóveis" />
            </div>
            <div>
              <label className="label">Seu nome completo *</label>
              <input className="input" required value={nomeResponsavel} onChange={e => setNomeResponsavel(e.target.value)} />
            </div>
            <div>
              <label className="label">E-mail *</label>
              <input type="email" className="input" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Telefone / WhatsApp</label>
              <input className="input" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Senha *</label>
                <input type="password" className="input" required value={senha} onChange={e => setSenha(e.target.value)} />
              </div>
              <div>
                <label className="label">Confirmar senha *</label>
                <input type="password" className="input" required value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} />
              </div>
            </div>

            {planoSel && (
              <div style={{ background: '#0d1117', border: '0.5px solid #2a2f3a', color: '#8b9ab4' }} className="rounded-lg p-3 text-xs">
                Você está assinando o plano <strong style={{ color: '#f4f4f3' }}>{planoSel.nome}</strong>, ciclo <strong style={{ color: '#f4f4f3' }}>{ciclo}</strong>.
              </div>
            )}

            {erro && (
              <div style={{ background: '#2e1717', border: '0.5px solid #4a2424', color: '#ef4444' }} className="text-sm px-3 py-2 rounded-lg">
                {erro}
              </div>
            )}

            <button type="submit" disabled={enviando} className="btn btn-primary w-full justify-center py-2.5">
              {enviando ? 'Criando sua conta...' : 'Criar minha conta'}
            </button>

            <p style={{ color: '#5b5e6b' }} className="text-xs text-center">
              Já tem conta? <a href="/login" style={{ color: '#5b9bf5' }}>Entrar</a>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
