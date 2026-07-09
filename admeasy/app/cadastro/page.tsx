'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Check, X, ArrowLeft } from 'lucide-react'

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

// Ordem em que os módulos aparecem no checklist de cada plano, com o rótulo em português
const MODULOS_ORDEM: { chave: string; label: string }[] = [
  { chave: 'imoveis', label: 'Cadastro de imóveis' },
  { chave: 'contratos', label: 'Contratos' },
  { chave: 'clientes', label: 'Clientes' },
  { chave: 'financeiro', label: 'Financeiro' },
  { chave: 'portal_locatario', label: 'Portal do locatário' },
  { chave: 'reajuste', label: 'Reajuste de aluguel' },
  { chave: 'rescisao', label: 'Cálculo de rescisão' },
  { chave: 'demandas', label: 'Chamados' },
  { chave: 'dashboard_bi', label: 'Dashboard BI executivo' },
  { chave: 'fornecedores', label: 'Fornecedores' },
  { chave: 'visitas', label: 'Visitas' },
  { chave: 'vistorias', label: 'Vistorias' },
  { chave: 'analise_cadastral', label: 'Análise de locatários' },
  { chave: 'processos_judiciais', label: 'Processos judiciais' },
]

function formatVal(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function labelImoveis(p: Plano) {
  return p.limite_imoveis ? `até ${p.limite_imoveis} imóveis` : 'acima de 50 imóveis'
}

export default function CadastroPage() {
  const router = useRouter()
  const [etapa, setEtapa] = useState<'plano' | 'conta'>('plano')
  const [planos, setPlanos] = useState<Plano[]>([])
  const [planoId, setPlanoId] = useState('')
  const [ciclo, setCiclo] = useState<'mensal' | 'anual'>('mensal')
  const [nomeOrg, setNomeOrg] = useState('')
  const [nomeResponsavel, setNomeResponsavel] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [incluirImplantacao, setIncluirImplantacao] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => { carregarPlanos() }, [])

  async function carregarPlanos() {
    const { data } = await supabase.from('planos').select('*').order('preco_mensal')
    if (data) setPlanos(data)
  }

  function escolherPlano(id: string) {
    setPlanoId(id)
    setEtapa('conta')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

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
          incluir_implantacao: incluirImplantacao,
        }),
      })
      const dados = await res.json()
      if (!res.ok) {
        setErro(dados.erro || 'Não foi possível concluir o cadastro. Tente novamente.')
        setEnviando(false)
        return
      }
      // Cadastro concluído — manda pro checkout do Stripe pra cadastrar o
      // cartão (nada é cobrado agora, só depois dos 7 dias de teste grátis)
      if (dados.checkout_url) {
        window.location.href = dados.checkout_url
      } else {
        // fallback, caso o checkout não tenha sido criado por algum motivo
        await supabase.auth.signInWithPassword({ email, password: senha })
        router.push('/dashboard')
      }
    } catch (err: any) {
      setErro('Não foi possível concluir o cadastro. Tente novamente.')
      setEnviando(false)
    }
  }

  const planoSel = planos.find(p => p.id === planoId)

  return (
    <div style={{ background: '#0d1117' }} className="min-h-screen py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <a href="/">
            <img src="/logo-admeasy.png" alt="AdmEasy" className="w-28 h-auto object-contain mx-auto mb-4" />
          </a>
          {etapa === 'plano' ? (
            <>
              <h1 style={{ color: '#f4f4f3' }} className="text-2xl font-semibold">Escolha seu plano</h1>
              <p style={{ color: '#8b8d98' }} className="text-sm mt-1">Selecione o plano ideal e assine em poucos minutos.</p>
            </>
          ) : (
            <>
              <h1 style={{ color: '#f4f4f3' }} className="text-2xl font-semibold">Crie sua conta</h1>
              <p style={{ color: '#8b8d98' }} className="text-sm mt-1">Falta só um passo pra começar a usar o AdmEasy.</p>
            </>
          )}
        </div>

        {/* ETAPA 1 — escolher plano */}
        {etapa === 'plano' && (
          <>
            <div className="flex justify-center mb-8">
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {planos.map(p => {
                const precoMensalEquivalente = ciclo === 'anual' ? p.preco_anual_total / 12 : p.preco_mensal
                const destaque = p.id === 'corretor'
                return (
                  <div key={p.id}
                    style={destaque ? { border: '1.5px solid #2563eb', background: '#16243a' } : { border: '0.5px solid #2a2f3a', background: '#161b22' }}
                    className="rounded-2xl p-6 flex flex-col relative">
                    {destaque && (
                      <div style={{ background: '#2563eb', color: '#fff' }} className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase px-3 py-1 rounded-full">
                        Mais escolhido
                      </div>
                    )}
                    <div style={{ color: '#f4f4f3' }} className="font-semibold text-lg mb-1">{p.nome}</div>
                    <div style={{ color: '#8b9ab4' }} className="text-xs mb-4">{labelImoveis(p)}</div>

                    <div style={{ color: '#f4f4f3' }} className="text-3xl font-bold">
                      {formatVal(precoMensalEquivalente)}<span style={{ color: '#8b8d98' }} className="text-sm font-normal">/mês</span>
                    </div>
                    <div style={{ color: '#3fb950' }} className="text-xs mt-1 min-h-[16px]">
                      {ciclo === 'anual' ? `${formatVal(p.preco_anual_total)}/ano à vista no cartão` : '\u00A0'}
                    </div>
                    <div style={{ color: '#8b9ab4' }} className="text-xs mt-1 mb-4">
                      {p.taxa_implantacao > 0
                        ? `+ ${formatVal(p.taxa_implantacao)} de implantação (${ciclo === 'mensal' ? '10x no boleto' : 'no cartão'})`
                        : 'Sem taxa de implantação'}
                    </div>

                    <button type="button" onClick={() => escolherPlano(p.id)}
                      style={{ background: '#2563eb', color: '#fff' }}
                      className="btn justify-center py-2.5 font-semibold mb-5">
                      Assinar {p.nome}
                    </button>

                    <div className="space-y-1.5 flex-1 mb-6">
                      <div className="flex items-center gap-2">
                        {p.permite_multiplos_usuarios
                          ? <Check size={14} style={{ color: '#3fb950' }} className="flex-shrink-0" />
                          : <X size={14} style={{ color: '#ef4444' }} className="flex-shrink-0" />}
                        <span style={{ color: '#c3c2b7' }} className="text-xs">{p.permite_multiplos_usuarios ? 'Múltiplos usuários' : 'Usuário único'}</span>
                      </div>
                      {MODULOS_ORDEM.map(mod => {
                        const tem = p.modulos.includes(mod.chave)
                        return (
                          <div key={mod.chave} className="flex items-center gap-2">
                            {tem
                              ? <Check size={14} style={{ color: '#3fb950' }} className="flex-shrink-0" />
                              : <X size={14} style={{ color: '#ef4444' }} className="flex-shrink-0" />}
                            <span style={{ color: tem ? '#c3c2b7' : '#8b8d98' }} className="text-xs">{mod.label}</span>
                          </div>
                        )
                      })}
                    </div>

                    <button type="button" onClick={() => escolherPlano(p.id)}
                      style={{ background: '#2563eb', color: '#fff' }}
                      className="btn justify-center py-2.5 font-semibold">
                      Assinar {p.nome}
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ETAPA 2 — criar conta */}
        {etapa === 'conta' && (
          <div className="max-w-lg mx-auto">
            <button type="button" onClick={() => setEtapa('plano')}
              style={{ color: '#8b9ab4' }} className="text-xs flex items-center gap-1.5 mb-4 hover:text-white transition-colors">
              <ArrowLeft size={13} />Trocar plano
            </button>

            {planoSel && (
              <div style={{ background: '#16243a', border: '0.5px solid #1e3a5f' }} className="rounded-xl p-4 mb-5 flex items-center justify-between">
                <div>
                  <div style={{ color: '#f4f4f3' }} className="text-sm font-semibold">{planoSel.nome}</div>
                  <div style={{ color: '#8b9ab4' }} className="text-xs">{labelImoveis(planoSel)} · ciclo {ciclo}</div>
                </div>
                <div style={{ color: '#f4f4f3' }} className="text-lg font-bold">
                  {formatVal(ciclo === 'anual' ? planoSel.preco_anual_total / 12 : planoSel.preco_mensal)}
                  <span style={{ color: '#8b8d98' }} className="text-xs font-normal">/mês</span>
                </div>
              </div>
            )}

            {planoSel && planoSel.taxa_implantacao > 0 && (
              <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-xl p-4 mb-5">
                <div style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-1">
                  Taxa de implantação: {formatVal(planoSel.taxa_implantacao)}
                </div>
                <p style={{ color: '#8b9ab4' }} className="text-xs mb-3 leading-relaxed">
                  Serve para cobrir os custos de configuração inicial e treinamento necessários para colocar seu negócio pra funcionar. Ela garante que o sistema fique seguro, personalizado e pronto para uso desde o primeiro dia.
                </p>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={incluirImplantacao}
                    onChange={e => setIncluirImplantacao(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span style={{ color: '#c3c2b7' }} className="text-xs">
                    Quero pagar a taxa de implantação junto com a primeira mensalidade ({formatVal(planoSel.taxa_implantacao)}).
                    Se deixar desmarcado, combinamos essa cobrança separadamente depois.
                  </span>
                </label>
              </div>
            )}

            <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-2xl p-6 sm:p-8">
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
        )}
      </div>
    </div>
  )
}
