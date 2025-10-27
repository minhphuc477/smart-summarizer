import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET: Lấy danh sách members của workspace
export async function GET(request: NextRequest, context: { params: { id: string } }) {
  const { id: workspaceId } = context.params;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: workspaceId } = params;

    // Get members với user info
    const { data: members, error } = await supabase
      .from('workspace_members')
      .select(`
        *,
        user:user_id (
          id,
          email,
          raw_user_meta_data
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('Error fetching members:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Mời member mới (by email)
export async function POST(request: NextRequest, context: { params: { id: string } }) {
  const { id: workspaceId } = context.params;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: workspaceId } = params;
    const body = await request.json();
    const { email } = body;

    // Validation
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Call the invite function
    const { data, error } = await supabase.rpc('invite_to_workspace', {
      workspace_uuid: workspaceId,
      invitee_email: email.trim().toLowerCase(),
      inviter_uuid: session.user.id,
    });

    if (error) {
      console.error('Error inviting member:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Check result
    const result = data as { success: boolean; error?: string; user_id?: string };
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to invite member' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, userId: result.user_id }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Xóa member khỏi workspace
export async function DELETE(request: NextRequest, context: { params: { id: string } }) {
  const { id: workspaceId } = context.params;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: workspaceId } = params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    // Delete member (RLS sẽ check permission)
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing member:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
