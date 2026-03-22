import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const rateBuckets = new Map<string, { count: number; resetAt: number }>()
function checkRate(id: string): number | null {
  const now = Date.now()
  const b = rateBuckets.get(id)
  if (!b || now > b.resetAt) { rateBuckets.set(id, { count: 1, resetAt: now + 60000 }); return null }
  if (b.count >= 10) return Math.ceil((b.resetAt - now) / 1000)
  b.count++; return null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Verify JWT — user must be authenticated
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const retryAfter = checkRate(authUser.id)
    if (retryAfter !== null) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) },
      })
    }

    const { email } = await req.json()

    if (!email) {
      return new Response(JSON.stringify({ error: 'email required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Users can only check their own email
    if (authUser.email !== email) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data } = await supabase
      .from('deleted_accounts')
      .select('id')
      .eq('email', email)
      .limit(1)
      .single()

    return new Response(JSON.stringify({ was_deleted: !!data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ was_deleted: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
