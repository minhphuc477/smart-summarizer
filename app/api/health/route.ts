import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'ok' as 'ok' | 'degraded' | 'error',
    database: 'unknown' as 'ok' | 'error' | 'unknown',
    groq: 'unknown' as 'configured' | 'missing' | 'unknown',
    version: process.env.npm_package_version || 'unknown'
  };

  try {
    // Check database connection
    const supabase = getServerSupabase();
    const { error: dbError } = await supabase
      .from('notes')
      .select('id')
      .limit(1);
    
    checks.database = dbError ? 'error' : 'ok';

    // Check GROQ API key configuration
    const groqKey = process.env.GROQ_API_KEY;
    checks.groq = groqKey ? 'configured' : 'missing';

    // Determine overall status
    const allOk = checks.database === 'ok' && checks.groq === 'configured';
    checks.status = allOk ? 'ok' : 'degraded';

    return NextResponse.json(checks, { 
      status: allOk ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
  } catch (error) {
    return NextResponse.json({
      ...checks,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
  }
}
