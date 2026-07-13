import { createClient } from '@supabase/supabase-js';

let client;

// service_role key bypasses RLS entirely — this file must never be imported
// by anything that runs in the browser. Only used from pages/api/* handlers.
export function getSupabase() {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}
