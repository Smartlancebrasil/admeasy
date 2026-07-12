// Ponte simples para o dataLayer do Google Tag Manager. Os eventos empurrados
// aqui ficam disponíveis para qualquer tag configurada no painel do GTM —
// GA4, Meta Pixel, Google Ads (conversão) — sem precisar de código novo
// quando uma tag for adicionada/ajustada lá.
export function pushDataLayerEvent(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return
  const w = window as unknown as { dataLayer?: Record<string, unknown>[] }
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push({ event, ...params })
}
