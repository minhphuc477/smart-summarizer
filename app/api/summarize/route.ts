import { NextResponse } from 'next/server';
import { getGroqSummary } from '@/lib/groq'; // Import hàm tái sử dụng
import { createClient } from '@supabase/supabase-js';

// Tạo Supabase client cho server-side
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { notes, customPersona, userId, folderId, workspaceId, isGuest } = await req.json();
    if (!notes) {
      return NextResponse.json({ error: "Notes content is required." }, { status: 400 });
    }

    const jsonResponse = await getGroqSummary(notes, customPersona);
    
    // Guest mode: chỉ trả về kết quả, không lưu DB
    if (isGuest) {
      return NextResponse.json(jsonResponse);
    }
    
    // Logged in mode: Lưu vào database
    if (userId && jsonResponse.tags && Array.isArray(jsonResponse.tags)) {
      try {
        // Bước 1: Lưu note vào bảng notes
        const { data: noteData, error: noteError } = await supabase
          .from('notes')
          .insert({
            user_id: userId,
            persona: customPersona,
            original_notes: notes,
            summary: jsonResponse.summary,
            takeaways: jsonResponse.takeaways,
            actions: jsonResponse.actions,
            sentiment: jsonResponse.sentiment || 'neutral',
            folder_id: folderId || null,
            workspace_id: workspaceId || null
          })
          .select()
          .single();

        if (noteError) throw noteError;

        // Bước 2: Xử lý tags
        const tagNames = jsonResponse.tags;
        const noteId = noteData.id;

        for (const tagName of tagNames) {
          // Kiểm tra xem tag đã tồn tại chưa
          const { data: existingTag } = await supabase
            .from('tags')
            .select('id')
            .eq('name', tagName)
            .eq('user_id', userId)
            .single();

          let tagId: number;

          if (existingTag) {
            // Tag đã tồn tại, dùng ID hiện có
            tagId = existingTag.id;
          } else {
            // Tạo tag mới
            const { data: newTag, error: tagError } = await supabase
              .from('tags')
              .insert({ name: tagName, user_id: userId })
              .select()
              .single();

            if (tagError) throw tagError;
            tagId = newTag.id;
          }

          // Bước 3: Tạo liên kết trong bảng note_tags
          await supabase
            .from('note_tags')
            .insert({ note_id: noteId, tag_id: tagId });
        }

        // Bước 4: Tạo embedding cho semantic search (async, không block response)
        // Gọi API generate-embedding trong background
        fetch(`${req.url.replace('/api/summarize', '/api/generate-embedding')}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            noteId: noteId,
            text: notes
          })
        }).catch(err => console.error('Error generating embedding:', err));

      } catch (dbError) {
        console.error("Error saving to database:", dbError);
        // Vẫn trả về kết quả AI dù lưu database thất bại
      }
    }

    return NextResponse.json(jsonResponse);

  } catch (error) {
    console.error("Error in /api/summarize:", error);
    return NextResponse.json({ error: "Failed to process the request." }, { status: 500 });
  }
}