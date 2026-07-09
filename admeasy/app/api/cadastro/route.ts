import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

// Cliente com a service role key — só existe no servidor, nunca no navegador.
// É o mesmo padrão já usado em app/api/portal/gerenciar-acesso/route.ts.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://admeasy.vercel.app'

export async function POST(req: NextRequest) {
  try {
    const {
      plano_id,
      ciclo_cobranca,
      nome_organizacao,
      nome_responsavel,
      email,
      telefone,
      senha,
    } = await req.json()

    if (!plano_id || !nome_organizacao || !nome_responsavel || !email || !senha) {
      return NextResponse.json({ erro: 'Preencha todos os campos obrigatórios.' }, { status: 400 })
    }

    // Confere se o plano existe e busca os dados dele (limites, taxa de implantação etc.)
    const { data: plano, error: erroPlano } = await supabaseAdmin
      .from('planos')
      .select('*')
      .eq('id', plano_id)
      .single()

    if (erroPlano || !plano) {
      return NextResponse.json({ erro: 'Plano inválido.' }, { status: 400 })
    }

    // 1) Cria o usuário no Supabase Auth (já confirmado, sem precisar clicar em link de e-mail)
    const { data: authData, error: erroAuth } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    })

    if (erroAuth || !authData.user) {
      const jaExiste = erroAuth?.message?.toLowerCase().includes('already') || erroAuth?.code === 'email_exists'
      return NextResponse.json(
        { erro: jaExiste ? 'Esse e-mail já está cadastrado. Tente fazer login.' : 'Não foi possível criar o usuário.' },
        { status: 400 },
      )
    }

    const userId = authData.user.id

    // 2) Cria a organização (o "cliente" da AdmEasy), ainda em trial
    const hoje = new Date().toISOString().split('T')[0]

    const { data: org, error: erroOrg } = await supabaseAdmin
      .from('organizations')
      .insert({
        nome: nome_organizacao,
        plano_id,
        ciclo_cobranca,
        status_assinatura: 'trial',
        data_inicio_assinatura: hoje,
        taxa_implantacao_parcelas_total: ciclo_cobranca === 'mensal' ? plano.taxa_implantacao_parcelas : (plano.taxa_implantacao > 0 ? 1 : 0),
        taxa_implantacao_parcelas_pagas: 0,
      })
      .select()
      .single()

    if (erroOrg || !org) {
      // limpa o usuário criado no passo 1, já que a organização não foi criada
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ erro: 'Não foi possível criar sua organização.' }, { status: 500 })
    }

    // 3) Cadastra o usuário na tabela `users` (nome/perfil usados no menu lateral)
    await supabaseAdmin.from('users').insert({
      id: userId,
      email,
      nome: nome_responsavel,
      perfil: 'admin',
    })

    // 4) Vincula o usuário à organização como administrador
    await supabaseAdmin.from('usuarios_organizacao').insert({
      user_id: userId,
      organization_id: org.id,
      papel: 'admin',
    })

    // 5) Cria o cliente e a sessão de checkout no Stripe — assinatura recorrente
    //    (mensal ou anual, dependendo do ciclo escolhido) com 7 dias grátis.
    //    Nada é cobrado agora; o Stripe só cobra depois que o trial acabar.
    const valorCentavos = Math.round((ciclo_cobranca === 'anual' ? plano.preco_anual_total : plano.preco_mensal) * 100)

    const customer = await stripe.customers.create({
      email,
      name: nome_responsavel,
      metadata: { organization_id: org.id },
    })

    await supabaseAdmin
      .from('organizations')
      .update({ stripe_customer_id: customer.id })
      .eq('id', org.id)

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      line_items: [
        {
          price_data: {
            currency: 'brl',
            unit_amount: valorCentavos,
            recurring: { interval: ciclo_cobranca === 'anual' ? 'year' : 'month' },
            product_data: { name: `AdmEasy — Plano ${plano.nome} (${ciclo_cobranca})` },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
        metadata: { organization_id: org.id },
      },
      metadata: { organization_id: org.id },
      success_url: `${SITE_URL}/cadastro/sucesso?org=${org.id}`,
      cancel_url: `${SITE_URL}/cadastro`,
      locale: 'pt-BR',
    })

    // 6) E-mail de boas-vindas (mesmo domínio de teste já usado nos lembretes de boleto)
    if (process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'AdmEasy <onboarding@resend.dev>',
            to: email,
            subject: 'Bem-vindo(a) ao AdmEasy!',
            html: `
              <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>Bem-vindo(a) ao AdmEasy, ${nome_responsavel}!</h2>
                <p>Sua conta para <strong>${nome_organizacao}</strong> foi criada com sucesso, no plano <strong>${plano.nome}</strong>, com 7 dias grátis pra testar.</p>
                <p>Você já pode acessar o sistema com o e-mail <strong>${email}</strong> e a senha que você definiu.</p>
                <p><a href="${SITE_URL}/login" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">Acessar o AdmEasy</a></p>
              </div>
            `,
          }),
        })
      } catch {
        // Falha no envio do e-mail não deve travar o cadastro
      }
    }

    return NextResponse.json({ sucesso: true, organization_id: org.id, checkout_url: checkoutSession.url })
  } catch (err: any) {
    return NextResponse.json({ erro: 'Erro inesperado. Tente novamente.' }, { status: 500 })
  }
}
