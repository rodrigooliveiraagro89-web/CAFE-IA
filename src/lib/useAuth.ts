import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { PlanId } from "../domain/plans";
import { supabase } from "./supabaseClient";
import { activateTrial } from "../features/billing/billingClient";

export type ProfileTipo = "consultor" | "produtor";

export type Profile = {
  nome: string;
  tipo: ProfileTipo;
  plano: PlanId;
  trialAte: string | null;
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
  recovering: boolean;
  signUp: (input: SignUpInput) => Promise<void>;
  signIn: (input: SignInInput) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  startTrial: () => Promise<void>;
};

export function useAuth(): AuthController {
  const [session, setSession] = useState<Session | null>(null);
  const [fetchedProfile, setFetchedProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const userId = session?.user?.id ?? null;
  const profile = userId ? fetchedProfile : null;

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
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
      // select("*") tolera colunas ainda não migradas (ex.: trial_ate) sem
      // derrubar o carregamento do perfil inteiro.
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        setFetchedProfile({
          nome: (data.nome as string) ?? "",
          tipo: (data.tipo as ProfileTipo) ?? "produtor",
          plano: data.plano === "pro" ? "pro" : "gratis",
          trialAte: (data.trial_ate as string | null) ?? null,
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

  const requestPasswordReset = useCallback(async (email: string) => {
    setError(null);
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    if (resetError) {
      setError(resetError.message);
      throw resetError;
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      throw updateError;
    }
    setRecovering(false);
  }, []);

  const startTrial = useCallback(async () => {
    if (!userId || !session?.access_token) return;
    const trialAte = await activateTrial(session.access_token);
    setFetchedProfile((current) => (current ? { ...current, trialAte } : current));
  }, [session, userId]);

  return {
    session,
    userId,
    profile,
    loading,
    error,
    recovering,
    signUp,
    signIn,
    signOut,
    requestPasswordReset,
    updatePassword,
    startTrial,
  };
}
