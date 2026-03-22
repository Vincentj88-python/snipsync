import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Rate limiting: 5 requests per minute per user
const rateBuckets = new Map<string, { count: number; resetAt: number }>()
function checkRate(id: string): number | null {
  const now = Date.now()
  const b = rateBuckets.get(id)
  if (!b || now > b.resetAt) { rateBuckets.set(id, { count: 1, resetAt: now + 60000 }); return null }
  if (b.count >= 5) return Math.ceil((b.resetAt - now) / 1000)
  b.count++; return null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FROM = 'SnipSync <noreply@updates.snipsync.xyz>'

function layout(title: string, accent: string, body: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; background: #f0f0f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <div style="max-width: 480px; margin: 0 auto; padding: 32px 16px;">
        <!-- Card -->
        <div style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <div style="background: #0a0a0a; padding: 32px 32px 28px; text-align: center;">
            <img src="https://snipsync.xyz/email-logo-dark.png" alt="SnipSync" width="160" height="43" style="display: inline-block; margin: 0 0 16px;" />
            <h1 style="font-size: 22px; font-weight: 600; color: #ffffff; margin: 0; letter-spacing: -0.02em;">${title}</h1>
            <div style="width: 40px; height: 3px; background: ${accent}; margin: 14px auto 0; border-radius: 2px;"></div>
          </div>
          <!-- Body -->
          <div style="padding: 28px 32px 32px;">
            ${body}
          </div>
        </div>
        <!-- Footer -->
        <div style="text-align: center; padding: 20px 0 8px;">
          <p style="font-size: 11px; color: #999; margin: 0;">
            <a href="https://snipsync.xyz" style="color: #999; text-decoration: none;">snipsync.xyz</a>
            &nbsp;&middot;&nbsp;
            <a href="https://snipsync.xyz/privacy.html" style="color: #999; text-decoration: none;">Privacy</a>
            &nbsp;&middot;&nbsp;
            <a href="https://snipsync.xyz/terms.html" style="color: #999; text-decoration: none;">Terms</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

const templates: Record<string, (data: Record<string, string>) => { subject: string; html: string }> = {
  welcome: () => ({
    subject: 'Welcome to SnipSync',
    html: layout('Welcome to SnipSync', '#22c55e', `
      <p style="font-size: 15px; line-height: 1.6; color: #333; margin: 0 0 16px;">Hi there,</p>
      <p style="font-size: 15px; line-height: 1.6; color: #444; margin: 0 0 20px;">Your account is set up and ready to go. Copy on one device, paste on another &mdash; it's that simple.</p>
      <div style="background: #f0fdf4; border: 1px solid #dcfce7; border-radius: 8px; padding: 16px 18px; margin: 0 0 20px;">
        <p style="font-size: 13px; font-weight: 600; color: #166534; margin: 0 0 10px;">Quick start</p>
        <table style="width: 100%; border: none; border-collapse: collapse;">
          <tr><td style="padding: 4px 0; font-size: 13px; color: #15803d; width: 24px; vertical-align: top;">&#10003;</td><td style="padding: 4px 0; font-size: 13px; color: #444;">Open SnipSync on your devices</td></tr>
          <tr><td style="padding: 4px 0; font-size: 13px; color: #15803d; width: 24px; vertical-align: top;">&#10003;</td><td style="padding: 4px 0; font-size: 13px; color: #444;">Copy or paste text &mdash; it syncs automatically</td></tr>
          <tr><td style="padding: 4px 0; font-size: 13px; color: #15803d; width: 24px; vertical-align: top;">&#10003;</td><td style="padding: 4px 0; font-size: 13px; color: #444;">Pin important clips to keep them at the top</td></tr>
          <tr><td style="padding: 4px 0; font-size: 13px; color: #15803d; width: 24px; vertical-align: top;">&#10003;</td><td style="padding: 4px 0; font-size: 13px; color: #444;">Enable encryption for end-to-end privacy</td></tr>
        </table>
      </div>
      <div style="text-align: center; margin: 24px 0 8px;">
        <a href="https://snipsync.xyz" style="display: inline-block; background: #22c55e; color: #fff; font-size: 14px; font-weight: 600; padding: 10px 28px; border-radius: 8px; text-decoration: none;">Get started</a>
      </div>
      <p style="font-size: 13px; color: #999; margin: 24px 0 0;">&mdash; The SnipSync team</p>
    `),
  }),

  'account-deleted': () => ({
    subject: 'Your SnipSync account has been deleted',
    html: layout('Account deleted', '#ef4444', `
      <p style="font-size: 15px; line-height: 1.6; color: #333; margin: 0 0 16px;">Hi,</p>
      <p style="font-size: 15px; line-height: 1.6; color: #444; margin: 0 0 16px;">Your SnipSync account and all associated data have been permanently deleted.</p>
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 18px; margin: 0 0 20px;">
        <p style="font-size: 13px; color: #991b1b; margin: 0; font-weight: 500;">The following data was removed:</p>
        <table style="width: 100%; border: none; border-collapse: collapse; margin-top: 8px;">
          <tr><td style="padding: 3px 0; font-size: 13px; color: #b91c1c; width: 24px; vertical-align: top;">&times;</td><td style="padding: 3px 0; font-size: 13px; color: #555;">All clips and clipboard history</td></tr>
          <tr><td style="padding: 3px 0; font-size: 13px; color: #b91c1c; width: 24px; vertical-align: top;">&times;</td><td style="padding: 3px 0; font-size: 13px; color: #555;">All registered devices</td></tr>
          <tr><td style="padding: 3px 0; font-size: 13px; color: #b91c1c; width: 24px; vertical-align: top;">&times;</td><td style="padding: 3px 0; font-size: 13px; color: #555;">Encryption keys and settings</td></tr>
          <tr><td style="padding: 3px 0; font-size: 13px; color: #b91c1c; width: 24px; vertical-align: top;">&times;</td><td style="padding: 3px 0; font-size: 13px; color: #555;">Account and subscription data</td></tr>
        </table>
      </div>
      <p style="font-size: 15px; line-height: 1.6; color: #444; margin: 0 0 16px;">If you didn't request this, please contact us immediately.</p>
      <p style="font-size: 15px; line-height: 1.6; color: #444; margin: 0 0 8px;">You're welcome to sign up again anytime.</p>
      <div style="text-align: center; margin: 24px 0 8px;">
        <a href="https://snipsync.xyz" style="display: inline-block; background: #0a0a0a; color: #fff; font-size: 14px; font-weight: 600; padding: 10px 28px; border-radius: 8px; text-decoration: none;">Visit SnipSync</a>
      </div>
      <p style="font-size: 13px; color: #999; margin: 24px 0 0;">&mdash; The SnipSync team</p>
    `),
  }),

  'welcome-back': () => ({
    subject: 'Welcome back to SnipSync',
    html: layout('Welcome back', '#22c55e', `
      <p style="font-size: 15px; line-height: 1.6; color: #333; margin: 0 0 16px;">Hi there,</p>
      <p style="font-size: 15px; line-height: 1.6; color: #444; margin: 0 0 16px;">Good to see you again! Your new account is ready.</p>
      <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 14px 18px; margin: 0 0 20px;">
        <p style="font-size: 13px; color: #92400e; margin: 0;"><strong>Note:</strong> Your previous account data was permanently deleted and cannot be restored. You're starting with a clean slate.</p>
      </div>
      <p style="font-size: 15px; line-height: 1.6; color: #444; margin: 0 0 8px;">All the features you know are ready to go. Happy clipping!</p>
      <div style="text-align: center; margin: 24px 0 8px;">
        <a href="https://snipsync.xyz" style="display: inline-block; background: #22c55e; color: #fff; font-size: 14px; font-weight: 600; padding: 10px 28px; border-radius: 8px; text-decoration: none;">Open SnipSync</a>
      </div>
      <p style="font-size: 13px; color: #999; margin: 24px 0 0;">&mdash; The SnipSync team</p>
    `),
  }),
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify authorization: accept user JWT or service-role key
    const authHeader = req.headers.get('authorization')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`

    let authUserEmail: string | null = null

    if (!isServiceRole) {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        serviceRoleKey,
      )
      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      )
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      authUserEmail = user.email || null

      // Rate limit user requests (not service-role)
      const retryAfter = checkRate(user.id)
      if (retryAfter !== null) {
        return new Response(JSON.stringify({ error: 'Too many requests' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) },
        })
      }
    }

    const { to, template, data } = await req.json()

    if (!to || !template) {
      return new Response(JSON.stringify({ error: 'to and template required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Users can only send emails to their own address
    if (!isServiceRole && authUserEmail !== to) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const templateFn = templates[template]
    if (!templateFn) {
      return new Response(JSON.stringify({ error: `Unknown template: ${template}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { subject, html } = templateFn(data || {})
    const apiKey = Deno.env.get('RESEND_API_KEY')

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    })

    const result = await res.json()

    if (!res.ok) {
      console.error('[send-email] Resend error:', JSON.stringify(result))
      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[send-email]', err.message)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
