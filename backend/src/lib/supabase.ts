// Supabase service-role access for trusted server-side writes.
//
// The webapp talks to Supabase directly (anon key, RLS-enforced). Only the
// payment trust boundary runs here: webhook finalization and payment-gated
// reads/writes that must bypass RLS use the service role. The service role key
// NEVER reaches the browser.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function supabaseConfigured(): boolean {
  return !!SUPABASE_URL && !!SERVICE_KEY;
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: SERVICE_KEY!,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Auth — resolve the caller's user id from their Supabase access token.
// ---------------------------------------------------------------------------
export async function getUserId(authHeader: string | undefined): Promise<string | null> {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token || !SUPABASE_URL || !SERVICE_KEY) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return user?.id ?? null;
}

// ---------------------------------------------------------------------------
// Thin REST helpers (PostgREST). `query` is the part after `?` (filters+select).
// ---------------------------------------------------------------------------
export async function sbSelect<T = Record<string, unknown>>(
  table: string,
  query: string,
): Promise<T[]> {
  if (!supabaseConfigured()) return [];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: headers() });
  if (!res.ok) throw new Error(`Supabase select ${table} ${res.status}: ${await res.text()}`);
  return (await res.json()) as T[];
}

export async function sbInsert<T = Record<string, unknown>>(
  table: string,
  body: Record<string, unknown> | Record<string, unknown>[],
  opts?: { returning?: boolean },
): Promise<T[]> {
  if (!supabaseConfigured()) throw new Error("Supabase not configured");
  const prefer = opts?.returning ? "return=representation" : "return=minimal";
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: headers({ Prefer: prefer }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase insert ${table} ${res.status}: ${await res.text()}`);
  return opts?.returning ? ((await res.json()) as T[]) : [];
}

export async function sbUpdate(
  table: string,
  query: string,
  body: Record<string, unknown>,
): Promise<void> {
  if (!supabaseConfigured()) throw new Error("Supabase not configured");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase update ${table} ${res.status}: ${await res.text()}`);
}

export async function sbDelete(table: string, query: string): Promise<void> {
  if (!supabaseConfigured()) throw new Error("Supabase not configured");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers: headers({ Prefer: "return=minimal" }),
  });
  if (!res.ok) throw new Error(`Supabase delete ${table} ${res.status}: ${await res.text()}`);
}

export { SUPABASE_URL, SERVICE_KEY };
