import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client with admin privileges (service role).
 * This bypasses Row Level Security and should only be used in secure server-side contexts
 * like API routes, especially for webhooks that don't have user sessions.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[v0] Missing Supabase admin env vars:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
    })
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
