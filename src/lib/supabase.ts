import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Exported for keepalive fetch in storeSync beforeunload handler.
// Using the raw strings (not the Supabase client) is required because the
// client's fetch wrapper does not support keepalive, and browsers cancel
// non-keepalive requests when the page is torn down.
export const SUPABASE_URL = isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co'
export const SUPABASE_ANON_KEY = isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key'

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values.'
  )
}

// createClient() validates its URL synchronously and throws on a missing or
// malformed one, which would otherwise crash the whole app at import time.
// Fall back to a syntactically valid placeholder so the module always loads;
// callers should check isSupabaseConfigured before relying on real calls.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
)
