import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FROM = 'SnipSync <noreply@updates.snipsync.xyz>'
const NOTIFY_EMAIL = 'vincent@snipsync.xyz'

function layout(title: string, accent: string, body: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; background: #f0f0f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <div style="max-width: 480px; margin: 0 auto; padding: 32px 16px;">
        <div style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <div style="background: #0a0a0a; padding: 32px 32px 28px; text-align: center;">
            <img src="https://snipsync.xyz/email-logo-dark.png" alt="SnipSync" width="160" height="43" style="display: inline-block; margin: 0 0 16px;" />
            <h1 style="font-size: 22px; font-weight: 600; color: #ffffff; margin: 0; letter-spacing: -0.02em;">${title}</h1>
            <div style="width: 40px; height: 3px; background: ${accent}; margin: 14px auto 0; border-radius: 2px;"></div>
          </div>
          <div style="padding: 28px 32px 32px;">
            ${body}
          </div>
        </div>
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

function waitlistEmail() {
  return {
    subject: "You're on the list — here's what we're building",
    html: layout("You're on the list", '#22c55e', `
      <p style="font-size: 15px; line-height: 1.6; color: #333; margin: 0 0 16px;">Hey, thanks for signing up!</p>

      <p style="font-size: 15px; line-height: 1.6; color: #444; margin: 0 0 16px;">We're building <strong>SnipSync</strong> because clipboard sync shouldn't be this hard. You copy a link on your Mac, walk over to your Windows PC, and... it's gone. You end up emailing yourself, or pasting into Slack DMs, or typing it out by hand. We've all been there.</p>

      <p style="font-size: 15px; line-height: 1.6; color: #444; margin: 0 0 16px;">SnipSync fixes that. Copy on one device, paste on another &mdash; text, links, images, files. It lives in your system tray, syncs in real time, and supports end-to-end encryption so your data stays yours.</p>

      <div style="background: #f0fdf4; border: 1px solid #dcfce7; border-radius: 8px; padding: 16px 18px; margin: 0 0 20px;">
        <p style="font-size: 13px; font-weight: 600; color: #166534; margin: 0 0 10px;">Where we are right now</p>
        <table style="width: 100%; border: none; border-collapse: collapse;">
          <tr><td style="padding: 4px 0; font-size: 13px; color: #15803d; width: 24px; vertical-align: top;">&#10003;</td><td style="padding: 4px 0; font-size: 13px; color: #444;">Chrome extension &mdash; live and free</td></tr>
          <tr><td style="padding: 4px 0; font-size: 13px; color: #15803d; width: 24px; vertical-align: top;">&#10003;</td><td style="padding: 4px 0; font-size: 13px; color: #444;">End-to-end encryption &mdash; done</td></tr>
          <tr><td style="padding: 4px 0; font-size: 13px; color: #d97706; width: 24px; vertical-align: top;">&#9675;</td><td style="padding: 4px 0; font-size: 13px; color: #444;">Mac &amp; Windows desktop apps &mdash; in beta</td></tr>
          <tr><td style="padding: 4px 0; font-size: 13px; color: #d97706; width: 24px; vertical-align: top;">&#9675;</td><td style="padding: 4px 0; font-size: 13px; color: #444;">Mobile apps &mdash; coming next</td></tr>
        </table>
      </div>

      <p style="font-size: 15px; line-height: 1.6; color: #444; margin: 0 0 16px;">We'll email you as soon as the desktop apps are ready to download. No spam, no fluff &mdash; just a heads-up when it's go time.</p>

      <p style="font-size: 15px; line-height: 1.6; color: #444; margin: 0 0 8px;">We'll keep you posted as things progress. If you have any questions or ideas, just reply to this email &mdash; we read everything.</p>

      <div style="text-align: center; margin: 24px 0 8px;">
        <a href="https://snipsync.xyz" style="display: inline-block; background: #22c55e; color: #fff; font-size: 14px; font-weight: 600; padding: 10px 28px; border-radius: 8px; text-decoration: none;">Visit SnipSync</a>
      </div>

      <p style="font-size: 13px; color: #999; margin: 24px 0 0;">Cheers,<br/>Vincent &amp; the SnipSync team</p>
    `),
  }
}

function notifyEmail(email: string) {
  return {
    subject: `New waitlist signup: ${email}`,
    html: `<p style="font-family: -apple-system, sans-serif; font-size: 14px; color: #333;">
      <strong>${email}</strong> just joined the SnipSync waitlist.
    </p>`,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email } = await req.json()

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const normalized = email.trim().toLowerCase()

    // Rate limit by email
    const rl = checkRateLimit(normalized, 'waitlist-signup')
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfter!, corsHeaders)
    }

    // Insert into waitlist
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { error: insertError } = await supabase
      .from('waitlist')
      .insert({ email: normalized })

    if (insertError) {
      // Duplicate email (unique constraint)
      if (insertError.code === '23505') {
        return new Response(JSON.stringify({ error: 'already_registered' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      console.error('[waitlist-signup] Insert error:', insertError.message)
      throw new Error('Insert failed')
    }

    // Send emails (don't block on failures — signup is already saved)
    const apiKey = Deno.env.get('RESEND_API_KEY')!
    const userMail = waitlistEmail()
    const adminMail = notifyEmail(normalized)

    const sendEmail = (to: string, subject: string, html: string) =>
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: FROM, to, subject, html }),
      })

    const [userRes, adminRes] = await Promise.allSettled([
      sendEmail(normalized, userMail.subject, userMail.html),
      sendEmail(NOTIFY_EMAIL, adminMail.subject, adminMail.html),
    ])

    if (userRes.status === 'rejected') {
      console.error('[waitlist-signup] User email failed:', userRes.reason)
    }
    if (adminRes.status === 'rejected') {
      console.error('[waitlist-signup] Admin email failed:', adminRes.reason)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[waitlist-signup]', err.message)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
