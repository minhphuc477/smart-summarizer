import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabaseServer';
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import { createRequestLogger } from '@/lib/logger';

// Cache the embedding pipeline
let embedder: FeatureExtractionPipeline | null = null;

async function getEmbedder() {
  if (!embedder) {
    embedder = (await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')) as FeatureExtractionPipeline;
  }
  return embedder;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const logger = createRequestLogger(req);
  
  try {
  const { query, userId, folderId, matchCount = 5, matchThreshold = 0.78 } = await req.json();
    
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
      pooling: 'mean' as const,
      normalize: true,
    });

    const queryEmbedding = Array.from(output.data);
    const embeddingDuration = Date.now() - embeddingStart;
    
    logger.debug('Query embedding generated', undefined, { embeddingDuration });

    // 2. Gọi RPC function trên Supabase để tìm các ghi chú tương tự
    const searchStart = Date.now();
  const supabase = await getServerSupabase();
    const useFolderRpc = folderId !== null && folderId !== undefined;
    const procName = useFolderRpc ? 'match_notes_by_folder' : 'match_notes';
    const rpcArgs: Record<string, unknown> = {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
      filter_user_id: userId || null,
    };
    if (useFolderRpc) rpcArgs.filter_folder_id = folderId;

    const { data, error } = await supabase.rpc(procName, rpcArgs);
    const searchDuration = Date.now() - searchStart;

    if (error) {
      logger.error("Semantic search error", error as Error, { userId, procName });
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

    // Results from RPC (already folder-filtered when applicable)
    const results = (data || []);

    return NextResponse.json({ 
      results,
      query: query,
      count: results.length 
    });

  } catch (error: unknown) {
    const totalDuration = Date.now() - startTime;
    logger.error("Error in /api/search", error as Error);
    logger.logResponse('POST', '/api/search', 500, totalDuration);
    
    return NextResponse.json({ 
      error: (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string')
        ? (error as { message: string }).message
        : "Failed to process search request." 
    }, { status: 500 });
  }
}
