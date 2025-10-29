import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET: Lấy analytics data
export async function GET(request: NextRequest) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30'; // days
    const days = parseInt(range);

    // Get analytics for last N days
    const { data: analytics, error } = await supabase
      .from('user_analytics')
      .select('*')
      .eq('user_id', session.user.id)
      .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching analytics:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get summary
    const { data: summary } = await supabase
      .from('user_analytics_summary')
      .select('*')
      .eq('user_id', session.user.id)
      .single();

    // Get recent events
    const { data: recentEvents } = await supabase
      .from('usage_events')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    // Get tag distribution
    const { data: tagStats } = await supabase
      .from('note_tags')
      .select(`
        tag_id,
        tags (name)
      `)
      .limit(1000);

    // Count tags
    const tagCounts: Record<string, number> = {};
    const tagItems = (tagStats ?? []) as Array<{ tags?: { name?: string } | null }>;
    tagItems.forEach((item) => {
      const tagName = item.tags?.name;
      if (tagName) {
        tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
      }
    });

    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    return NextResponse.json({
      analytics,
      summary,
      recentEvents,
      topTags,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Track event
export async function POST(request: Request) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { event_type, event_data } = body;

    if (!event_type) {
      return NextResponse.json({ error: 'event_type is required' }, { status: 400 });
    }

    // Insert event
    await supabase.from('usage_events').insert({
      user_id: session.user.id,
      event_type,
      event_data: event_data || {},
    });

    // Update analytics
    await supabase.rpc('increment_user_analytics', {
      p_user_id: session.user.id,
      p_event_type: event_type,
      p_increment_value: 1,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
