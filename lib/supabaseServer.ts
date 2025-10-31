import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

// Returns a Supabase client bound to server request cookies when available.
// Falls back to anon client if @supabase/auth-helpers-nextjs is not installed.
export async function getServerSupabase() {
  // Prefer @supabase/ssr when available (works well with awaited cookies() in Next 15)
  try {
    type CookieOptionsCompat = Partial<{
      path: string;
      domain: string;
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'lax' | 'strict' | 'none';
      maxAge: number;
      expires: Date;
    }>;

    type NodeRequireFn = (id: string) => unknown;
    const req = eval('require') as NodeRequireFn;
    const { createServerClient } = req('@supabase/ssr') as {
      createServerClient: (
        url: string,
        anonKey: string,
        options: {
          cookies: {
            get: (name: string) => string | undefined;
            set: (name: string, value: string, options?: CookieOptionsCompat) => void;
            remove: (name: string, options?: CookieOptionsCompat) => void;
          }
        }
      ) => ReturnType<typeof createClient>;
    };

    const cookieStore = await cookies();
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => cookieStore.get(name)?.value,
          set: (name: string, value: string, options?: CookieOptionsCompat) => {
            // In route handlers, cookies() is mutable and supports set/remove
            // We call cookies() again to ensure the latest store per request lifecycle
            (async () => { (await cookies()).set(name, value, options); })();
          },
          remove: (name: string, options?: CookieOptionsCompat) => {
            (async () => { (await cookies()).set(name, '', { ...options, maxAge: 0 }); })();
          },
        },
      }
    );
  } catch {
    // Fallback to plain client (no auth cookie binding)
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
}
