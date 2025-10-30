"use client";

import { useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, X, ExternalLink, Copy, Check, Share2, Loader2, Trash2 } from "lucide-react";
import { toast } from 'sonner';
import { useKeyboardShortcuts } from '@/lib/useKeyboardShortcuts';
import { EmptyState } from '@/components/EmptyState';

type SearchResult = {
  id: number;
  summary: string;
  original_notes: string;
  persona: string;
  created_at: string;
  similarity: number;
  sentiment?: 'positive' | 'neutral' | 'negative' | null;
};

type SearchBarProps = {
  userId: string;
  folderId?: number | null;
};

export default function SearchBar({ userId, folderId = null }: SearchBarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('recent_searches');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
    } catch {
      return [];
    }
  });
  // Debounce timer
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Quick action states
  const [copiedSummaryId, setCopiedSummaryId] = useState<number | null>(null);
  const [sharingId, setSharingId] = useState<number | null>(null);
  const [copiedShareId, setCopiedShareId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    setError(null);
    setHasSearched(true);
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          userId: userId,
          folderId: folderId,
          matchCount: 5,
          matchThreshold: 0.75
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }
      setSearchResults(data.results || []);
      // Save recent search
      try {
        const next = [query, ...recentSearches.filter(q => q !== query)].slice(0, 5);
        setRecentSearches(next);
        localStorage.setItem('recent_searches', JSON.stringify(next));
      } catch {}
    } catch (err: unknown) {
      console.error('Search error:', err);
      const message = (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' && err.message !== 'Network error')
        ? err.message
        : 'Failed to search. Please try again.';
      setError(message);
      toast.error(message);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search-as-you-type
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (value.trim()) {
      debounceTimer.current = setTimeout(() => {
        handleSearch(value);
      }, 400);
    } else {
      setSearchResults([]);
      setHasSearched(false);
      setError(null);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
    setError(null);
  };

  // Keyboard shortcuts: Ctrl+K to focus search, Escape to clear
  const shortcuts = useMemo(() => [
    {
      key: 'k',
      ctrl: true,
      callback: () => {
        inputRef.current?.focus();
      },
      description: 'Focus search',
    },
    {
      key: 'Escape',
      callback: () => {
        if (document.activeElement === inputRef.current) {
          clearSearch();
          inputRef.current?.blur();
        }
      },
      description: 'Clear search',
    },
  ], []);
  useKeyboardShortcuts(shortcuts);

  // Quick action handlers
  const openInCanvas = (id: number) => {
    // Stash a minimal draft so Canvas opens meaningfully when no nodes exist
    try {
      const draft = { title: 'Summary Canvas', nodes: [], edges: [] };
      sessionStorage.setItem('canvasDraft', JSON.stringify(draft));
    } catch {}
    router.push(`/canvas/${id}`);
  };

  const copySummary = async (id: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummaryId(id);
      setTimeout(() => setCopiedSummaryId(null), 1500);
      toast.success('Summary copied to clipboard');
    } catch (e) {
      console.error('Copy failed', e);
      toast.error('Failed to copy');
    }
  };

  const shareAndCopyLink = async (id: number) => {
    try {
      setSharingId(id);
      const res = await fetch(`/api/notes/${id}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to enable sharing');

      const shareId = data?.note?.share_id;
      if (!shareId) throw new Error('No share_id returned');
      const url = `${window.location.origin}/share/${shareId}`;
      await navigator.clipboard.writeText(url);
      setCopiedShareId(id);
      setTimeout(() => setCopiedShareId(null), 1500);
      toast.success('Share link copied to clipboard');
    } catch (e) {
      console.error('Share link error', e);
      setError('Failed to create share link');
      setTimeout(() => setError(null), 2000);
      toast.error('Failed to create share link');
    } finally {
      setSharingId(null);
    }
  };

  const deleteNote = async (id: number) => {
    if (!window.confirm('Delete this note? This action cannot be undone.')) return;

    try {
      setDeletingId(id);
      const res = await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete note');
      }

      // Remove from search results
      setSearchResults(prev => prev.filter(r => r.id !== id));
      toast.success('Note deleted');
    } catch (e) {
      console.error('Delete error', e);
      setError('Failed to delete note');
      setTimeout(() => setError(null), 2000);
      toast.error('Failed to delete note');
    } finally {
      setDeletingId(null);
    }
  };

  // Highlight matched query terms in text (simple keyword-based, case-insensitive)
  const highlightText = (text: string) => {
    const q = searchQuery.trim();
    if (!q) return text;
    try {
      // Use words >= 3 chars to avoid noisy highlighting
      const words = Array.from(new Set(q.split(/\s+/).filter(w => w.length >= 3)));
      const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const pattern = escaped.length ? `(${escaped.join('|')})` : `(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`;
      const re = new RegExp(pattern, 'ig');
      const parts = text.split(re);
      // Build a quick lookup for matches
      const matchSet = new Set(escaped.map(w => w.toLowerCase()));
      return parts.map((part, i) => {
        if (!part) return null; // skip empty leading/trailing segments
        if (matchSet.has(part.toLowerCase())) {
          return (
            <mark key={i} className="bg-yellow-200 dark:bg-yellow-600 text-inherit px-0.5 rounded-sm">{part}</mark>
          );
        }
        // Return plain text to preserve contiguous textContent for tests and a11y
        return part;
      });
    } catch {
      return text;
    }
  };

  return (
    <div className="mt-10 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Search className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-2xl font-bold text-foreground">Semantic Search</h2>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4">
        Search your notes by meaning, not just keywords. Try asking questions like &quot;What meetings did I have?&quot; or &quot;Show me urgent tasks&quot;
      </p>

      {/* Search Input */}
  <form onSubmit={(e) => { e.preventDefault(); if (debounceTimer.current) clearTimeout(debounceTimer.current); handleSearch(searchQuery); }} className="relative">
        <Input
          type="text"
          placeholder="Search your notes by meaning..."
          className="w-full pr-20"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setTimeout(() => setIsInputFocused(false), 100)}
          ref={inputRef}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={clearSearch}
              className="h-8 w-8"
              aria-label="X"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={isSearching || !searchQuery.trim()}
            className="h-8"
          >
            {isSearching ? "Searching..." : "Search"}
          </Button>
        </div>
      </form>

      {/* Recent Searches */}
      {isInputFocused && !searchQuery.trim() && recentSearches.length > 0 && (
        <div className="relative">
          <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-900 border border-border rounded-md shadow-md">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-xs text-muted-foreground">Recent searches</span>
              <button
                className="text-xs text-blue-600 hover:underline"
                onClick={() => {
                  setRecentSearches([]);
                  try { localStorage.removeItem('recent_searches'); } catch {}
                }}
              >
                Clear
              </button>
            </div>
            <ul className="max-h-48 overflow-auto">
              {recentSearches.map((q, idx) => (
                <li key={`${q}-${idx}`}>
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                    onClick={() => {
                      setSearchQuery(q);
                      handleSearch(q);
                    }}
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isSearching && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {/* Search Results */}
      {!isSearching && hasSearched && (
        <div className="space-y-3">
          {searchResults.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                Found {searchResults.length} relevant note{searchResults.length !== 1 ? 's' : ''}
              </p>
              {searchResults.map((result) => (
                <Card key={result.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base font-semibold">
                        {result.summary}
                      </CardTitle>
                      <span className="text-xs font-medium px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full border border-blue-200 dark:border-blue-800 whitespace-nowrap ml-2">
                        {Math.round(result.similarity * 100)}% match
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {highlightText(result.original_notes)}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {new Date(result.created_at).toLocaleDateString()}
                      </span>
                      {result.persona && (
                        <span className="italic">· Persona: {result.persona}</span>
                      )}
                      {result.sentiment && (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-base" aria-hidden>
                            {result.sentiment === 'positive' ? '😊' : result.sentiment === 'negative' ? '😞' : '😐'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full border text-[10px]
                            ${result.sentiment === 'positive' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800'
                              : result.sentiment === 'negative' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700'}`}>
                            {result.sentiment}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Quick actions */}
                    <div className="flex items-center justify-end gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openInCanvas(result.id)}
                        title="Open in Canvas"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" /> Open
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copySummary(result.id, result.summary)}
                        title="Copy summary"
                      >
                        {copiedSummaryId === result.id ? (
                          <Check className="h-4 w-4 mr-1 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4 mr-1" />
                        )}
                        Copy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => shareAndCopyLink(result.id)}
                        disabled={sharingId === result.id}
                        title="Create share link"
                      >
                        {sharingId === result.id ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : copiedShareId === result.id ? (
                          <Check className="h-4 w-4 mr-1 text-green-600" />
                        ) : (
                          <Share2 className="h-4 w-4 mr-1" />
                        )}
                        Share
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteNote(result.id)}
                        disabled={deletingId === result.id}
                        title="Delete note"
                        className="text-destructive hover:text-destructive"
                      >
                        {deletingId === result.id ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-1" />
                        )}
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <EmptyState
              icon={Search}
              title="No results"
              description={`No results found for "${searchQuery}". Try a different search query.`}
            />
          )}
        </div>
      )}
    </div>
  );
}
