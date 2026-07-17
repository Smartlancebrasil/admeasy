import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
    console.error('Webhook Stripe: configuração obrigatória ausente.')
    return NextResponse.json(
      { erro: 'Serviço temporariamente indisponível.' },
      { status: 503 }
    )
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  let stripe: ReturnType<typeof getStripe>
  try {
    stripe = getStripe()
  } catch (err: any) {
    console.error('Webhook Stripe: Stripe não configurado.', err?.message)
    return NextResponse.json(
      { erro: 'Serviço de pagamento não configurado.' },
      { status: 503 }
    )
  }

  const corpo = await req.text()
  const assinatura = req.headers.get('stripe-signature')

  let evento: Stripe.Event
  try {
    evento = stripe.webhooks.constructEvent(corpo, assinatura!, webhookSecret)
  } catch (err: any) {
    return NextResponse.json({ erro: `Assinatura inválida: ${err.message}` }, { status: 400 })
  }

  switch (evento.type) {
    // Assinatura criada, ficou ativa, foi cancelada, ou o pagamento falhou —
    // em todos esses casos, refletimos o status atual no organizations.
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = evento.data.object as Stripe.Subscription
      const orgId = sub.metadata?.organization_id
      if (orgId) {
        const status = mapearStatus(sub.status)
        const periodoFim = (sub.items.data[0] as any)?.current_period_end ?? (sub as any).current_period_end
        const proximaCobranca = periodoFim
          ? new Date(periodoFim * 1000).toISOString().split('T')[0]
          : null

        await supabaseAdmin
          .from('organizations')
          .update({
            status_assinatura: status,
            stripe_subscription_id: sub.id,
            data_proxima_cobranca: proximaCobranca,
          })
          .eq('id', orgId)
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = evento.data.object as Stripe.Invoice
      const subId = ((invoice as any).subscription ?? (invoice as any).parent?.subscription_details?.subscription) as string | null
      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId)
        const orgId = sub.metadata?.organization_id
        if (orgId) {
          await supabaseAdmin.from('organizations').update({ status_assinatura: 'inadimplente' }).eq('id', orgId)
        }
      }
      break
    }
  }

  return NextResponse.json({ recebido: true })
}

function mapearStatus(statusStripe: Stripe.Subscription.Status): string {
  switch (statusStripe) {
    case 'trialing': return 'trial'
    case 'active': return 'ativo'
    case 'past_due': return 'inadimplente'
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'suspenso'
    default:
      return 'trial'
  }
}
