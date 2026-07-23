'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { interpretarErroHash, decidirEstadoAposVerificacao } from '@/lib/passwordRecoverySeguranca'

type Estado = 'carregando' | 'pronto' | 'invalido' | 'sucesso'

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>('carregando')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    // Detecta IMEDIATAMENTE error/error_code/error_description no hash
    // — o Supabase manda isso quando o link expirou ou já foi usado
    // (ex.: #error=access_denied&error_code=otp_expired&...). Nunca
    // expõe error_code/error_description brutos na UI (podem conter
    // detalhe interno do Supabase) — só decide o estado.
    const hashAtual = typeof window !== 'undefined' ? window.location.hash : ''
    const erroHash = interpretarErroHash(hashAtual)

    if (erroHash.temErro) {
      // Log só local/console, nunca token — code/description do Supabase
      // não são segredo (não são token), mas mesmo assim não vão pra UI.
      console.warn('[redefinir-senha] link rejeitado pelo Supabase:', erroHash.code, erroHash.description)
      setEstado(decidirEstadoAposVerificacao({ erroNoHash: true, eventoRecoveryRecebido: false, sessaoExistente: false }))
      return
    }

    let resolvido = false

    // Checagem imediata de sessão já existente — cobre o caso de vir
    // de /confirmar-recuperacao, onde o verifyOtp (client-side) já
    // rodou e já deixou a sessão pronta em localStorage antes desta
    // página montar. Sem isso, o usuário ficaria vendo "Verificando o
    // link..." pelos 4s inteiros do timeout à toa.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (resolvido || !session) return
      resolvido = true
      setEstado(decidirEstadoAposVerificacao({ erroNoHash: false, eventoRecoveryRecebido: false, sessaoExistente: true }))
    })

    // Fluxo do link direto por e-mail (sem passar por /confirmar-
    // recuperacao): o client Supabase usa flowType implícito (sem
    // PKCE, ver lib/supabase.ts) — o link de recuperação chega com
    // #access_token=...&type=recovery no hash. Com detectSessionInUrl
    // (padrão do SDK), o próprio supabase-js processa esse hash ao
    // carregar a página e dispara o evento PASSWORD_RECOVERY — é esse
    // evento que confirma que a sessão de recuperação é válida, não uma
    // suposição de query param ou de "código".
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        resolvido = true
        setEstado(decidirEstadoAposVerificacao({ erroNoHash: false, eventoRecoveryRecebido: true, sessaoExistente: true }))
      }
    })

    // Timeout/fallback — nunca fica "Verificando o link..." pra sempre.
    // Se nenhum evento PASSWORD_RECOVERY chegar num tempo curto, confere
    // se já existe sessão válida por outro caminho antes de desistir e
    // tratar como inválido.
    const timeout = setTimeout(async () => {
      if (resolvido) return
      const { data: { session } } = await supabase.auth.getSession()
      setEstado(decidirEstadoAposVerificacao({ erroNoHash: false, eventoRecoveryRecebido: false, sessaoExistente: !!session }))
    }, 4000)

    return () => {
      listener.subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (senha !== confirmacao) {
      setErro('As senhas não coincidem.')
      return
    }

    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })

    if (error) {
      // Nunca expor error.message bruto (pode vazar detalhe interno do
      // Supabase) — mensagem genérica, mesma cautela já usada no resto
      // do app pra erros de auth.
      setErro('Não foi possível redefinir sua senha. Solicite um novo link e tente novamente.')
      setSalvando(false)
      return
    }

    setEstado('sucesso')
    setSalvando(false)
    // Encerra a sessão de recuperação — o usuário deve logar de novo,
    // já com a senha nova, pelo fluxo normal.
    await supabase.auth.signOut()
    setTimeout(() => router.replace('/login'), 2000)
  }

  return (
    <div style={{ background: '#0d1117' }} className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo-admeasy.png" alt="AdmEasy" className="w-28 h-auto object-contain mx-auto" />
        </div>

        <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-2xl p-8">
          {estado === 'carregando' && (
            <p style={{ color: '#8b8d98' }} className="text-sm text-center py-6">Verificando o link...</p>
          )}

          {estado === 'invalido' && (
            <>
              <h2 style={{ color: '#f4f4f3' }} className="text-lg font-semibold mb-3">Link inválido ou expirado</h2>
              <p style={{ color: '#8b8d98' }} className="text-sm mb-6">
                Este link de redefinição de senha não é mais válido — pode já ter sido usado ou ter expirado.
                Solicite um novo link na tela de login.
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => router.replace('/login?recuperar=1')}
                  className="btn btn-primary w-full justify-center py-2.5"
                >
                  Solicitar novo link
                </button>
                <button
                  onClick={() => router.replace('/login')}
                  style={{ color: '#5b5e6b' }}
                  className="text-xs text-center w-full hover:underline py-1"
                >
                  Voltar para o login
                </button>
              </div>
            </>
          )}

          {estado === 'sucesso' && (
            <>
              <h2 style={{ color: '#f4f4f3' }} className="text-lg font-semibold mb-3">Senha redefinida com sucesso</h2>
              <p style={{ color: '#8b8d98' }} className="text-sm">
                Você já pode entrar com a nova senha. Redirecionando para o login...
              </p>
            </>
          )}

          {estado === 'pronto' && (
            <>
              <h2 style={{ color: '#f4f4f3' }} className="text-lg font-semibold mb-6">Defina sua nova senha</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Nova senha</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="••••••••"
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Confirme a nova senha</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="••••••••"
                    value={confirmacao}
                    onChange={e => setConfirmacao(e.target.value)}
                    required
                  />
                </div>

                {erro && (
                  <div style={{ background: '#2e1717', border: '0.5px solid #4a2424', color: '#ef4444' }} className="text-sm px-3 py-2 rounded-lg">
                    {erro}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={salvando}
                  className="btn btn-primary w-full justify-center py-2.5"
                >
                  {salvando ? 'Salvando...' : 'Salvar nova senha'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
