import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

// Returns a Supabase client bound to server request cookies when available.
// Falls back to anon client if @supabase/auth-helpers-nextjs is not installed.
export function getServerSupabase() {
  try {
    // Define a minimal Node-style require signature to avoid explicit any
    type NodeRequireFn = (id: string) => unknown;
    const req = eval('require') as NodeRequireFn;
    const { createRouteHandlerClient } = req('@supabase/auth-helpers-nextjs') as {
      createRouteHandlerClient: (args: { cookies: typeof cookies }) => ReturnType<typeof createClient>;
    };
    return createRouteHandlerClient({ cookies })
  } catch {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
}
