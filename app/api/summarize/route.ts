import { NextResponse } from 'next/server';
import { getGroqSummary } from '@/lib/groq'; // Import hàm tái sử dụng
import { getServerSupabase } from '@/lib/supabaseServer';
import { createRequestLogger } from '@/lib/logger';

export async function POST(req: Request) {
  const startTime = Date.now();
  const logger = createRequestLogger(req);
  
  logger.info('Starting summarization request');

  try {
    const { notes, customPersona, userId, folderId, workspaceId, isGuest } = await req.json();
    
    logger.debug('Request payload received', { 
      hasNotes: !!notes, 
      noteLength: notes?.length,
      customPersona, 
      userId, 
      folderId, 
      workspaceId,
      isGuest 
    });

    if (!notes) {
      logger.warn('Missing required field: notes');
      return NextResponse.json({ error: "Notes content is required." }, { status: 400 });
    }

    // Call Groq API for summarization
    const aiStartTime = Date.now();
    const jsonResponse = await getGroqSummary(notes, customPersona);
    const aiDuration = Date.now() - aiStartTime;
    
    logger.info('AI summarization completed', undefined, { 
      aiDuration, 
      tagsCount: jsonResponse.tags?.length || 0,
      sentiment: jsonResponse.sentiment 
    });
    
    // Guest mode: chỉ trả về kết quả, không lưu DB
    if (isGuest) {
      logger.info('Guest mode - skipping database save');
      const totalDuration = Date.now() - startTime;
      logger.logResponse('POST', '/api/summarize', 200, totalDuration, { isGuest: true });
      return NextResponse.json(jsonResponse);
    }
    
    // Logged in mode: Lưu vào database
    if (userId && jsonResponse.tags && Array.isArray(jsonResponse.tags)) {
      const dbStartTime = Date.now();
  const supabase = await getServerSupabase();
      
      try {
        // Bước 1: Lưu note vào bảng notes
        logger.debug('Saving note to database', { userId, folderId, workspaceId });
        
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

        const noteId = noteData.id;
        logger.info('Note saved successfully', { noteId });

        // Bước 2: Xử lý tags
        const tagNames = jsonResponse.tags;
        logger.debug('Processing tags', { tagCount: tagNames.length });

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
            logger.debug('Using existing tag', { tagName, tagId });
          } else {
            // Tạo tag mới
            const { data: newTag, error: tagError } = await supabase
              .from('tags')
              .insert({ name: tagName, user_id: userId })
              .select()
              .single();

            if (tagError) throw tagError;
            tagId = newTag.id;
            logger.debug('Created new tag', { tagName, tagId });
          }

          // Bước 3: Tạo liên kết trong bảng note_tags
          await supabase
            .from('note_tags')
            .insert({ note_id: noteId, tag_id: tagId });
        }

        const dbDuration = Date.now() - dbStartTime;
        logger.info('Database operations completed', undefined, { dbDuration });

        // Bước 4: Tạo embedding cho semantic search (async, không block response)
        logger.debug('Triggering background embedding generation', { noteId });
        
        fetch(`${req.url.replace('/api/summarize', '/api/generate-embedding')}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            noteId: noteId,
            text: notes
          })
        }).catch(err => {
          logger.error('Error generating embedding', err as Error, { noteId });
        });

      } catch (dbError) {
        logger.error('Database operation failed', dbError as Error, { userId });
        // Vẫn trả về kết quả AI dù lưu database thất bại
      }
    }

    const totalDuration = Date.now() - startTime;
    logger.logResponse('POST', '/api/summarize', 200, totalDuration, { userId, isGuest: false });
    return NextResponse.json(jsonResponse);

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    logger.error('Summarization request failed', error as Error);
    logger.logResponse('POST', '/api/summarize', 500, totalDuration);
    return NextResponse.json({ error: "Failed to process the request." }, { status: 500 });
  }
}