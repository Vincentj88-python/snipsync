import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const WEBHOOK_SECRET = Deno.env.get('LS_WEBHOOK_SECRET')
if (!WEBHOOK_SECRET) throw new Error('LS_WEBHOOK_SECRET is required')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

async function verifySignature(payload: string, signature: string): Promise<boolean> {
  if (!WEBHOOK_SECRET || !signature) return false
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
  // Use crypto.subtle.verify for constant-time comparison
  const signatureBytes = new Uint8Array(
    (signature.match(/.{1,2}/g) || []).map((b) => parseInt(b, 16))
  )
  return crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(payload))
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const body = await req.text()
  const signature = req.headers.get('x-signature') || ''

  // Verify webhook signature
  const valid = await verifySignature(body, signature)
  if (!valid) {
    return new Response('Invalid signature', { status: 401 })
  }

  const event = JSON.parse(body)
  const eventName = event.meta?.event_name
  const attrs = event.data?.attributes

  if (!eventName || !attrs) {
    return new Response('Invalid payload', { status: 400 })
  }

  // Extract user_id from custom data (passed during checkout)
  const userId = event.meta?.custom_data?.user_id || attrs.custom_data?.user_id
  if (!userId) {
    return new Response('Missing user_id', { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  switch (eventName) {
    case 'subscription_created':
    case 'subscription_updated':
    case 'subscription_resumed': {
      const status = attrs.status === 'active' ? 'active'
        : attrs.status === 'past_due' ? 'past_due'
        : attrs.status === 'cancelled' ? 'cancelled'
        : 'active'

      await supabase.from('subscriptions').upsert({
        user_id: userId,
        plan: 'pro',
        status,
        ls_subscription_id: String(event.data.id),
        ls_customer_id: String(attrs.customer_id),
        current_period_end: attrs.renews_at || attrs.ends_at,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      break
    }

    case 'subscription_cancelled':
    case 'subscription_expired': {
      await supabase.from('subscriptions').upsert({
        user_id: userId,
        plan: 'free',
        status: 'expired',
        ls_subscription_id: String(event.data.id),
        current_period_end: attrs.ends_at,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      break
    }

    case 'subscription_payment_failed': {
      await supabase.from('subscriptions').update({
        status: 'past_due',
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId)
      break
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
