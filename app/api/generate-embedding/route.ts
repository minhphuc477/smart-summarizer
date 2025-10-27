import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';

// Tạo Supabase client cho server-side
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Cache the embedding pipeline
let embedder: any = null;

async function getEmbedder() {
  if (!embedder) {
    // Load the model once and cache it
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedder;
}

export async function POST(req: Request) {
  try {
    const { noteId, text } = await req.json();

    if (!noteId || !text) {
      return NextResponse.json({ 
        error: "Note ID and text content are required." 
      }, { status: 400 });
    }

    // 1. Tạo embedding bằng Transformers.js (local, free)
    const pipe = await getEmbedder();
    const output = await pipe(text.substring(0, 5000), {
      pooling: 'mean',
      normalize: true,
    });

    // Convert to array
    const embedding = Array.from(output.data);

    // 2. Cập nhật bản ghi trong bảng `notes` với embedding vừa tạo
    const { error } = await supabase
      .from('notes')
      .update({ embedding: embedding })
      .eq('id', noteId);

    if (error) {
      console.error('Error updating embedding:', error);
      return NextResponse.json({ 
        success: false,
        error: "Failed to save embedding to database." 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: "Embedding generated and saved successfully (using local model)." 
    });

  } catch (error: any) {
    console.error("Error in /api/generate-embedding:", error);
    return NextResponse.json({ 
      success: false,
      error: error.message || "Failed to generate embedding." 
    }, { status: 500 });
  }
}
