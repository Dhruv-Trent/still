"use client";
import { useEffect, useState } from "react";
import Workspace from "@/components/workspace";
import { configured, supabase } from "@/lib/supabase";
export default function Page() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  useEffect(() => {
    if (!configured()) {
      location.replace("/auth");
      return;
    }
    void supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) setUser(data.session.user);
        else location.replace("/auth");
      });
    const { data } = supabase().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) location.replace("/auth");
      else setUser(session.user);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return user ? (
    <Workspace key={user.id} user={user} />
  ) : (
    <main className="loading" aria-busy="true">
      Opening your space…
    </main>
  );
}
