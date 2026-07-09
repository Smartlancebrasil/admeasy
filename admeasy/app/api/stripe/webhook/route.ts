import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const corpo = await req.text()
  const assinatura = req.headers.get('stripe-signature')

  let evento: Stripe.Event
  try {
    evento = stripe.webhooks.constructEvent(corpo, assinatura!, process.env.STRIPE_WEBHOOK_SECRET!)
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
        const periodoFim = sub.items.data[0]?.current_period_end
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
      const subId = invoice.subscription as string | null
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
