"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type Note = {
  id: number;
  created_at: string;
  summary: string;
  persona: string;
};

export default function History() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotes = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('notes')
        .select('id, created_at, summary, persona')
        .order('created_at', { ascending: false }) // Lấy ghi chú mới nhất lên đầu
        .limit(10); // Giới hạn 10 ghi chú gần nhất

      if (error) {
        console.error("Error fetching notes:", error);
      } else {
        setNotes(data);
      }
      setLoading(false);
    };

    fetchNotes();
  }, []);

  if (loading) {
    return (
      <div className="mt-10">
        <h2 className="text-2xl font-bold mb-4">History</h2>
        <Skeleton className="w-full h-24 mb-4" />
        <Skeleton className="w-full h-24" />
      </div>
    );
  }
  
  return (
    <div className="mt-10">
      <h2 className="text-2xl font-bold mb-4">History</h2>
      <div className="space-y-4">
        {notes.length > 0 ? (
          notes.map(note => (
            <Card key={note.id}>
              <CardHeader>
                <CardTitle className="text-lg">{note.summary}</CardTitle>
                <p className="text-sm text-gray-500">
                  Created on {new Date(note.created_at).toLocaleDateString()}
                  {note.persona && ` using persona: "${note.persona}"`}
                </p>
              </CardHeader>
            </Card>
          ))
        ) : (
          <p className="text-gray-500">No notes saved yet.</p>
        )}
      </div>
    </div>
  );
}