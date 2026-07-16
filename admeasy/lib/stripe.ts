import Stripe from 'stripe'

export function getStripe() {
  const apiKey = process.env.STRIPE_SECRET_KEY

  if (!apiKey) {
    throw new Error('STRIPE_SECRET_KEY não configurada.')
  }

  return new Stripe(apiKey, {
    apiVersion: '2026-06-24.dahlia',
  })
}
