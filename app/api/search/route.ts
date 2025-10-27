import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';
import { createRequestLogger } from '@/lib/logger';

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
  const startTime = Date.now();
  const logger = createRequestLogger(req);
  
  try {
    const { query, userId, matchCount = 5, matchThreshold = 0.78 } = await req.json();
    
    logger.debug('Search request received', { 
      query: query?.substring(0, 50), 
      userId, 
      matchCount, 
      matchThreshold 
    });

    if (!query || !query.trim()) {
      logger.warn('Missing search query');
      return NextResponse.json({ error: "Search query is required." }, { status: 400 });
    }

    // 1. Tạo embedding cho câu truy vấn bằng Transformers.js (local, free)
    const embeddingStart = Date.now();
    const pipe = await getEmbedder();
    const output = await pipe(query.trim(), {
      pooling: 'mean',
      normalize: true,
    });

    const queryEmbedding = Array.from(output.data);
    const embeddingDuration = Date.now() - embeddingStart;
    
    logger.debug('Query embedding generated', undefined, { embeddingDuration });

    // 2. Gọi RPC function trên Supabase để tìm các ghi chú tương tự
    const searchStart = Date.now();
    const { data, error } = await supabase.rpc('match_notes', {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
      filter_user_id: userId || null,
    });
    const searchDuration = Date.now() - searchStart;

    if (error) {
      logger.error("Semantic search error", error as Error, { userId });
      return NextResponse.json({ 
        error: "Failed to search notes. Make sure you've run the semantic-search migration SQL." 
      }, { status: 500 });
    }

    const totalDuration = Date.now() - startTime;
    logger.info('Search completed successfully', undefined, { 
      resultsCount: data?.length || 0,
      embeddingDuration,
      searchDuration,
      totalDuration
    });
    
    logger.logResponse('POST', '/api/search', 200, totalDuration, { userId });

    return NextResponse.json({ 
      results: data || [],
      query: query,
      count: data?.length || 0 
    });

  } catch (error: any) {
    const totalDuration = Date.now() - startTime;
    logger.error("Error in /api/search", error);
    logger.logResponse('POST', '/api/search', 500, totalDuration);
    
    return NextResponse.json({ 
      error: error.message || "Failed to process search request." 
    }, { status: 500 });
  }
}
