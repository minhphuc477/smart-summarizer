import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

// GET: Lấy danh sách workspaces của user
export async function GET() {
  try {
    const supabase = await getServerSupabase();
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's workspaces using the view
    const { data: workspaces, error } = await supabase
      .from('user_workspaces')
      .select('*')
  .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching workspaces:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Tạo workspace mới
export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase();
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { name, description } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Workspace name is required' },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Workspace name too long (max 100 characters)' },
        { status: 400 }
      );
    }

    // Create workspace
    const { data: workspace, error } = await supabase
      .from('workspaces')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        owner_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating workspace:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
