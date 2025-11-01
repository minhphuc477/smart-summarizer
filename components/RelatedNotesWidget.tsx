"use client";

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight } from 'lucide-react';

type RelatedNote = {
  id: number;
  summary: string | null;
  original_notes: string | null;
  persona: string | null;
  created_at: string;
  similarity: number;
};

export default function RelatedNotesWidget({ noteId, onOpenNote }: { noteId: number; onOpenNote?: (id: number) => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<RelatedNote[]>([]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/notes/${noteId}/suggestions?matchCount=5`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (isMounted) {
          setNotes(data.results || []);
        }
      })
      .catch((e) => {
        if (isMounted) setError(e.message || 'Failed to load suggestions');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [noteId]);

  if (loading) {
    return (
      <div className="space-y-2" aria-label="Related notes loading">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-muted-foreground">Could not load related notes.</p>;
  }

  if (!notes.length) {
    return <p className="text-sm text-muted-foreground">No related notes found.</p>;
  }

  return (
    <div className="space-y-2" aria-label="Related notes">
      <h4 className="text-sm font-medium">Related Notes</h4>
      {notes.map((n) => (
        <Card key={n.id} className="p-3">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{new Date(n.created_at).toLocaleString()}</p>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {n.summary || n.original_notes || 'No preview'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Similarity: {(n.similarity * 100).toFixed(0)}%</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onOpenNote?.(n.id)} aria-label={`Open note ${n.id}`}>
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
