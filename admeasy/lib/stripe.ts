import Stripe from 'stripe'

// Sem apiVersion fixo: usa a versão padrão da lib instalada (evita ficar
// desatualizado toda vez que o pacote 'stripe' for atualizado no projeto).
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
