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
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedder;
}

export async function POST(req: Request) {
  try {
    const { query, userId, matchCount = 5, matchThreshold = 0.78 } = await req.json();

    if (!query || !query.trim()) {
      return NextResponse.json({ error: "Search query is required." }, { status: 400 });
    }

    // 1. Tạo embedding cho câu truy vấn bằng Transformers.js (local, free)
    const pipe = await getEmbedder();
    const output = await pipe(query.trim(), {
      pooling: 'mean',
      normalize: true,
    });

    const queryEmbedding = Array.from(output.data);

    // 2. Gọi RPC function trên Supabase để tìm các ghi chú tương tự
    const { data, error } = await supabase.rpc('match_notes', {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
      filter_user_id: userId || null,
    });

    if (error) {
      console.error("Semantic search error:", error);
      return NextResponse.json({ 
        error: "Failed to search notes. Make sure you've run the semantic-search migration SQL." 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      results: data || [],
      query: query,
      count: data?.length || 0 
    });

  } catch (error: any) {
    console.error("Error in /api/search:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to process search request." 
    }, { status: 500 });
  }
}
