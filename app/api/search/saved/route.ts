import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

// Assumes a table `saved_searches` with columns:
// id (serial), user_id (uuid/text), name (text), query (text), filters (jsonb), created_at, updated_at

export async function GET(req: Request) {
  const start = Date.now();
  const logger = createRequestLogger(req);
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    if (!userId) {
      logger.warn('Missing userId for saved searches GET');
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    const supabase = await getServerSupabase();
    const { data, error } = await supabase
      .from('saved_searches')
      .select('id, name, query, filters')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error) {
      logger.error('Failed to load saved searches', error as Error, { userId });
      return NextResponse.json({ error: 'Failed to load saved searches' }, { status: 500 });
    }
    const duration = Date.now() - start;
    logger.logResponse('GET', '/api/search/saved', 200, duration, { userId });
    return NextResponse.json({ items: data || [] });
  } catch (error: unknown) {
    const duration = Date.now() - start;
    logger.error('Error in saved searches GET', error as Error);
    logger.logResponse('GET', '/api/search/saved', 500, duration);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const start = Date.now();
  const logger = createRequestLogger(req);
  try {
    const body = await req.json();
    const { userId, name, query, filters } = body || {};
    if (!userId || !name || !query) {
      logger.warn('Missing fields for saved search POST', { userId, hasName: !!name, hasQuery: !!query });
      return NextResponse.json({ error: 'userId, name, and query are required' }, { status: 400 });
    }
    const supabase = await getServerSupabase();
    // Upsert by (user_id, name)
    const { data, error } = await supabase
      .from('saved_searches')
      .upsert({ user_id: userId, name, query, filters: filters || null }, { onConflict: 'user_id,name' })
      .select('id, name, query, filters')
      .single();
    if (error) {
      logger.error('Failed to save search', error as Error, { userId });
      return NextResponse.json({ error: 'Failed to save search' }, { status: 500 });
    }
    const duration = Date.now() - start;
    logger.logResponse('POST', '/api/search/saved', 200, duration, { userId });
    return NextResponse.json({ ok: true, item: data });
  } catch (error: unknown) {
    const duration = Date.now() - start;
    logger.error('Error in saved searches POST', error as Error);
    logger.logResponse('POST', '/api/search/saved', 500, duration);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
