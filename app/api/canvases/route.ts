import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET: Lấy danh sách canvases
export async function GET() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: canvases, error } = await supabase
      .from('canvases')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching canvases:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ canvases });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Tạo canvas mới
export async function POST(request: Request) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, workspace_id } = body;

    const { data: canvas, error } = await supabase
      .from('canvases')
      .insert({
        user_id: session.user.id,
        title: title || 'Untitled Canvas',
        description,
        workspace_id: workspace_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating canvas:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Track analytics
    await supabase.rpc('increment_user_analytics', {
      p_user_id: session.user.id,
      p_event_type: 'canvas_created',
      p_increment_value: 1,
    });

    return NextResponse.json({ canvas }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
