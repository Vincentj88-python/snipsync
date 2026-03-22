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

    // Verify JWT
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const retryAfter = checkRate(user.id)
    if (retryAfter !== null) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) },
      })
    }

    const { invite_code } = await req.json()
    if (!invite_code) {
      return new Response(JSON.stringify({ error: 'invite_code required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Look up invite
    const { data: invite, error: inviteError } = await supabase
      .from('team_invites')
      .select('*, teams(name)')
      .eq('invite_code', invite_code)
      .single()

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ error: 'Invalid invite code' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check expiry
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Invite has expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check max uses
    if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
      return new Response(JSON.stringify({ error: 'Invite has reached maximum uses' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', invite.team_id)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      return new Response(JSON.stringify({ error: 'Already a member of this team', team_id: invite.team_id }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check seat limit
    const team = invite.teams
    if (team) {
      const { data: teamData } = await supabase.from('teams').select('max_seats').eq('id', invite.team_id).single()
      if (teamData?.max_seats) {
        const { count } = await supabase
          .from('team_members')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', invite.team_id)
        if (count && count >= teamData.max_seats) {
          return new Response(JSON.stringify({ error: 'Team has reached maximum seats' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    // Add member (service role bypasses RLS)
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({ team_id: invite.team_id, user_id: user.id, role: invite.role })

    if (memberError) {
      return new Response(JSON.stringify({ error: 'Failed to join team' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Increment use count
    await supabase
      .from('team_invites')
      .update({ use_count: invite.use_count + 1 })
      .eq('id', invite.id)

    return new Response(JSON.stringify({
      success: true,
      team_id: invite.team_id,
      team_name: invite.teams?.name || 'Unknown',
      role: invite.role,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[accept-invite]', err.message)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
