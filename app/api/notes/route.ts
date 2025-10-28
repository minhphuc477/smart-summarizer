import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

// GET: List notes for current user with optional filters: folderId, q (search), limit/offset
export async function GET(request: NextRequest) {
  try {
    const supabase = getServerSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');
    const q = searchParams.get('q');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
  const workspaceId = searchParams.get('workspaceId');
    const sentiment = searchParams.get('sentiment'); // positive | neutral | negative
    const dateFrom = searchParams.get('dateFrom'); // ISO date
    const dateTo = searchParams.get('dateTo'); // ISO date
    const hasTags = searchParams.get('hasTags'); // 'true' to require at least one tag
    const sort = (searchParams.get('sort') || 'desc').toLowerCase(); // 'asc' | 'desc'
  const tagsParam = searchParams.get('tags'); // comma-separated tag names

    // Build base select, optionally inner-joining tags if hasTags=true
    const joinTagsInner = hasTags === 'true';
  const selectString = `id,created_at,summary,persona,sentiment,folder_id,is_public,share_id,workspace_id,folders(id,name,color),note_tags${joinTagsInner ? '!inner' : ''}(tags${joinTagsInner ? '!inner' : ''}(id,name))`;

    let query = supabase
      .from('notes')
      .select(selectString)
      .eq('user_id', session.user.id);

    if (folderId) {
      query = query.eq('folder_id', folderId);
    }
    if (q) {
      // Basic ILIKE search on summary/original_notes
      query = query.or(`summary.ilike.%${q}%,original_notes.ilike.%${q}%`);
    }
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }
    if (sentiment) {
      query = query.eq('sentiment', sentiment);
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }
    if (tagsParam) {
      const tags = tagsParam.split(',').map(s => s.trim()).filter(Boolean);
      if (tags.length) {
        // ensure inner join to filter by tag names
        // @ts-ignore nested filter on joined table
        query = query.in('note_tags.tags.name', tags);
      }
    }

    // Order newest first with pagination
    // Note: range is inclusive; emulate limit/offset using range
    const start = offset;
    const end = offset + limit - 1;
    // @ts-ignore - supabase-js supports range on select builders
    const { data: notes, error } = query.order('created_at', { ascending: sort === 'asc' ? true : false }).range(start, end);

    if (error) {
      console.error('Error fetching notes:', error);
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
    }

    return NextResponse.json({ notes: notes || [] });
  } catch (e) {
    console.error('Unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a new note for current user
export async function POST(request: Request) {
  try {
    const supabase = getServerSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const {
      summary,
      original_notes,
      persona,
      folder_id,
      tags,
      sentiment,
      takeaways,
      actions,
      is_public = false,
    } = body || {};

    if (!summary || !original_notes) {
      return NextResponse.json({ error: 'summary and original_notes are required' }, { status: 400 });
    }

    const { data: note, error } = await supabase
      .from('notes')
      .insert({
        user_id: session.user.id,
        summary,
        original_notes,
        persona: persona || null,
        folder_id: folder_id || null,
        tags: tags || null,
        sentiment: sentiment || null,
        takeaways: Array.isArray(takeaways) ? takeaways : null,
        actions: Array.isArray(actions) ? actions : null,
        is_public,
      })
      .select()
      .single();

    if (error || !note) {
      console.error('Error creating note:', error);
      return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
    }

    return NextResponse.json({ note }, { status: 201 });
  } catch (e) {
    console.error('Unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
