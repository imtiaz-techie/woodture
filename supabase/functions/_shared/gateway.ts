// Shared helpers for the payment Edge Functions. Runs on the server only —
// merchant secrets are read from Edge Function secrets and never reach the browser.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export const env = (name: string): string => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Payment gateway is not configured (${name} is missing).`);
  return v;
};

/** Service-role client: bypasses RLS, so it must only ever be used inside Edge Functions. */
export const admin = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

export const sslBase = () =>
  Deno.env.get('SSLCOMMERZ_SANDBOX') === 'false' ? 'https://securepay.sslcommerz.com' : 'https://sandbox.sslcommerz.com';

export const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');
