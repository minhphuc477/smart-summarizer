"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Trash2, FolderInput, Share2, Copy, Check } from 'lucide-react';
import * as guestMode from '@/lib/guestMode';
import type { GuestNote } from '@/lib/guestMode';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Tag = {
  id: number;
  name: string;
};

type Note = {
  id: number;
  created_at: string;
  summary: string;
  persona: string;
  sentiment?: string;
  folder_id?: number;
  is_public?: boolean;
  share_id?: string;
  folders?: {
    id: number;
    name: string;
    color: string;
  };
  note_tags?: {
    tags: Tag;
  }[];
};

type Folder = {
  id: number;
  name: string;
  color: string;
};

import SearchBar from './SearchBar';
import { Input } from '@/components/ui/input';

type HistoryProps = {
  isGuest?: boolean;
  selectedFolderId?: number | null;
  userId?: string;
};

export default function History({ isGuest = false, selectedFolderId = null, userId }: HistoryProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [guestNotes, setGuestNotes] = useState<GuestNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [moveNoteId, setMoveNoteId] = useState<number | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [copiedNoteId, setCopiedNoteId] = useState<number | null>(null);
  const [deleteNoteId, setDeleteNoteId] = useState<number | string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInFolder, setSearchInFolder] = useState(false);
  const [analyzingNoteId, setAnalyzingNoteId] = useState<number | null>(null);

  const getSentimentEmoji = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return '😊';
      case 'negative':
        return '😞';
      case 'neutral':
      default:
        return '😐';
    }
  };

  useEffect(() => {
    const fetchNotes = async () => {
      if (isGuest) {
        // Guest mode: fetch from localStorage
  setGuestNotes(guestMode.getGuestHistory());
        setLoading(false);
      } else {
        // Logged in: fetch from Supabase
        setLoading(true);
        
        // Fetch folders
        const { data: foldersData } = await supabase
          .from('folders')
          .select('id, name, color')
          .order('name');
        setFolders(foldersData || []);

        // Build base select
        const base = supabase
          .from('notes')
          .select(`
            id, 
            created_at, 
            summary, 
            persona, 
            sentiment,
            folder_id,
            is_public,
            share_id,
            folders (
              id,
              name,
              color
            ),
            note_tags (
              tags (
                id,
                name
              )
            )
          `);

        // Apply optional folder filter and then order
        const query = selectedFolderId !== null
          ? base.eq('folder_id', selectedFolderId).order('created_at', { ascending: false })
          : base.order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) {
          console.error("Error fetching notes:", error);
        } else {
          setNotes((data || []) as unknown as Note[]);
        }
        setLoading(false);
      }
    };

    fetchNotes();
  }, [isGuest, selectedFolderId]);

  // Delete note (invoked after confirmation)
  const confirmDelete = async () => {
    if (!deleteNoteId && deleteNoteId !== 0) return;
    const id = deleteNoteId as number | string;
    try {
      if (isGuest) {
  guestMode.deleteGuestNote(id as string);
  setGuestNotes(guestMode.getGuestHistory());
      } else {
        const { error } = await supabase
          .from('notes')
          .delete()
          .eq('id', id);
        if (!error) {
          setNotes(notes.filter(n => n.id !== id));
        }
      }
    } finally {
      setDeleteNoteId(null);
    }
  };

  // Move note to folder
  const handleMoveToFolder = async () => {
    if (!moveNoteId || !selectedFolder) return;

    const folderId = selectedFolder === "none" ? null : parseInt(selectedFolder);

    const { error } = await supabase
      .from('notes')
      .update({ folder_id: folderId })
      .eq('id', moveNoteId);

    if (!error) {
      // Refresh notes (left joins to include untagged notes)
      const { data } = await supabase
        .from('notes')
        .select(`
          id, 
          created_at, 
          summary, 
          persona, 
          sentiment,
          folder_id,
          is_public,
          share_id,
          folders (
            id,
            name,
            color
          ),
          note_tags (
            tags (
              id,
              name
            )
          )
        `)
  .order('created_at', { ascending: false });

      setNotes((data || []) as unknown as Note[]);
      setMoveNoteId(null);
      setSelectedFolder("");
    }
  };

  // Refresh a single note with relations
  const refreshOneNote = async (noteId: number) => {
    const { data, error } = await supabase
      .from('notes')
      .select(`
        id, 
        created_at, 
        summary, 
        persona, 
        sentiment,
        folder_id,
        is_public,
        share_id,
        folders (
          id,
          name,
          color
        ),
        note_tags (
          tags (
            id,
            name
          )
        )
      `)
      .eq('id', noteId)
      .single();
    if (!error && data) {
      setNotes(prev => prev.map(n => (n.id === noteId ? (data as unknown as Note) : n)));
    }
  };

  // Analyze note to regenerate tags & sentiment
  const handleAnalyze = async (noteId: number) => {
    try {
      setAnalyzingNoteId(noteId);
      const res = await fetch(`/api/notes/${noteId}/analyze`, { method: 'POST' });
      if (!res.ok) {
        console.error('Failed to analyze note');
        return;
      }
      await refreshOneNote(noteId);
    } catch (e) {
      console.error('Analyze error:', e);
    } finally {
      setAnalyzingNoteId(null);
    }
  };

  // Toggle public sharing
  const handleToggleShare = async (noteId: number, currentIsPublic: boolean) => {
    try {
      const res = await fetch(`/api/notes/${noteId}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: !currentIsPublic }),
      });
      if (!res.ok) {
        console.error('Failed to toggle share');
        return;
      }
      const { note } = await res.json();
      setNotes(notes.map(n => n.id === noteId ? { ...n, is_public: note.is_public, share_id: note.share_id } : n));
    } catch (e) {
      console.error('Error toggling share:', e);
    }
  };

  // Copy share link
  const handleCopyShareLink = async (noteId: number, shareId: string) => {
    const shareUrl = `${window.location.origin}/share/${shareId}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopiedNoteId(noteId);
    setTimeout(() => setCopiedNoteId(null), 2000);
  };

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
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-2xl font-bold text-foreground">
          History{selectedFolderId !== null && !isGuest ? ' (Filtered)' : ''}
        </h2>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filter by keyword..."
            value={filterQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterQuery(e.target.value)}
            className="w-full sm:w-64"
          />
          {!isGuest && userId && (
            <Button variant="outline" onClick={() => setIsSearchOpen(true)} aria-label="Open semantic search">
              Semantic Search
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-4">
        {isGuest ? (
          // Guest mode
          (guestNotes.filter(n => {
            const q = filterQuery.trim().toLowerCase();
            if (!q) return true;
            return (
              n.summary.toLowerCase().includes(q) ||
              (n.persona || '').toLowerCase().includes(q) ||
              (n.tags || []).some(t => (t || '').toLowerCase().includes(q))
            );
          }).length > 0) ? (
            guestNotes.filter(n => {
              const q = filterQuery.trim().toLowerCase();
              if (!q) return true;
              return (
                n.summary.toLowerCase().includes(q) ||
                (n.persona || '').toLowerCase().includes(q) ||
                (n.tags || []).some(t => (t || '').toLowerCase().includes(q))
              );
            }).map(note => (
              <Card key={note.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{note.summary}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Created on {new Date(note.created_at).toLocaleDateString()}
                        {note.persona && ` using persona: "${note.persona}"`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {note.sentiment && (
                        <span className="text-2xl" title={note.sentiment}>
                          {getSentimentEmoji(note.sentiment)}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteNoteId(note.id)}
                        aria-label="Delete note"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Tags */}
                  {note.tags && note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {note.tags.map((tag, index) => (
                        <span
                          key={`${note.id}-tag-${index}`}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </CardHeader>
              </Card>
            ))
          ) : (
            <p className="text-muted-foreground">No notes yet.</p>
          )
        ) : (
          // Logged in mode
          (notes.filter(n => {
            const q = filterQuery.trim().toLowerCase();
            if (!q) return true;
            return (
              n.summary.toLowerCase().includes(q) ||
              (n.persona || '').toLowerCase().includes(q) ||
              (n.note_tags || []).some(nt => (nt.tags?.name || '').toLowerCase().includes(q))
            );
          }).length > 0) ? (
            notes.filter(n => {
              const q = filterQuery.trim().toLowerCase();
              if (!q) return true;
              return (
                n.summary.toLowerCase().includes(q) ||
                (n.persona || '').toLowerCase().includes(q) ||
                (n.note_tags || []).some(nt => (nt.tags?.name || '').toLowerCase().includes(q))
              );
            }).map(note => (
              <Card key={note.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg">{note.summary}</CardTitle>
                        {note.folders && (
                          <span
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                            style={{
                              backgroundColor: note.folders.color + '20',
                              color: note.folders.color,
                              border: `1px solid ${note.folders.color}40`
                            }}
                          >
                            {note.folders.name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Created on {new Date(note.created_at).toLocaleDateString()}
                        {note.persona && ` using persona: "${note.persona}"`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {note.sentiment && (
                        <span className="text-2xl" title={note.sentiment}>
                          {getSentimentEmoji(note.sentiment)}
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAnalyze(note.id)}
                        disabled={analyzingNoteId === note.id}
                        aria-label="Analyze note"
                        title="Regenerate tags and sentiment"
                      >
                        {analyzingNoteId === note.id ? 'Analyzing…' : 'Analyze'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setMoveNoteId(note.id);
                          setSelectedFolder(note.folder_id?.toString() || "none");
                        }}
                        title="Move to folder"
                        aria-label="Move to folder"
                      >
                        <FolderInput className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={note.is_public ? "default" : "ghost"}
                        size="icon"
                        onClick={() => handleToggleShare(note.id, note.is_public || false)}
                        title={note.is_public ? "Make private" : "Make public"}
                        aria-label={note.is_public ? "Make private" : "Make public"}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      {note.is_public && (
                        <span className="text-xs font-medium text-green-600 dark:text-green-400 ml-1">Public</span>
                      )}
                      {note.is_public && note.share_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopyShareLink(note.id, note.share_id!)}
                          title="Copy share link"
                          aria-label="Copy share link"
                        >
                          {copiedNoteId === note.id ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteNoteId(note.id)}
                        aria-label="Delete note"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Tags */}
                  {note.note_tags && note.note_tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {note.note_tags.map((noteTag, index) => (
                        <span
                          key={`${note.id}-tag-${index}`}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                        >
                          {noteTag.tags.name}
                        </span>
                      ))}
                    </div>
                  )}
                </CardHeader>
              </Card>
            ))
          ) : (
            <p className="text-muted-foreground">No notes yet.</p>
          )
        )}
      </div>

      {/* Move to Folder Dialog */}
      <Dialog open={moveNoteId !== null} onOpenChange={() => setMoveNoteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to Folder</DialogTitle>
            <DialogDescription>
              Choose a folder for this note
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedFolder} onValueChange={setSelectedFolder}>
            <SelectTrigger>
              <SelectValue placeholder="Select folder..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">📂 No Folder</SelectItem>
              {folders.map(folder => (
                <SelectItem key={folder.id} value={folder.id.toString()}>
                  <span style={{ color: folder.color }}>📁</span> {folder.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveNoteId(null)}>
              Cancel
            </Button>
            <Button onClick={handleMoveToFolder}>
              Move Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteNoteId !== null} onOpenChange={() => setDeleteNoteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Are you sure you want to delete this note?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteNoteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Semantic Search Dialog */}
      {!isGuest && userId && (
        <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Semantic Search</DialogTitle>
              <DialogDescription>
                Search your notes by meaning. Try queries like "urgent tasks" or "meeting with Alice".
              </DialogDescription>
            </DialogHeader>
            <div className="pt-2 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  id="search-in-folder"
                  type="checkbox"
                  checked={searchInFolder}
                  onChange={(e) => setSearchInFolder(e.target.checked)}
                />
                <label htmlFor="search-in-folder" className="text-sm">
                  Search in selected folder{selectedFolderId != null ? ` (#${selectedFolderId})` : ''}
                </label>
              </div>
              <SearchBar userId={userId} folderId={searchInFolder ? selectedFolderId ?? null : null} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}