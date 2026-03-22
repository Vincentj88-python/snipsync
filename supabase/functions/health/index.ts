import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Quick DB check
    const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true })

    return new Response(JSON.stringify({
      status: error ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      db: error ? 'error' : 'connected',
    }), {
      status: error ? 503 : 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({
      status: 'error',
      timestamp: new Date().toISOString(),
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
