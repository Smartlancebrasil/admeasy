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

    const payloadBase = {
      transaction_amount: Number((valorAtualizado || valor).toFixed(2)),
      description: descricao || `Aluguel ${mesReferencia || vencimento}`,
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

    const idemBase = `${cobrancaId}-${Date.now()}`

    // Gera os dois pagamentos em paralelo: um boleto (bolbradesco) e um Pix.
    // São dois pagamentos distintos no Mercado Pago para a mesma cobrança —
    // o locatário paga por qualquer um dos dois, e o webhook identifica a
    // cobrança certa em ambos os casos via metadata.cobranca_id.
    const [resBoleto, resPix] = await Promise.all([
      fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `boleto-${idemBase}`,
        },
        body: JSON.stringify({ ...payloadBase, payment_method_id: 'bolbradesco' }),
      }),
      fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `pix-${idemBase}`,
        },
        body: JSON.stringify({ ...payloadBase, payment_method_id: 'pix' }),
      }),
    ])

    const [dataBoleto, dataPix] = await Promise.all([resBoleto.json(), resPix.json()])

    if (!resBoleto.ok) console.error('Erro Mercado Pago (boleto):', dataBoleto)
    if (!resPix.ok) console.error('Erro Mercado Pago (pix):', dataPix)

    // Se os dois falharem, aí sim é erro real — sem boleto e sem Pix não tem
    // como o locatário pagar nada.
    if (!resBoleto.ok && !resPix.ok) {
      return NextResponse.json({
        erro: dataBoleto.message || dataPix.message || 'Erro ao gerar boleto e Pix no Mercado Pago.',
        detalhes: { boleto: dataBoleto, pix: dataPix },
      }, { status: 500 })
    }

    return NextResponse.json({
      // "id" mantido por compatibilidade com o código atual do portal, que
      // salva esse valor em cobrancas.mp_payment_id
      id: dataBoleto?.id || dataPix?.id,
      idBoleto: resBoleto.ok ? dataBoleto.id : null,
      idPix: resPix.ok ? dataPix.id : null,
      status: (resBoleto.ok ? dataBoleto.status : null) || (resPix.ok ? dataPix.status : null),
      linhaDigitavel: resBoleto.ok ? (dataBoleto.transaction_details?.barcode_content || '') : '',
      urlBoleto: resBoleto.ok ? (dataBoleto.transaction_details?.external_resource_url || '') : '',
      qrCodePix: resPix.ok ? (dataPix.point_of_interaction?.transaction_data?.qr_code || '') : '',
      qrCodePixBase64: resPix.ok ? (dataPix.point_of_interaction?.transaction_data?.qr_code_base64 || '') : '',
      valorFinal: (resBoleto.ok ? dataBoleto.transaction_amount : null) ?? (resPix.ok ? dataPix.transaction_amount : null),
      vencimento: dataStr,
      erroBoleto: resBoleto.ok ? null : (dataBoleto.message || 'Falha ao gerar boleto.'),
      erroPix: resPix.ok ? null : (dataPix.message || 'Falha ao gerar Pix.'),
    })
  } catch (err: any) {
    console.error('Erro interno:', err)
    return NextResponse.json({ erro: 'Erro interno ao gerar boleto.' }, { status: 500 })
  }
}
