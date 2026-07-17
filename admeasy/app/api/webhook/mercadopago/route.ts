import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Valida a assinatura do Mercado Pago. MERCADOPAGO_WEBHOOK_SECRET é obrigatória —
// sem ela, a chamada é rejeitada (nunca aceitamos webhook sem validar quem está chamando).
function validarAssinatura(req: NextRequest, secret: string): boolean {
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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Webhook Mercado Pago: configuração do Supabase ausente.')
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

    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
    if (!secret) {
      console.error('Webhook Mercado Pago: MERCADOPAGO_WEBHOOK_SECRET não configurado — rejeitando chamada.')
      return NextResponse.json({ erro: 'Webhook não autorizado.' }, { status: 401 })
    }

    if (!validarAssinatura(req, secret)) {
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

    if (pagamento.status !== 'approved') {
      return NextResponse.json({ ok: true })
    }

    // Nunca confia só no metadata do webhook: busca a cobrança real no banco
    // e valida referência, moeda, valor e organização antes de dar baixa.
    const { data: cobranca, error: erroCobranca } = await supabaseAdmin
      .from('cobrancas')
      .select('id, organization_id, valor_total, valor_aluguel')
      .eq('id', cobrancaId)
      .maybeSingle()

    if (erroCobranca || !cobranca) {
      console.error('Webhook Mercado Pago: cobrança não encontrada para o pagamento.', { paymentId, cobrancaId })
      return NextResponse.json({ erro: 'Cobrança não encontrada.' }, { status: 404 })
    }

    if (!cobranca.organization_id) {
      console.error('Webhook Mercado Pago: cobrança sem organização vinculada.', { cobrancaId })
      return NextResponse.json({ erro: 'Cobrança inválida.' }, { status: 422 })
    }

    if (pagamento.currency_id !== 'BRL') {
      console.error('Webhook Mercado Pago: moeda do pagamento diverge do esperado.', { paymentId, cobrancaId, moeda: pagamento.currency_id })
      return NextResponse.json({ erro: 'Moeda do pagamento não confere.' }, { status: 422 })
    }

    const valorEsperado = cobranca.valor_total > 0 ? cobranca.valor_total : (cobranca.valor_aluguel || 0)
    const valorRecebido = Number(pagamento.transaction_amount) || 0
    if (Math.abs(valorRecebido - valorEsperado) > 0.01) {
      console.error('Webhook Mercado Pago: valor pago diverge do valor esperado da cobrança.', {
        paymentId, cobrancaId, valorEsperado, valorRecebido,
      })
      return NextResponse.json({ erro: 'Valor do pagamento não confere com a cobrança.' }, { status: 422 })
    }

    const { error } = await supabaseAdmin
      .from('cobrancas')
      .update({
        status_cobranca: 'pago',
        data_pagamento: new Date().toISOString().split('T')[0],
        mp_payment_id: String(paymentId),
      })
      .eq('id', cobrancaId)
      .eq('organization_id', cobranca.organization_id)

    if (error) {
      console.error('Erro ao marcar cobrança como paga:', error)
      return NextResponse.json({ erro: 'Erro ao atualizar cobrança.' }, { status: 500 })
    }

    console.log(`Cobrança ${cobrancaId} marcada como paga via webhook (payment ${paymentId}).`)
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