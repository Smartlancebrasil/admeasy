import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Valida a assinatura do Mercado Pago (recomendado em produção).
// Se MERCADOPAGO_WEBHOOK_SECRET não estiver configurado, a validação é pulada
// (funciona, mas qualquer um poderia chamar essa rota fingindo ser o Mercado Pago).
function validarAssinatura(req: NextRequest): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) return true

  const xSignature = req.headers.get('x-signature')
  const xRequestId = req.headers.get('x-request-id')
  if (!xSignature || !xRequestId) return false

  let ts = ''
  let hash = ''
  xSignature.split(',').forEach(part => {
    const [key, value] = part.split('=')
    if (key?.trim() === 'ts') ts = value?.trim()
    if (key?.trim() === 'v1') hash = value?.trim()
  })

  const url = new URL(req.url)
  const dataId = url.searchParams.get('data.id') || ''

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const hmacCalculado = crypto.createHmac('sha256', secret).update(manifest).digest('hex')

  return hmacCalculado === hash
}

export async function POST(req: NextRequest) {
  try {
    if (!validarAssinatura(req)) {
      console.warn('Webhook Mercado Pago: assinatura inválida.')
      return NextResponse.json({ erro: 'Assinatura inválida.' }, { status: 401 })
    }

    const body = await req.json()
    const paymentId = body?.data?.id || body?.id
    const tipo = body?.type || body?.topic

    // Ignora notificações que não são de pagamento (ex: merchant_order)
    if (tipo !== 'payment' || !paymentId) {
      return NextResponse.json({ ok: true })
    }

    const token = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!token) {
      console.error('MERCADOPAGO_ACCESS_TOKEN não configurado.')
      return NextResponse.json({ erro: 'Token não configurado.' }, { status: 500 })
    }

    // Consulta o pagamento real na API do Mercado Pago (nunca confiar só no
    // conteúdo do webhook, sempre confirmar buscando o pagamento pelo ID)
    const resPagamento = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const pagamento = await resPagamento.json()

    if (!resPagamento.ok) {
      console.error('Erro ao consultar pagamento no Mercado Pago:', pagamento)
      return NextResponse.json({ erro: 'Erro ao consultar pagamento.' }, { status: 500 })
    }

    const cobrancaId = pagamento.metadata?.cobranca_id
    if (!cobrancaId) {
      console.warn('Pagamento sem cobranca_id no metadata:', paymentId)
      return NextResponse.json({ ok: true })
    }

    if (pagamento.status === 'approved') {
      const { error } = await supabaseAdmin
        .from('cobrancas')
        .update({
          status_cobranca: 'pago',
          data_pagamento: new Date().toISOString().split('T')[0],
          mp_payment_id: String(paymentId),
        })
        .eq('id', cobrancaId)

      if (error) {
        console.error('Erro ao marcar cobrança como paga:', error)
        return NextResponse.json({ erro: 'Erro ao atualizar cobrança.' }, { status: 500 })
      }

      console.log(`Cobrança ${cobrancaId} marcada como paga via webhook (payment ${paymentId}).`)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Erro no webhook Mercado Pago:', err)
    return NextResponse.json({ erro: 'Erro interno no webhook.' }, { status: 500 })
  }
}

// O Mercado Pago às vezes testa a URL do webhook com GET ao salvar a configuração
export async function GET() {
  return NextResponse.json({ ok: true })
}