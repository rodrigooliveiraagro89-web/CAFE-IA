import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export type ProfileTipo = "consultor" | "produtor";

export type Profile = {
  nome: string;
  tipo: ProfileTipo;
};

export type SignUpInput = {
  email: string;
  password: string;
  nome: string;
  tipo: ProfileTipo;
};

export type SignInInput = {
  email: string;
  password: string;
};

export type AuthController = {
  session: Session | null;
  userId: string | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signUp: (input: SignUpInput) => Promise<void>;
  signIn: (input: SignInInput) => Promise<void>;
  signOut: () => Promise<void>;
};

export function useAuth(): AuthController {
  const [session, setSession] = useState<Session | null>(null);
  const [fetchedProfile, setFetchedProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = session?.user?.id ?? null;
  const profile = userId ? fetchedProfile : null;

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    supabase
      .from("profiles")
      .select("nome, tipo")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        setFetchedProfile({
          nome: (data.nome as string) ?? "",
          tipo: (data.tipo as ProfileTipo) ?? "produtor",
        });
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const signUp = useCallback(async (input: SignUpInput) => {
    setError(null);
    const { error: signUpError } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: { data: { nome: input.nome.trim(), tipo: input.tipo } },
    });
    if (signUpError) {
      setError(signUpError.message);
      throw signUpError;
    }
  }, []);

  const signIn = useCallback(async (input: SignInInput) => {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: input.email.trim(),
      password: input.password,
    });
    if (signInError) {
      setError(signInError.message);
      throw signInError;
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    session,
    userId,
    profile,
    loading,
    error,
    signUp,
    signIn,
    signOut,
  };
}
