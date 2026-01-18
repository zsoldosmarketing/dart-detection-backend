import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { Tables } from '../lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Tables['user_profile'] | null;
  isLoading: boolean;
  isAdmin: boolean;
  shouldShowPushPrompt: boolean;
  setShouldShowPushPrompt: (show: boolean) => void;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Tables['user_profile']>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isAdmin: false,
  shouldShowPushPrompt: false,

  setShouldShowPushPrompt: (show: boolean) => set({ shouldShowPushPrompt: show }),

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: profile } = await supabase
          .from('user_profile')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        set({
          user: session.user,
          session,
          profile,
          isAdmin: profile?.is_admin || false,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }

      supabase.auth.onAuthStateChange((event, session) => {
        (async () => {
          if (event === 'SIGNED_IN' && session?.user) {
            const { data: profile } = await supabase
              .from('user_profile')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            set({
              user: session.user,
              session,
              profile,
              isAdmin: profile?.is_admin || false,
              shouldShowPushPrompt: true,
            });
          } else if (event === 'SIGNED_OUT') {
            set({
              user: null,
              session: null,
              profile: null,
              isAdmin: false,
              shouldShowPushPrompt: false,
            });
          }
        })();
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ isLoading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      const { data, error } = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 15000)
        )
      ]);

      if (error) {
        return { error };
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('user_profile')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        set({
          user: data.user,
          session: data.session,
          profile,
          isAdmin: profile?.is_admin || false,
          shouldShowPushPrompt: true,
        });
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  },

  signUp: async (email: string, password: string, username: string) => {
    try {
      const { data, error } = await Promise.race([
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
              display_name: username,
            }
          }
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 15000)
        )
      ]);

      if (error) {
        return { error };
      }

      if (data.user) {
        await new Promise(resolve => setTimeout(resolve, 500));

        const { data: profile } = await supabase
          .from('user_profile')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        set({
          user: data.user,
          session: data.session,
          profile,
          isAdmin: false,
          shouldShowPushPrompt: true,
        });
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({
      user: null,
      session: null,
      profile: null,
      isAdmin: false,
    });
  },

  updateProfile: async (updates: Partial<Tables['user_profile']>) => {
    const { user } = get();
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
      .from('user_profile')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (!error) {
      await get().refreshProfile();
    }

    return { error };
  },

  refreshProfile: async () => {
    const { user } = get();
    if (!user) return;

    const { data: profile } = await supabase
      .from('user_profile')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      set({ profile, isAdmin: profile.is_admin || false });
    }
  },
}));
