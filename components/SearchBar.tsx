"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, X } from "lucide-react";

type SearchResult = {
  id: number;
  summary: string;
  original_notes: string;
  persona: string;
  created_at: string;
  similarity: number;
};

type SearchBarProps = {
  userId: string;
};

export default function SearchBar({ userId }: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          userId: userId,
          matchCount: 5,
          matchThreshold: 0.75
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      setSearchResults(data.results || []);
    } catch (err: any) {
      console.error('Search error:', err);
      const message = (err && typeof err.message === 'string' && err.message !== 'Network error')
        ? err.message
        : 'Failed to search. Please try again.';
      setError(message);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
    setError(null);
  };

  return (
    <div className="mt-10 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Search className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-2xl font-bold text-foreground">Semantic Search</h2>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4">
        Search your notes by meaning, not just keywords. Try asking questions like "What meetings did I have?" or "Show me urgent tasks"
      </p>

      {/* Search Input */}
      <form onSubmit={handleSearch} className="relative">
        <Input
          type="text"
          placeholder="Search your notes by meaning..."
          className="w-full pr-20"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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
                      <span className="text-xs font-medium px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full whitespace-nowrap ml-2">
                        {Math.round(result.similarity * 100)}% match
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {result.original_notes}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {new Date(result.created_at).toLocaleDateString()}
                      </span>
                      {result.persona && (
                        <span className="italic">· Persona: {result.persona}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p>No results found for "{searchQuery}"</p>
              <p className="text-sm mt-1">Try a different search query</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
