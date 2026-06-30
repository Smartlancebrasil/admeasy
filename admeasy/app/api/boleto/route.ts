import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      valor,
      valorAtualizado,
      vencimento,
      nomeLocatario,
      emailLocatario,
      cpfLocatario,
      descricao,
      cobrancaId,
      mesReferencia,
    } = body

    const token = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!token) {
      return NextResponse.json({ erro: 'Token do Mercado Pago não configurado.' }, { status: 500 })
    }

    // Data de vencimento: mínimo D+1
    const hoje = new Date()
    const dataVenc = new Date(vencimento + 'T00:00:00')
    const dataFinal = dataVenc > hoje ? dataVenc : new Date(hoje.getTime() + 86400000)
    const dataStr = dataFinal.toISOString().split('T')[0]

    const payload = {
      transaction_amount: Number((valorAtualizado || valor).toFixed(2)),
      description: descricao || `Aluguel ${mesReferencia || vencimento}`,
      payment_method_id: 'bolbradesco',
      payer: {
        first_name: nomeLocatario.split(' ')[0],
        last_name: nomeLocatario.split(' ').slice(1).join(' ') || nomeLocatario.split(' ')[0],
        email: emailLocatario || 'locatario@admeasy.com.br',
        identification: {
          type: 'CPF',
          number: (cpfLocatario || '').replace(/\D/g, ''),
        },
      },
      date_of_expiration: `${dataStr}T23:59:59.000-03:00`,
      metadata: {
        cobranca_id: cobrancaId,
        mes_referencia: mesReferencia,
      },
    }

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `boleto-${cobrancaId}-${Date.now()}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Erro Mercado Pago:', data)
      return NextResponse.json({
        erro: data.message || 'Erro ao gerar boleto no Mercado Pago.',
        detalhes: data,
      }, { status: response.status })
    }

    return NextResponse.json({
      id: data.id,
      status: data.status,
      linhaDigitavel: data.transaction_details?.barcode_content || '',
      urlBoleto: data.transaction_details?.external_resource_url || '',
      qrCodePix: data.point_of_interaction?.transaction_data?.qr_code || '',
      qrCodePixBase64: data.point_of_interaction?.transaction_data?.qr_code_base64 || '',
      valorFinal: data.transaction_amount,
      vencimento: dataStr,
    })
  } catch (err: any) {
    console.error('Erro interno:', err)
    return NextResponse.json({ erro: 'Erro interno ao gerar boleto.' }, { status: 500 })
  }
}
