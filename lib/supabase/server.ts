import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';

export function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  // Safe dynamic require for server-only environment
  if (typeof window !== 'undefined') {
    return null;
  }

  try {
    const { cookies } = require('next/headers');
    const cookieStore = cookies();

    return createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component
          }
        },
      },
    });
  } catch {
    // If cookies() is unavailable (e.g., during static pre-rendering, ISR, or outside request scope),
    // fallback to a stateless Supabase client so public data can always be read from the real database!
    return createSupabaseJsClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
}
