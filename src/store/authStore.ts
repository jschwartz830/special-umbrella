import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  authError: string | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  initialize: () => Promise<() => void>
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  session: null,
  loading: true,
  authError: null,

  async signInWithGoogle() {
    set({ authError: null })
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/special-umbrella/',
        },
      })
      if (error) set({ authError: error.message })
    } catch (err) {
      set({ authError: err instanceof Error ? err.message : 'Sign-in failed' })
    }
  },

  async signOut() {
    set({ authError: null })
    try {
      await supabase.auth.signOut()
    } catch (err) {
      set({ authError: err instanceof Error ? err.message : 'Sign-out failed' })
    } finally {
      // Always clear local auth state — the local session token is invalidated
      // whether or not the server-side revocation call succeeded.
      set({ user: null, session: null })
    }
  },

  async initialize() {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null, session, loading: false })
    })

    return () => subscription.unsubscribe()
  },
}))
