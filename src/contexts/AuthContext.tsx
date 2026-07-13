import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, type Role } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

type Profile = {
  id: string;
  role: Role;
  username?: string;
  display_name?: string;
  email?: string;
  country_iso2?: string;
  language_code?: string;
  timezone?: string;
  status?: string;
  dashboard_login_enabled?: boolean;
};

type SignupMeta = Partial<Profile> & { signup_nonce?: string };
type AuthResult = { error?: string; code?: string; status?: number; user?: User | null };

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (emailOrUsername: string, password: string) => Promise<AuthResult>;
  signUp: (role: Role, email: string, password: string, meta?: SignupMeta) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string) {
    const { data, error } = await supabase.from('profiles').select('id,role,username,display_name,email,country_iso2,language_code,timezone,status,dashboard_login_enabled').eq('id', uid).maybeSingle();
    if (error) console.error(error);
    setProfile(data as Profile | null);
    return data as Profile | null;
  }

  async function refreshProfile() {
    const { data } = await supabase.auth.getUser();
    setUser(data.user);
    if (data.user) await loadProfile(data.user.id);
    else setProfile(null);
  }

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      else setProfile(null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  async function resolveEmail(input: string) {
    if (input.includes('@')) return input.trim();
    const { data } = await supabase.rpc('resolve_login_email', { login: input.trim() });
    return data || input.trim();
  }

  async function signIn(emailOrUsername: string, password: string): Promise<AuthResult> {
    const email = await resolveEmail(emailOrUsername);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const anyErr = error as any;
      return { error: error.message, code: anyErr.code || anyErr.error_code, status: anyErr.status };
    }
    await refreshProfile();
    return { user: data.user };
  }

  async function signUp(role: Role, email: string, password: string, meta: SignupMeta = {}): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          username: meta.username,
          display_name: meta.display_name || email,
          country_iso2: meta.country_iso2 || 'VN',
          language_code: meta.language_code || (role === 'investor' ? 'en' : 'vi'),
          timezone: meta.timezone || 'Asia/Ho_Chi_Minh',
          signup_nonce: meta.signup_nonce
        }
      }
    });
    if (error) {
      const anyErr = error as any;
      return { error: error.message, code: anyErr.code || anyErr.error_code, status: anyErr.status };
    }

    // With Email OTP enabled, Supabase creates the user and sends the OTP but
    // does not return a session until verifyOtp succeeds on /login.
    if (data.session?.user) {
      setUser(data.session.user);
      await loadProfile(data.session.user.id).catch(() => undefined);
    }

    return { user: data.user };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  const value = useMemo(() => ({ user, profile, loading, signIn, signUp, signOut, refreshProfile }), [user, profile, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
