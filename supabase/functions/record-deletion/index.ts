import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, email, machine_ids } = await req.json()

    if (!email || !user_id) {
      return new Response(JSON.stringify({ error: 'email and user_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1. Record deletion for abuse prevention
    await supabase.from('deleted_accounts').insert({
      email,
      machine_ids: machine_ids || [],
    })

    // 2. Delete profile (cascades to devices, clips, subscriptions, tags via FK)
    await supabase.from('profiles').delete().eq('id', user_id)

    // 3. Delete auth user so Google OAuth doesn't auto-sign them back in
    await supabase.auth.admin.deleteUser(user_id)

    // 4. Send deletion confirmation email via send-email function (non-blocking)
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: email, template: 'account-deleted' }),
      })
    } catch {
      // Email is non-blocking
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
