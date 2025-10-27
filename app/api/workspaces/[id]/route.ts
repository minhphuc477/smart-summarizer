import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

type Params = {
  params: Promise<{
    id: string;
  }>;
};

// GET: Lấy chi tiết workspace
export async function GET(request: NextRequest, props: Params) {
  const params = await props.params;
  const { id } = params;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace with stats
    const { data: workspace, error } = await supabase
      .from('workspace_stats')
      .select('*')
      .eq('workspace_id', id)
      .single();

    if (error) {
      console.error('Error fetching workspace:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    return NextResponse.json({ workspace });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Cập nhật workspace
export async function PATCH(request: NextRequest, props: Params) {
  const params = await props.params;
  const { id } = params;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const { name, description } = body;

    // Validation
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Workspace name cannot be empty' },
          { status: 400 }
        );
      }
      if (name.length > 100) {
        return NextResponse.json(
          { error: 'Workspace name too long (max 100 characters)' },
          { status: 400 }
        );
      }
    }

    // Update workspace
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;

    const { data: workspace, error } = await supabase
      .from('workspaces')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating workspace:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ workspace });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Xóa workspace
export async function DELETE(request: NextRequest, props: Params) {
  const params = await props.params;
  const { id } = params;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete workspace (RLS sẽ check permission)
    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting workspace:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
