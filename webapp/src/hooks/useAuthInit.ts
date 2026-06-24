import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { ensureProfile } from "@/lib/auth";
import { useAuthStore } from "@/store/auth";

// Bootstraps the auth session once at app start and keeps it in sync.
export function useAuthInit() {
  const setSession = useAuthStore((s) => s.setSession);
  const setProfile = useAuthStore((s) => s.setProfile);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) {
        ensureProfile(data.session.user).then((p) => {
          if (active) setProfile(p);
        });
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        ensureProfile(session.user).then((p) => setProfile(p));
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [setSession, setProfile]);
}
