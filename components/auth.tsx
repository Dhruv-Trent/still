"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { configured, supabase } from "@/lib/supabase";
export default function Auth() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState(params.get("mode") || "login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!configured()) return;
    const { data } = supabase().auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    return () => data.subscription.unsubscribe();
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    try {
      const client = supabase();
      const redirectTo = `${location.origin}/auth/callback`;
      if (mode === "signup") {
        const { error } = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        setMessage("Check your email to verify your account, then sign in.");
      } else if (mode === "forgot") {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${redirectTo}?next=reset`,
        });
        if (error) throw error;
        setMessage(
          "If an account exists, a reset link is on its way. Open it in this browser.",
        );
      } else if (mode === "reset") {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        router.push("/workspace");
      } else {
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/workspace");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <Link href="/" className="brand">
        <span className="brandmark">
          <Check />
        </span>
        still.
      </Link>
      <section className="auth-card">
        <span className="eyebrow">A LITTLE CLARITY STARTS HERE</span>
        <h1>
          {mode === "signup"
            ? "Make a little room."
            : mode === "forgot"
              ? "Let’s get you back in."
              : mode === "reset"
                ? "A fresh start."
                : "Welcome back."}
        </h1>
        <p className="muted">
          {mode === "signup"
            ? "Your plans deserve a place of their own."
            : mode === "forgot"
              ? "We’ll email you a secure password reset link."
              : "Your day, a little more collected."}
        </p>
        {!configured() ? (
          <div className="notice">
            This installation needs its Supabase connection before accounts can
            be created. Follow the included setup guide to enable secure
            sign-in.
          </div>
        ) : (
          <form onSubmit={submit}>
            {mode !== "reset" && (
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  placeholder="you@example.com"
                />
              </label>
            )}
            {mode !== "forgot" && (
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  minLength={mode === "login" ? 1 : 12}
                  maxLength={128}
                  required
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  placeholder={
                    mode === "login"
                      ? "Your password"
                      : "At least 12 characters"
                  }
                />
              </label>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="notice" role="status">
                {message}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {busy
                ? "One moment…"
                : mode === "signup"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Send reset link"
                    : mode === "reset"
                      ? "Update password"
                      : "Sign in"}
              <ArrowRight size={18} />
            </button>
            {mode === "login" && (
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setMode("forgot");
                  setError("");
                }}
              >
                Forgot password?
              </button>
            )}
          </form>
        )}
        <p className="auth-switch">
          {mode === "signup" ? "Already have an account?" : "New to Still?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setMessage("");
              setError("");
            }}
            className="text-link"
          >
            {mode === "signup" ? "Sign in" : "Create an account"}
          </button>
        </p>
        <small>
          By continuing, you agree to our <Link href="/terms">Terms</Link> and{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </small>
      </section>
      <div className="auth-bottom">One thing at a time. You’ve got this.</div>
    </main>
  );
}
