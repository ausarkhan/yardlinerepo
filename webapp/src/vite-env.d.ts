/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  // Phase 4 — Stripe (publishable key is safe to expose; secret keys never are).
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  // Public origin of the webapp (defaults to window.location.origin).
  readonly VITE_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
