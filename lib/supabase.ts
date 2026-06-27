import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only client. The service-role key bypasses RLS, so never import this
// from a client component — it must stay in route handlers / server code.
let cached: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase env vars: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  cached = createClient(url, serviceKey, { auth: { persistSession: false } });
  return cached;
}
