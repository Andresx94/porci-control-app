import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const clavePublica = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Sin variables no hay cliente: la sincronización queda apagada.
export const supabase: SupabaseClient | null =
  url && clavePublica
    ? createClient(url, clavePublica, {
        // La sesión queda en el localStorage del dispositivo.
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      })
    : null;

export function hayNube(): boolean {
  return supabase !== null;
}
