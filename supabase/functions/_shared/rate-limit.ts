// Simple rate limiter using Supabase
// Stores rate limit state in a lightweight table
// For edge functions that need per-user throttling

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WINDOW_MS = 60 * 1000 // 1 minute window
const MAX_REQUESTS: Record<string, number> = {
  'send-email': 5,
  'record-deletion': 3,
  'check-deleted': 10,
  'accept-invite': 10,
  'default': 30,
}

// Lightweight in-memory rate limiter per edge function instance
// Each Deno Deploy isolate gets its own Map, which resets on cold start
// This is acceptable for basic protection; not distributed
const buckets = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(identifier: string, functionName: string): { allowed: boolean; retryAfter?: number } {
  const key = `${functionName}:${identifier}`
  const now = Date.now()
  const maxReqs = MAX_REQUESTS[functionName] || MAX_REQUESTS['default']

  const bucket = buckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true }
  }

  if (bucket.count >= maxReqs) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)
    return { allowed: false, retryAfter }
  }

  bucket.count++
  return { allowed: true }
}

export function rateLimitResponse(retryAfter: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ error: 'Too many requests' }), {
    status: 429,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfter),
    },
  })
}
