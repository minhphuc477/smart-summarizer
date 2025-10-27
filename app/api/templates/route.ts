import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET: Lấy danh sách templates
export async function GET() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get system templates và user's custom templates
    const { data: templates, error } = await supabase
      .from('templates')
      .select('*')
      .or(`is_system.eq.true,user_id.eq.${session.user.id}`)
      .order('is_system', { ascending: false })
      .order('usage_count', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Tạo custom template
export async function POST(request: Request) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, category, icon, persona_prompt, structure } = body;

    // Validation
    if (!name || !category || !structure) {
      return NextResponse.json(
        { error: 'Name, category, and structure are required' },
        { status: 400 }
      );
    }

    // Create template
    const { data: template, error } = await supabase
      .from('templates')
      .insert({
        name,
        description,
        category,
        icon: icon || '📝',
        persona_prompt,
        structure,
        is_system: false,
        user_id: session.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
