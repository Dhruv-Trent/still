"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
export default function Callback() {
  const [error, setError] = useState("");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const url = new URL(location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase().auth.exchangeCodeForSession(code);
          if (error) throw error;
        }
        const { data } = await supabase().auth.getSession();
        if (!data.session)
          throw Error(
            "The link has expired or was opened in another browser. Request a new link.",
          );
        location.replace(
          url.searchParams.get("next") === "reset"
            ? "/auth?mode=reset"
            : "/workspace",
        );
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);
  return (
    <main className="loading">
      {error ? (
        <>
          <p role="alert">{error}</p>
          <Link href="/auth">Back to sign in</Link>
        </>
      ) : (
        <p>Verifying your secure link…</p>
      )}
    </main>
  );
}
