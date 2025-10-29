"use client";

import { useState, useEffect } from 'react';
import { supabase as defaultSupabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Trash2, FolderInput, Share2, Copy, Check, Edit, Download, Tag, X, ChevronDown, Star, Filter, Calendar, CheckSquare, Square } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Tag = {
  id: number;
  name: string;
};

type ActionItem = {
  task: string;
  datetime?: string | null;
};

type Note = {
  id: number;
  created_at: string;
  summary: string;
  persona: string;
  sentiment?: string;
  folder_id?: number;
  is_public?: boolean;
  is_pinned?: boolean;
  share_id?: string;
  original_notes?: string;
  takeaways?: string[];
  actions?: ActionItem[];
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
import { Textarea } from '@/components/ui/textarea';

type HistoryProps = {
  isGuest?: boolean;
  selectedFolderId?: number | null;
  userId?: string;
  supabaseClient?: SupabaseClient;
};

export default function History({ isGuest = false, selectedFolderId = null, userId, supabaseClient }: HistoryProps) {
  const supabase = supabaseClient ?? defaultSupabase;
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
  
  // Filter states
  const [sentimentFilter, setSentimentFilter] = useState<'positive' | 'neutral' | 'negative' | null>(null);
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | null>(null);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const PAGE_SIZE = 10;
  const [analyzingNoteId, setAnalyzingNoteId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [editNoteId, setEditNoteId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<{
    original_notes: string;
    summary: string;
    takeaways: string;
    actions: string;
  }>({ original_notes: '', summary: '', takeaways: '', actions: '' });
  const [tagNoteId, setTagNoteId] = useState<number | null>(null);
  const [newTagInput, setNewTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<{ id: number; name: string }[]>([]);
  
  // Bulk selection state
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<number>>(new Set());
  const [bulkActionMode, setBulkActionMode] = useState(false);

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

  // Helper function to check if note matches date filter
  const matchesDateFilter = (createdAt: string): boolean => {
    if (!dateFilter) return true;
    
    const noteDate = new Date(createdAt);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateFilter) {
      case 'today':
        return noteDate >= todayStart;
      case 'week':
        const weekAgo = new Date(todayStart);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return noteDate >= weekAgo;
      case 'month':
        const monthAgo = new Date(todayStart);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return noteDate >= monthAgo;
      default:
        return true;
    }
  };

  useEffect(() => {
    const fetchNotes = async () => {
      if (isGuest) {
        // Guest mode: fetch from localStorage
        setGuestNotes(guestMode.getGuestHistory());
        setLoading(false);
        setHasMore(false); // No pagination for guest mode
      } else {
        // Logged in: fetch from Supabase
        setLoading(true);
        try {
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
            is_pinned,
            share_id,
            original_notes,
            takeaways,
            actions,
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
            `, { count: 'exact' });

          // Apply optional folder filter, pagination, and then order
          const query = selectedFolderId !== null
            ? base.eq('folder_id', selectedFolderId)
            : base;
          
          // Apply ordering; use range when available (tests may mock without it)
          const ordered1 = query.order('is_pinned', { ascending: false });
          const canChainOrder = typeof (ordered1 as unknown as { order?: unknown }).order === 'function';
          const ordered = canChainOrder
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (ordered1 as any).order('created_at', { ascending: false })
            : ordered1;

          let data: unknown[] | null | undefined;
          let error: { message?: string } | null | undefined;
          let count: number | null | undefined;
          const maybeHasRange = typeof (ordered as unknown as { range?: unknown }).range === 'function';
          if (maybeHasRange) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const res = await (ordered as any).range(0, PAGE_SIZE - 1);
            data = res?.data;
            error = res?.error;
            count = res?.count;
          } else {
            const res = await ordered as unknown as { data?: unknown[]; error?: { message?: string } | null };
            data = res?.data;
            error = res?.error;
            count = data ? data.length : 0;
          }

          if (error) {
            console.error("Error fetching notes:", error);
          } else {
            setNotes((data || []) as unknown as Note[]);
            setHasMore((count || 0) > PAGE_SIZE);
            setPage(1);
          }
        } catch (e) {
          console.error('Error in fetchNotes:', e);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchNotes();
    // supabase is a stable dependency from the prop default and does not change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest, selectedFolderId]);

  // Load more notes (pagination)
  const loadMore = async () => {
    if (isGuest || !hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
  const nextPage = page + 1;
  const from = nextPage * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

    try {
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
          is_pinned,
          share_id,
          original_notes,
          takeaways,
          actions,
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
        `, { count: 'exact' });

      // Apply optional folder filter, pagination, and order
        const query = selectedFolderId !== null
        ? base.eq('folder_id', selectedFolderId)
        : base;
      
      // Execute query with ordering and optional range (support test mocks)
      const ordered1 = query.order('is_pinned', { ascending: false });
      const canChainOrder = typeof (ordered1 as unknown as { order?: unknown }).order === 'function';
      const ordered = canChainOrder
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (ordered1 as any).order('created_at', { ascending: false })
        : ordered1;

      let data: unknown[] | null | undefined;
      let error: { message?: string } | null | undefined;
      let count: number | null | undefined;
      const maybeHasRange = typeof (ordered as unknown as { range?: unknown }).range === 'function';
      if (maybeHasRange) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await (ordered as any).range(from, to);
        data = res?.data;
        error = res?.error;
        count = res?.count;
      } else {
        const res = await ordered as unknown as { data?: unknown[]; error?: { message?: string } | null };
        data = res?.data;
        error = res?.error;
        count = data ? data.length : 0;
      }

      if (error) {
        console.error("Error loading more notes:", error);
      } else {
  setNotes(prev => [...prev, ...(data || []) as unknown as Note[]]);
  setPage(nextPage);
  setHasMore(!!count && count > (to + 1));
      }
    } finally {
      setIsLoadingMore(false);
    }
  };

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
          is_pinned,
          share_id,
          original_notes,
          takeaways,
          actions,
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
        .order('is_pinned', { ascending: false })
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
        is_pinned,
        share_id,
        original_notes,
        takeaways,
        actions,
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
        setToast({ type: 'error', message: 'Analyze failed. Please try again.' });
        setTimeout(() => setToast(null), 3000);
        return;
      }
      await refreshOneNote(noteId);
      setToast({ type: 'success', message: 'Analysis complete. Tags & sentiment updated.' });
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      console.error('Analyze error:', e);
      setToast({ type: 'error', message: 'Analyze failed due to a network error.' });
      setTimeout(() => setToast(null), 3000);
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

  // Toggle pin/favorite
  const handleTogglePin = async (noteId: number, currentIsPinned: boolean) => {
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: !currentIsPinned }),
      });
      if (!res.ok) {
        setToast({ type: 'error', message: 'Failed to toggle pin' });
        setTimeout(() => setToast(null), 3000);
        return;
      }
      const { note } = await res.json();
      // Update note in list and re-sort to move pinned to top
      const updatedNotes = notes.map(n => n.id === noteId ? { ...n, is_pinned: note.is_pinned } : n);
      // Sort: pinned first, then by created_at
      updatedNotes.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setNotes(updatedNotes);
      setToast({ 
        type: 'success', 
        message: note.is_pinned ? 'Note pinned' : 'Note unpinned' 
      });
      setTimeout(() => setToast(null), 2000);
    } catch (e) {
      console.error('Error toggling pin:', e);
      setToast({ type: 'error', message: 'Failed to toggle pin' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Open edit dialog
  const handleOpenEdit = (note: Note) => {
    setEditNoteId(note.id);
    setEditFormData({
      original_notes: note.original_notes || '',
      summary: note.summary || '',
      takeaways: (note.takeaways || []).join('\n'),
      actions: (note.actions || []).map((a) => a.task || '').join('\n'),
    });
  };

  // Save edited note
  const handleSaveEdit = async () => {
    if (!editNoteId) return;
    try {
      const takeawaysArray = editFormData.takeaways.split('\n').filter(t => t.trim());
      const actionsArray = editFormData.actions.split('\n').filter(a => a.trim()).map(task => ({ task }));
      
      const res = await fetch(`/api/notes/${editNoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_notes: editFormData.original_notes,
          summary: editFormData.summary,
          takeaways: takeawaysArray,
          actions: actionsArray,
        }),
      });
      
      if (!res.ok) {
        setToast({ type: 'error', message: 'Failed to save changes' });
        setTimeout(() => setToast(null), 3000);
        return;
      }
      
      await refreshOneNote(editNoteId);
      setEditNoteId(null);
      setToast({ type: 'success', message: 'Note updated successfully' });
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      console.error('Edit error:', e);
      setToast({ type: 'error', message: 'Failed to save changes' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Export single note
  const handleExportNote = (note: Note, format: 'txt' | 'md') => {
    const takeawaysText = (note.takeaways || []).map((t, i) => `${i + 1}. ${t}`).join('\n');
    const actionsText = (note.actions || []).map((a, i) => `${i + 1}. ${a.task || ''}`).join('\n');
    
    let content = '';
    if (format === 'md') {
      content = `# ${note.summary}\n\n`;
      content += `**Created:** ${new Date(note.created_at).toLocaleString()}\n\n`;
      if (note.persona) content += `**Persona:** ${note.persona}\n\n`;
      if (note.original_notes) content += `## Original Notes\n\n${note.original_notes}\n\n`;
      content += `## Summary\n\n${note.summary}\n\n`;
      if (takeawaysText) content += `## Key Takeaways\n\n${takeawaysText}\n\n`;
      if (actionsText) content += `## Action Items\n\n${actionsText}\n\n`;
      if (note.note_tags && note.note_tags.length > 0) {
        content += `## Tags\n\n${note.note_tags.map(nt => `#${nt.tags.name}`).join(' ')}\n`;
      }
    } else {
      content = `${note.summary}\n\n`;
      content += `Created: ${new Date(note.created_at).toLocaleString()}\n`;
      if (note.persona) content += `Persona: ${note.persona}\n`;
      content += `\n---\n\n`;
      if (note.original_notes) content += `ORIGINAL NOTES:\n${note.original_notes}\n\n`;
      content += `SUMMARY:\n${note.summary}\n\n`;
      if (takeawaysText) content += `KEY TAKEAWAYS:\n${takeawaysText}\n\n`;
      if (actionsText) content += `ACTION ITEMS:\n${actionsText}\n\n`;
      if (note.note_tags && note.note_tags.length > 0) {
        content += `TAGS: ${note.note_tags.map(nt => nt.tags.name).join(', ')}\n`;
      }
    }
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `note-${note.id}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Fetch tag suggestions
  const fetchTagSuggestions = async (query: string) => {
    try {
      const res = await fetch(`/api/tags?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const { tags } = await res.json();
        setTagSuggestions(tags || []);
      }
    } catch (e) {
      console.error('Failed to fetch tags:', e);
    }
  };

  // Add tag to note
  const handleAddTag = async (noteId: number) => {
    if (!newTagInput.trim()) return;
    try {
      const res = await fetch(`/api/notes/${noteId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagName: newTagInput.trim() }),
      });
      
      if (!res.ok) {
        setToast({ type: 'error', message: 'Failed to add tag' });
        setTimeout(() => setToast(null), 3000);
        return;
      }
      
      await refreshOneNote(noteId);
      setNewTagInput('');
      setTagSuggestions([]);
      setToast({ type: 'success', message: 'Tag added' });
      setTimeout(() => setToast(null), 2000);
    } catch (e) {
      console.error('Add tag error:', e);
      setToast({ type: 'error', message: 'Failed to add tag' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Remove tag from note
  const handleRemoveTag = async (noteId: number, tagId: number) => {
    try {
      const res = await fetch(`/api/notes/${noteId}/tags?tagId=${tagId}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        setToast({ type: 'error', message: 'Failed to remove tag' });
        setTimeout(() => setToast(null), 3000);
        return;
      }
      
      await refreshOneNote(noteId);
      setToast({ type: 'success', message: 'Tag removed' });
      setTimeout(() => setToast(null), 2000);
    } catch (e) {
      console.error('Remove tag error:', e);
      setToast({ type: 'error', message: 'Failed to remove tag' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Bulk selection handlers
  const toggleNoteSelection = (noteId: number) => {
    const newSelection = new Set(selectedNoteIds);
    if (newSelection.has(noteId)) {
      newSelection.delete(noteId);
    } else {
      newSelection.add(noteId);
    }
    setSelectedNoteIds(newSelection);
  };

  const selectAllNotes = () => {
    const filteredNotes = notes.filter(n => {
      const q = filterQuery.trim().toLowerCase();
      if (q && !(
        n.summary.toLowerCase().includes(q) ||
        (n.persona || '').toLowerCase().includes(q) ||
        (n.note_tags || []).some(nt => (nt.tags?.name || '').toLowerCase().includes(q))
      )) return false;
      if (sentimentFilter && n.sentiment !== sentimentFilter) return false;
      if (!matchesDateFilter(n.created_at)) return false;
      if (selectedTagFilter && !(n.note_tags || []).some(nt => nt.tags?.name === selectedTagFilter)) return false;
      return true;
    });
    setSelectedNoteIds(new Set(filteredNotes.map(n => n.id)));
  };

  const deselectAllNotes = () => {
    setSelectedNoteIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedNoteIds.size === 0) return;
    
    if (!window.confirm(`Delete ${selectedNoteIds.size} note(s)?`)) return;

    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .in('id', Array.from(selectedNoteIds));

      if (error) throw error;

      setNotes(notes.filter(n => !selectedNoteIds.has(n.id)));
      setSelectedNoteIds(new Set());
      setBulkActionMode(false);
      setToast({ type: 'success', message: `${selectedNoteIds.size} note(s) deleted` });
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      console.error('Bulk delete error:', e);
      setToast({ type: 'error', message: 'Failed to delete notes' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleBulkMove = async (targetFolderId: string) => {
    if (selectedNoteIds.size === 0) return;

    try {
      const folderId = targetFolderId === 'none' ? null : parseInt(targetFolderId);
      
      const { error } = await supabase
        .from('notes')
        .update({ folder_id: folderId })
        .in('id', Array.from(selectedNoteIds));

      if (error) throw error;

      // Update the notes in state with new folder info
      const { data: foldersData } = await supabase
        .from('folders')
        .select('id, name, color');
      
      const folderMap = new Map((foldersData || []).map(f => [f.id, f]));
      
      setNotes(notes.map(n => {
        if (selectedNoteIds.has(n.id)) {
          return {
            ...n,
            folder_id: folderId ?? undefined,
            folders: folderId ? folderMap.get(folderId) : undefined
          };
        }
        return n;
      }));
      
      setSelectedNoteIds(new Set());
      setBulkActionMode(false);
      setToast({ type: 'success', message: `${selectedNoteIds.size} note(s) moved` });
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      console.error('Bulk move error:', e);
      setToast({ type: 'error', message: 'Failed to move notes' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleBulkExport = () => {
    if (selectedNoteIds.size === 0) return;

    const selectedNotes = notes.filter(n => selectedNoteIds.has(n.id));
    let exportContent = '';

    selectedNotes.forEach((note, index) => {
      if (index > 0) exportContent += '\n\n---\n\n';
      exportContent += `# ${note.summary}\n\n`;
      exportContent += `Created: ${new Date(note.created_at).toLocaleString()}\n`;
      if (note.persona) exportContent += `Persona: ${note.persona}\n`;
      if (note.sentiment) exportContent += `Sentiment: ${note.sentiment}\n`;
      exportContent += `\n`;
      if (note.original_notes) exportContent += `## Original Notes\n${note.original_notes}\n\n`;
      if (note.takeaways && Array.isArray(note.takeaways)) {
        exportContent += `## Takeaways\n`;
        note.takeaways.forEach(t => exportContent += `- ${t}\n`);
        exportContent += `\n`;
      }
      if (note.actions && Array.isArray(note.actions)) {
        exportContent += `## Actions\n`;
        note.actions.forEach((a: ActionItem) => {
          exportContent += `- ${a.task}`;
          if (a.datetime) exportContent += ` (${a.datetime})`;
          exportContent += `\n`;
        });
      }
    });

    const blob = new Blob([exportContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes-export-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setToast({ type: 'success', message: `${selectedNoteIds.size} note(s) exported` });
    setTimeout(() => setToast(null), 3000);
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
    <div className="mt-10 relative">
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
        
        {/* Filter Bar */}
        <div className="flex flex-wrap gap-2">
          {/* Sentiment Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Sentiment: {sentimentFilter ? (sentimentFilter === 'positive' ? '😊 Positive' : sentimentFilter === 'negative' ? '😞 Negative' : '😐 Neutral') : 'All'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSentimentFilter(null)}>
                All Sentiments
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSentimentFilter('positive')}>
                😊 Positive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSentimentFilter('neutral')}>
                😐 Neutral
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSentimentFilter('negative')}>
                😞 Negative
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Date Range Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                Date: {dateFilter === 'today' ? 'Today' : dateFilter === 'week' ? 'Last 7 days' : dateFilter === 'month' ? 'Last month' : 'All time'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setDateFilter(null)}>
                All time
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateFilter('today')}>
                Today
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateFilter('week')}>
                Last 7 days
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateFilter('month')}>
                Last month
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Selected Tag Filter Display */}
          {selectedTagFilter && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSelectedTagFilter(null)}
              className="gap-2"
            >
              Tag: {selectedTagFilter}
              <X className="h-3 w-3" />
            </Button>
          )}
          
          {/* Clear All Filters */}
          {(sentimentFilter || dateFilter || selectedTagFilter) && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setSentimentFilter(null);
                setDateFilter(null);
                setSelectedTagFilter(null);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
        
        {/* Bulk Actions Bar (Logged in only) */}
        {!isGuest && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Button
              variant={bulkActionMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setBulkActionMode(!bulkActionMode);
                if (bulkActionMode) setSelectedNoteIds(new Set());
              }}
            >
              {bulkActionMode ? 'Exit Bulk Mode' : 'Select Multiple'}
            </Button>
            
            {bulkActionMode && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllNotes}
                  disabled={notes.length === 0}
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deselectAllNotes}
                  disabled={selectedNoteIds.size === 0}
                >
                  Deselect All
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedNoteIds.size} selected
                </span>
                
                {selectedNoteIds.size > 0 && (
                  <>
                    <div className="h-4 w-px bg-border" />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDelete}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete ({selectedNoteIds.size})
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <FolderInput className="h-4 w-4 mr-2" />
                          Move to...
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleBulkMove('none')}>
                          No Folder
                        </DropdownMenuItem>
                        {folders.map(folder => (
                          <DropdownMenuItem key={folder.id} onClick={() => handleBulkMove(folder.id.toString())}>
                            <span style={{ color: folder.color }}>●</span> {folder.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkExport}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export ({selectedNoteIds.size})
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {isGuest ? (
          // Guest mode
          (guestNotes.filter(n => {
            // Keyword filter
            const q = filterQuery.trim().toLowerCase();
            if (q && !(
              n.summary.toLowerCase().includes(q) ||
              (n.persona || '').toLowerCase().includes(q) ||
              (n.tags || []).some(t => (t || '').toLowerCase().includes(q))
            )) return false;
            
            // Sentiment filter
            if (sentimentFilter && n.sentiment !== sentimentFilter) return false;
            
            // Date filter
            if (!matchesDateFilter(n.created_at)) return false;
            
            // Tag filter
            if (selectedTagFilter && !(n.tags || []).includes(selectedTagFilter)) return false;
            
            return true;
          }).length > 0) ? (
            guestNotes.filter(n => {
              // Keyword filter
              const q = filterQuery.trim().toLowerCase();
              if (q && !(
                n.summary.toLowerCase().includes(q) ||
                (n.persona || '').toLowerCase().includes(q) ||
                (n.tags || []).some(t => (t || '').toLowerCase().includes(q))
              )) return false;
              
              // Sentiment filter
              if (sentimentFilter && n.sentiment !== sentimentFilter) return false;
              
              // Date filter
              if (!matchesDateFilter(n.created_at)) return false;
              
              // Tag filter
              if (selectedTagFilter && !(n.tags || []).includes(selectedTagFilter)) return false;
              
              return true;
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
                          onClick={() => setSelectedTagFilter(tag)}
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                            selectedTagFilter === tag
                              ? 'bg-blue-600 text-white'
                              : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800'
                          }`}
                          title={`Filter by ${tag}`}
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
            // Keyword filter
            const q = filterQuery.trim().toLowerCase();
            if (q && !(
              n.summary.toLowerCase().includes(q) ||
              (n.persona || '').toLowerCase().includes(q) ||
              (n.note_tags || []).some(nt => (nt.tags?.name || '').toLowerCase().includes(q))
            )) return false;
            
            // Sentiment filter
            if (sentimentFilter && n.sentiment !== sentimentFilter) return false;
            
            // Date filter
            if (!matchesDateFilter(n.created_at)) return false;
            
            // Tag filter
            if (selectedTagFilter && !(n.note_tags || []).some(nt => nt.tags?.name === selectedTagFilter)) return false;
            
            return true;
          }).length > 0) ? (
            notes.filter(n => {
              // Keyword filter
              const q = filterQuery.trim().toLowerCase();
              if (q && !(
                n.summary.toLowerCase().includes(q) ||
                (n.persona || '').toLowerCase().includes(q) ||
                (n.note_tags || []).some(nt => (nt.tags?.name || '').toLowerCase().includes(q))
              )) return false;
              
              // Sentiment filter
              if (sentimentFilter && n.sentiment !== sentimentFilter) return false;
              
              // Date filter
              if (!matchesDateFilter(n.created_at)) return false;
              
              // Tag filter
              if (selectedTagFilter && !(n.note_tags || []).some(nt => nt.tags?.name === selectedTagFilter)) return false;
              
              return true;
            }).map(note => (
              <Card 
                key={note.id} 
                className={bulkActionMode && selectedNoteIds.has(note.id) ? 'ring-2 ring-primary' : ''}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('noteId', String(note.id));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                style={{ cursor: 'grab' }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {bulkActionMode && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleNoteSelection(note.id)}
                          aria-label={selectedNoteIds.has(note.id) ? 'Deselect note' : 'Select note'}
                        >
                          {selectedNoteIds.has(note.id) ? (
                            <CheckSquare className="h-5 w-5 text-primary" />
                          ) : (
                            <Square className="h-5 w-5" />
                          )}
                        </Button>
                      )}
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
                        onClick={() => setTagNoteId(note.id)}
                        title="Manage tags"
                        aria-label="Manage tags"
                      >
                        <Tag className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(note)}
                        title="Edit note"
                        aria-label="Edit note"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const menu = document.createElement('div');
                          menu.style.cssText = 'position:fixed;background:white;border:1px solid #ccc;border-radius:4px;padding:8px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.15)';
                          menu.innerHTML = `
                            <button onclick="this.parentElement.remove();window.exportNote(${note.id},'txt')" style="display:block;width:100%;padding:8px;text-align:left;border:none;background:none;cursor:pointer">Export as .txt</button>
                            <button onclick="this.parentElement.remove();window.exportNote(${note.id},'md')" style="display:block;width:100%;padding:8px;text-align:left;border:none;background:none;cursor:pointer">Export as .md</button>
                          `;
                          document.body.appendChild(menu);
                          const rect = (event?.target as HTMLElement)?.getBoundingClientRect();
                          if (rect) {
                            menu.style.left = rect.left + 'px';
                            menu.style.top = (rect.bottom + 4) + 'px';
                          }
                            (window as Window & { exportNote?: (id: number, format: 'txt' | 'md') => void }).exportNote = (id: number, format: 'txt' | 'md') => handleExportNote(note, format);
                        }}
                        title="Export note"
                        aria-label="Export note"
                      >
                        <Download className="h-4 w-4" />
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
                        variant={note.is_pinned ? "default" : "ghost"}
                        size="icon"
                        onClick={() => handleTogglePin(note.id, note.is_pinned || false)}
                        title={note.is_pinned ? "Unpin note" : "Pin note"}
                        aria-label={note.is_pinned ? "Unpin note" : "Pin note"}
                        className={note.is_pinned ? "text-yellow-500" : ""}
                      >
                        <Star className={`h-4 w-4 ${note.is_pinned ? 'fill-current' : ''}`} />
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
                          onClick={() => setSelectedTagFilter(noteTag.tags.name)}
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                            selectedTagFilter === noteTag.tags.name
                              ? 'bg-blue-600 text-white'
                              : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800'
                          }`}
                          title={`Filter by ${noteTag.tags.name}`}
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
        
        {/* Load More Button */}
        {!isGuest && !loading && hasMore && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={loadMore}
              disabled={isLoadingMore}
              className="gap-2"
            >
              {isLoadingMore ? (
                'Loading...'
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Load More
                </>
              )}
            </Button>
          </div>
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
             Search your notes by meaning. Try queries like &ldquo;urgent tasks&rdquo; or &ldquo;meeting with Alice&rdquo;.
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

      {/* Edit Note Dialog */}
      <Dialog open={editNoteId !== null} onOpenChange={() => setEditNoteId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
            <DialogDescription>
              Make changes to your note content
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">Original Notes</label>
              <Textarea
                value={editFormData.original_notes}
                onChange={(e) => setEditFormData({ ...editFormData, original_notes: e.target.value })}
                className="mt-1 min-h-[100px]"
                placeholder="Your original notes..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Summary</label>
              <Textarea
                value={editFormData.summary}
                onChange={(e) => setEditFormData({ ...editFormData, summary: e.target.value })}
                className="mt-1 min-h-[80px]"
                placeholder="Summary..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Key Takeaways (one per line)</label>
              <Textarea
                value={editFormData.takeaways}
                onChange={(e) => setEditFormData({ ...editFormData, takeaways: e.target.value })}
                className="mt-1 min-h-[100px]"
                placeholder="Takeaway 1&#10;Takeaway 2&#10;..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Action Items (one per line)</label>
              <Textarea
                value={editFormData.actions}
                onChange={(e) => setEditFormData({ ...editFormData, actions: e.target.value })}
                className="mt-1 min-h-[100px]"
                placeholder="Action 1&#10;Action 2&#10;..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditNoteId(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Management Dialog */}
      <Dialog open={tagNoteId !== null} onOpenChange={() => { setTagNoteId(null); setNewTagInput(''); setTagSuggestions([]); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Tags</DialogTitle>
            <DialogDescription>
              Add or remove tags for this note
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Existing tags */}
            {tagNoteId && notes.find(n => n.id === tagNoteId)?.note_tags && (
              <div>
                <label className="text-sm font-medium">Current Tags</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(notes.find(n => n.id === tagNoteId)?.note_tags || []).map((nt) => (
                    <span
                      key={nt.tags.id}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800"
                    >
                      {nt.tags.name}
                      <button
                        onClick={() => handleRemoveTag(tagNoteId!, nt.tags.id)}
                        className="hover:text-red-600 dark:hover:text-red-400"
                        aria-label={`Remove tag ${nt.tags.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {/* Add new tag */}
            <div>
              <label className="text-sm font-medium">Add New Tag</label>
              <div className="relative mt-1">
                <Input
                  value={newTagInput}
                  onChange={(e) => {
                    setNewTagInput(e.target.value);
                    if (e.target.value.trim()) {
                      fetchTagSuggestions(e.target.value);
                    } else {
                      setTagSuggestions([]);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTagInput.trim() && tagNoteId) {
                      e.preventDefault();
                      handleAddTag(tagNoteId);
                    }
                  }}
                  placeholder="Type tag name..."
                  className="w-full"
                />
                {tagSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-40 overflow-auto">
                    {tagSuggestions.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => {
                          setNewTagInput(tag.name);
                          setTagSuggestions([]);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                onClick={() => tagNoteId && handleAddTag(tagNoteId)}
                className="mt-2 w-full"
                disabled={!newTagInput.trim()}
              >
                Add Tag
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTagNoteId(null); setNewTagInput(''); setTagSuggestions([]); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 ${
            toast.type === 'success'
              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

