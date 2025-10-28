import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

// Returns a Supabase client bound to server request cookies when available.
// Falls back to anon client if @supabase/auth-helpers-nextjs is not installed.
export function getServerSupabase() {
  try {
    // @ts-ignore - dynamic require via eval to avoid bundler resolution
    const req = eval('require') as any
    const { createRouteHandlerClient } = req('@supabase/auth-helpers-nextjs')
    return createRouteHandlerClient({ cookies })
  } catch {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
}
