import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  initialize: () => Promise<() => void>
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  session: null,
  loading: true,

  async signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/special-umbrella/',
      },
    })
    if (error) console.error('[auth] signInWithGoogle failed:', error.message)
  },

  async signOut() {
    await supabase.auth.signOut()
    set({ user: null, session: null })
  },

  async initialize() {
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        set({ user: session?.user ?? null, session, loading: false })
      })
      return () => subscription.unsubscribe()
    } catch (err) {
      console.error('[auth] Failed to initialize auth listener:', err)
      set({ loading: false })
      return () => {}
    }
  },
}))
