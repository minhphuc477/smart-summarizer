"use client";

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

// Import tất cả các components giao diện cần thiết
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Terminal, Copy, X, Volume2, VolumeX, AlertCircle, Calendar, Link, FileText } from "lucide-react";
import { useSpeech } from '@/lib/useSpeech';

// Import calendar utilities
import { generateCalendarLinks, downloadICS } from '@/lib/calendarLinks';

// Import components
import History from './History';
import SearchBar from './SearchBar';
import FolderSidebar from './FolderSidebar';
import WorkspaceManager from './WorkspaceManager';
import { ThemeToggle } from './theme-toggle';
import TemplateSelector from './TemplateSelector';
import { PersonaManager } from './PersonaManager';
import { useRouter } from 'next/navigation';
import VoiceInputButton from './VoiceInputButton';
import LanguageSelector from './LanguageSelector';
import EncryptionDialog from './EncryptionDialog';
import NavigationMenu from './NavigationMenu';
import GuestUpgradeDialog from './GuestUpgradeDialog';

// Import guest mode utilities
// Import guest mode utilities
import { 
  canGuestUse, 
  incrementGuestUsage, 
  addGuestNote, 
  getRemainingUsage,
  // getGuestHistory, // Commented out as it is unused
  ActionItem
} from '@/lib/guestMode';

// Định nghĩa kiểu dữ liệu cho kết quả
type SummaryResult = {
  summary: string;
  takeaways: string[];
  actions: ActionItem[];
  tags?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
};

// Component chính của ứng dụng
export default function SummarizerApp({ session, isGuestMode }: { session: Session; isGuestMode: boolean }) {
  const router = useRouter();
  const { t } = useTranslation();
  
  // === Quản lý State ===
  const [notes, setNotes] = useState("");
  const [customPersona, setCustomPersona] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentSpeaking, setCurrentSpeaking] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [remainingUses, setRemainingUses] = useState(5);
  const [showFolders, setShowFolders] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [inputMode, setInputMode] = useState<'text' | 'url'>('text');
  const [urlInput, setUrlInput] = useState('');

  // Hook cho Text-to-Speech
  const { speak, stop, isSpeaking, isSupported } = useSpeech();

  // Update remaining uses for guest
  useState(() => {
    if (isGuestMode) {
      setRemainingUses(getRemainingUsage());
    }
  });

  // Hàm lấy emoji cho sentiment
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

  const getSentimentLabel = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return 'Positive';
      case 'negative':
        return 'Negative';
      case 'neutral':
      default:
        return 'Neutral';
    }
  };

  // Hàm tiện ích để copy text
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Normalize action item label from various shapes used in tests and API
  const getActionTask = (a: unknown): string => {
    if (!a || typeof a !== 'object') return '';
    const anyA = a as { task?: unknown; title?: unknown };
    return String(anyA.task ?? anyA.title ?? '');
  };

  // Hàm xử lý Text-to-Speech
  const handleSpeak = (text: string, section: string) => {
    if (currentSpeaking === section && isSpeaking) {
      // Nếu đang đọc section này thì dừng lại
      stop();
      setCurrentSpeaking(null);
    } else {
      // Đọc text mới
      speak(text);
      setCurrentSpeaking(section);
    }
  };

  // Hàm xử lý đăng nhập/đăng xuất
  const handleSignIn = async () => {
    try {
      await supabase.auth.signInWithOAuth({ provider: 'google' });
    } catch (e) {
      console.error('Sign-in failed', e);
    }
  };
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // Trang sẽ tự động reload về màn hình đăng nhập
  };

  // Hàm chính xử lý việc gọi API và lưu dữ liệu
  const handleSubmit = async () => {
    // Route to appropriate handler based on input mode
    if (inputMode === 'url') {
      return handleUrlSubmit();
    }

    // Check guest limit
    if (isGuestMode && !canGuestUse()) {
      setError("You've reached the guest limit. Please sign in to continue!");
      return;
    }

    // Prevent submitting encrypted content (requires client-side decrypt first)
    if (notes.includes('"encrypted"') && notes.includes('"ciphertext"')) {
      setError('Your notes appear to be encrypted. Please decrypt them before summarizing.');
      return;
    }

    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      if (isGuestMode) {
        // Guest mode: Call API without saving to DB
        const response = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes, customPersona, isGuest: true }),
        });

        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }

        const data: SummaryResult = await response.json();

        setResult(data);

        // Save to localStorage
        incrementGuestUsage();
        addGuestNote({
          original_notes: notes,
          persona: customPersona || null,
          summary: data.summary,
          takeaways: data.takeaways,
          actions: data.actions,
          tags: data.tags,
          sentiment: data.sentiment,
        });

        // Update remaining uses
        setRemainingUses(getRemainingUsage());

      } else {
        // Logged in: Save to DB


        const response = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            notes, 
            customPersona, 
            userId: session.user.id,
            folderId: selectedFolderId,
            workspaceId: selectedWorkspaceId
          }),
        });

        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }

        const data: SummaryResult = await response.json();

        setResult(data);
      }

    } catch (err) {

      setError("Sorry, something went wrong. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlSubmit = async () => {
    // Check guest limit
    if (isGuestMode && !canGuestUse()) {
      setError("You've reached the guest limit. Please sign in to continue!");
      return;
    }

    // Validate URL
    if (!urlInput.trim()) {
      setError("Please enter a URL");
      return;
    }

    try {
      new URL(urlInput);
    } catch {
      setError("Please enter a valid URL (e.g., https://example.com)");
      return;
    }

    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/summarize-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          url: urlInput, 
          customPersona 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server responded with status: ${response.status}`);
      }

      const data: SummaryResult = await response.json();
      setResult(data);

      if (isGuestMode) {
        // Save to localStorage for guest
        incrementGuestUsage();
        addGuestNote({
          original_notes: `URL: ${urlInput}`,
          persona: customPersona || null,
          summary: data.summary,
          takeaways: data.takeaways,
          actions: data.actions,
          tags: data.tags,
          sentiment: data.sentiment,
        });
        setRemainingUses(getRemainingUsage());
      } else {
        // For logged-in users, save the summarized URL content
        const saveResponse = await fetch("/api/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            notes: `URL: ${urlInput}\n\nContent extracted and summarized.`, 
            customPersona, 
            userId: session.user.id,
            folderId: selectedFolderId,
            workspaceId: selectedWorkspaceId,
            result: data // Pass the result so we don't re-summarize
          }),
        });

        if (saveResponse.ok) {
          const savedData = await saveResponse.json();
          // Update result with database ID if needed
          setResult({ ...data, ...savedData });
        }
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to process URL. Please try again.";
      setError(errorMessage);
      console.error('URL summarization error:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <main className="flex min-h-screen bg-background">
      {/* === Sidebar for Folders & Workspaces (only for logged in users) === */}
      {!isGuestMode && (
        <aside className="w-64 border-r border-border p-4 hidden lg:block space-y-6">
          {/* Workspace Selector */}
          <WorkspaceManager
            selectedWorkspaceId={selectedWorkspaceId}
            onWorkspaceChange={setSelectedWorkspaceId}
          />

          {/* Folder Sidebar */}
          <FolderSidebar 
            userId={session.user.id} 
            onFolderSelect={setSelectedFolderId}
            selectedFolderId={selectedFolderId}
          />
        </aside>
      )}

      {/* === Main Content === */}
      <div className="flex-1 flex flex-col items-center p-6 sm:p-12">
        {/* === Header === */}
        <div className="w-full max-w-5xl flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              {!isGuestMode && <NavigationMenu />}
              {/* Mobile: open Folders drawer */}
              {!isGuestMode && (
                <Button className="lg:hidden" variant="outline" onClick={() => setShowFolders(true)}>
                  {t('folders')}
                </Button>
              )}
              <span className="text-muted-foreground text-sm hidden sm:block">
            {isGuestMode ? (
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {t('guestMode')} ({remainingUses} {t('usesLeft')})
              </span>
            ) : (
              `Welcome, ${session.user.email}`
            )}
          </span>
            </div>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <ThemeToggle />
            {!isGuestMode ? (
              <Button onClick={handleSignOut} variant="outline">{t('signOut')}</Button>
            ) : (
              <Button onClick={handleSignIn} variant="default">{t('signIn')}</Button>
            )}
          </div>
        </div>

  <div className="w-full max-w-5xl">
          <header className="text-center mb-10">
            <h1 className="text-4xl font-bold text-foreground tracking-tight">{t('smartNoteSummarizer')}</h1>
            <p className="text-muted-foreground mt-2">
              {/* Keep friendly tagline in English for now */}
              Describe an AI persona, paste your notes, and watch the magic happen.
            </p>
            {isGuestMode && (
              remainingUses <= 1 ? (
                <div className="mt-3 flex items-center justify-center gap-3 text-amber-700 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
                  <span className="text-sm">You&apos;re almost out of guest summaries.</span>
                  <Button size="sm" onClick={() => setShowUpgradeDialog(true)} variant="default">
                    See What You&apos;re Missing
                  </Button>
                </div>
              ) : (
                <div className="mt-3 flex items-center justify-between bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md px-4 py-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      ⚠️ Limited to {remainingUses} summaries while signed out
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Sign in for unlimited access, history, folders, and more!
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setShowUpgradeDialog(true)}
                    className="ml-3 shrink-0"
                  >
                    Learn More
                  </Button>
                </div>
              )
            )}
          </header>

        {/* === KHU VỰC NHẬP LIỆU === */}
        <section className="mb-8 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              {t('customPersona')}
            </label>
            
            {/* Persona Manager - for authenticated users */}
            {!isGuestMode && (
              <PersonaManager
                currentPersona={customPersona}
                onSelectPersona={setCustomPersona}
                userId={session?.user?.id}
              />
            )}
            
            <div className="flex flex-wrap gap-3 mt-2 items-start">
              <div className="flex-1 min-w-0">
                <Input
                  type="text"
                  placeholder="e.g., A cynical pirate looking for treasure..."
                  className="w-full"
                  value={customPersona}
                  onChange={(e) => setCustomPersona(e.target.value)}
                />
              </div>
              <div className="shrink-0">
                <TemplateSelector
                  onSelectTemplate={(template: { persona_prompt?: string; name?: string; content?: unknown; structure?: unknown }) => {
                    const persona = template.persona_prompt || template.name || '';
                    const toMarkdown = (seed: unknown): string => {
                      const tryParse = (s: string): unknown | null => { try { return JSON.parse(s); } catch { return null; } };
                      const buildFromSections = (obj: unknown): string | null => {
                        if (!obj || typeof obj !== 'object') return null;
                        const sections = Array.isArray((obj as { sections?: unknown[] }).sections) ? (obj as { sections: unknown[] }).sections : null;
                        if (!sections) return null;
                        const lines: string[] = [];
                        sections.forEach((sec: unknown) => {
                          const secObj = sec as { title?: unknown; fields?: unknown[] };
                          const title = (secObj?.title || 'Section').toString();
                          lines.push(`## ${title}`);
                          const fields = Array.isArray(secObj?.fields) ? secObj.fields : [];
                          if (fields.length) fields.forEach((f: unknown) => lines.push(`- [ ] ${String(f)}`));
                          lines.push('');
                        });
                        return lines.join('\n');
                      };
                      if (seed && typeof seed === 'object') {
                        const md = buildFromSections(seed);
                        return md ?? '```json\n' + JSON.stringify(seed, null, 2) + '\n```';
                      }
                      if (typeof seed === 'string') {
                        const trimmed = seed.trim();
                        const obj = tryParse(trimmed);
                        if (obj) {
                          const md = buildFromSections(obj);
                          return md ?? '```json\n' + JSON.stringify(obj, null, 2) + '\n```';
                        }
                        return trimmed;
                      }
                      return '';
                    };
                    const rawSeed = template.content ?? template.structure ?? '';
                    const markdownSeed = toMarkdown(rawSeed);
                    setCustomPersona(persona);
                    setNotes(markdownSeed);
                  }}
                />
              </div>
            </div>
          </div>
          
          {/* Input Mode Toggle */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
            <Button
              variant={inputMode === 'text' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setInputMode('text')}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Text Notes
            </Button>
            <Button
              variant={inputMode === 'url' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setInputMode('url')}
              className="gap-2"
            >
              <Link className="h-4 w-4" />
              URL
            </Button>
          </div>
          
          {/* Conditional Input: Text or URL */}
          {inputMode === 'text' ? (
            <div className="relative">
         <Textarea
           placeholder={t('pasteYourNotes')}
                className="min-h-[280px] text-base p-4 w-full"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              {notes && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Clear notes"
                  className="absolute top-2 right-2"
                  onClick={() => setNotes("")}
                > 
                  <X className="h-4 w-4" />
                </Button>
              )}
          </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Input
                  type="url"
                  placeholder="https://example.com/article"
                  className="text-base p-4 h-auto"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
                {urlInput && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Clear URL"
                    className="absolute top-2 right-2"
                    onClick={() => setUrlInput("")}
                  > 
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Enter a URL to extract and summarize its content. Works with articles, blog posts, and most web pages.
              </p>
            </div>
          )}

          {/* Voice Input & Encryption Buttons - Only for Text Mode */}
          {inputMode === 'text' && (
            <div className="flex gap-2 flex-wrap">
              <VoiceInputButton 
                onTranscript={(text) => setNotes(notes + ' ' + text)}
                className="flex-1 sm:flex-initial"
              />
              <EncryptionDialog 
                mode="encrypt"
                content={notes}
                onResult={(encrypted) => setNotes(encrypted)}
              />
              {notes.includes('"encrypted"') && (
                <EncryptionDialog 
                  mode="decrypt"
                  content={notes}
                  onResult={(decrypted) => setNotes(decrypted)}
                />
              )}
            </div>
          )}

          <Button
            size="lg"
            className="w-full text-lg font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400"
            onClick={handleSubmit}
            disabled={isLoading || (inputMode === 'text' ? !notes.trim() : !urlInput.trim())}
            aria-label="Summarize"
          >
            {isLoading ? "Processing..." : inputMode === 'url' ? 'Summarize URL' : t('summarize')}
          </Button>
        </section>
        
        {/* === KHU VỰC HIỂN THỊ KẾT QUẢ ĐỘNG === */}
        <section className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading && (
            <>
              <Card><CardHeader><CardTitle>Summary (TL;DR)</CardTitle></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-[80%]" /></CardContent></Card>
              <Card><CardHeader><CardTitle>Key Takeaways</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex items-start space-x-3"><Skeleton className="h-5 w-5 mt-0.5 rounded-full" /><Skeleton className="h-5 w-full" /></div><div className="flex items-start space-x-3"><Skeleton className="h-5 w-5 mt-0.5 rounded-full" /><Skeleton className="h-5 w-[90%]" /></div></CardContent></Card>
              <Card><CardHeader><CardTitle>Action Items</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex items-start space-x-3"><Skeleton className="h-5 w-5 mt-0.5 rounded-full" /><Skeleton className="h-5 w-[70%]" /></div></CardContent></Card>
            </>
          )}

          {result && !isLoading && (

            <>
              {/* Accessible TTS control for the entire result */}
              <div className="flex items-center justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    const allText = [
                      result.summary,
                      ...(result.takeaways || []).map(t => `• ${t}`),
                      ...(result.actions || []).map(a => `- ${a.task}${a.datetime ? ` (${new Date(a.datetime).toLocaleString()})` : ''}`)
                    ].join('\n');
                    handleSpeak(allText, 'all');
                  }}
                  aria-label={currentSpeaking === 'all' && isSpeaking ? 'Dừng đọc toàn bộ' : 'Đọc cho tôi nghe'}
                >
                  {currentSpeaking === 'all' && isSpeaking ? 'Dừng đọc' : 'Đọc cho tôi nghe'}
                </Button>
                <Button
                  className="ml-2"
                  variant="outline"
                  onClick={() => {
                    try {
                      const nodes = [
                        {
                          id: `summary-${Date.now()}`,
                          type: 'default',
                          position: { x: 80, y: 60 },
                          data: { label: `Summary\n\n${result.summary}` },
                          style: { backgroundColor: '#ecfeff', border: '2px solid #06b6d4', borderRadius: '8px', padding: '10px', width: 360, height: 160 },
                        },
                        ...((result.takeaways || []).map((t, i) => ({
                          id: `takeaway-${i}-${Date.now()}`,
                          type: 'default',
                          position: { x: 80 + (i%3)*220, y: 260 + Math.floor(i/3)*180 },
                          data: { label: `Takeaway ${i+1}: ${t}` },
                          style: { backgroundColor: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', padding: '10px', width: 200, height: 120 },
                        }))),
                        ...((result.actions || []).map((a, i) => ({
                          id: `action-${i}-${Date.now()}`,
                          type: 'default',
                          position: { x: 760 + (i%3)*220, y: 260 + Math.floor(i/3)*180 },
                          data: { label: `Action ${i+1}: ${getActionTask(a)}` },
                          style: { backgroundColor: '#dcfce7', border: '2px solid #22c55e', borderRadius: '8px', padding: '10px', width: 220, height: 120 },
                        }))),
                      ];
                      const edges: Record<string, unknown>[] = [];
                      sessionStorage.setItem('canvasDraft', JSON.stringify({ title: 'Summary Canvas', nodes, edges }));
                      router.push('/canvas');
                    } catch (e) {
                      console.error('Failed to open in Canvas', e);
                    }
                  }}
                >
                  Open in Canvas
                </Button>
              </div>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>{t('summary')}</CardTitle>
                  <div className="flex gap-1">
                    {isSupported && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleSpeak(result.summary, 'summary')}
                        className={currentSpeaking === 'summary' && isSpeaking ? "text-blue-600 dark:text-blue-400" : ""}
                        aria-label={currentSpeaking === 'summary' && isSpeaking ? 'Stop speaking summary' : 'Speak summary'}
                      >
                        {currentSpeaking === 'summary' && isSpeaking ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Copy summary"
                      onClick={() => handleCopy(result.summary)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent><p className="text-foreground">{result.summary}</p></CardContent>
              </Card>

              {/* Tags và Sentiment */}
              {(result.tags || result.sentiment) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{t('tags')} & {t('sentiment')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Tags */}
                    {result.tags && result.tags.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Tags:</p>
                        <div className="flex flex-wrap gap-2">
                          {result.tags.map((tag, index) => (
                            <span
                              key={`tag-${index}`}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Sentiment */}
                    {result.sentiment && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Sentiment:</p>
                        <div className="flex items-center gap-2">
                          <span className="text-3xl">{getSentimentEmoji(result.sentiment)}</span>
                          <span className="text-lg font-medium text-foreground">
                            {getSentimentLabel(result.sentiment)}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

        <Card>
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>{t('keyTakeaways')}</CardTitle>
                  <div className="flex gap-1">
                    {isSupported && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleSpeak((result.takeaways || []).join('. '), 'takeaways')}
                        className={currentSpeaking === 'takeaways' && isSpeaking ? "text-blue-600 dark:text-blue-400" : ""}
                        aria-label={currentSpeaking === 'takeaways' && isSpeaking ? 'Stop speaking takeaways' : 'Speak takeaways'}
                      >
                        {currentSpeaking === 'takeaways' && isSpeaking ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Copy takeaways"
                      onClick={() => handleCopy(result.takeaways.join('\n- '))}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-2 text-foreground">
                    {(result.takeaways || []).map((item, index) => <li key={`takeaway-${index}`}>{item}</li>)}
                  </ul>
                </CardContent>
              </Card>

        <Card>
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>{t('actionItems')}</CardTitle>
                  <div className="flex gap-1">
                    {isSupported && (result.actions || []).length > 0 && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleSpeak((result.actions || []).map(a => getActionTask(a)).join('. '), 'actions')}
                        className={currentSpeaking === 'actions' && isSpeaking ? "text-blue-600 dark:text-blue-400" : ""}
                        aria-label={currentSpeaking === 'actions' && isSpeaking ? 'Stop speaking actions' : 'Speak actions'}
                      >
                        {currentSpeaking === 'actions' && isSpeaking ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Copy actions"
                      onClick={() => handleCopy((result.actions || []).map(a => getActionTask(a)).join('\n- '))}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {(result.actions || []).length > 0 ? (
                    <ul className="list-disc list-inside space-y-2 text-foreground">
                      {(result.actions || []).map((item, index) => (
                        <li key={`action-${index}`} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1">
                              <span>{getActionTask(item)}</span>
                            {item.datetime && (
                              <span className="text-xs text-muted-foreground">
                                ({new Date(item.datetime).toLocaleString()})
                              </span>
                            )}
                          </div>
                          {item.datetime && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <Calendar className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {(() => {
                                  const links = generateCalendarLinks({
                                      task: item.task || '',
                                    datetime: item.datetime,
                                    description: result.summary.slice(0, 100)
                                  });
                                  return (
                                    <>
                                      <DropdownMenuItem asChild>
                                        <a href={links.google} target="_blank" rel="noopener noreferrer">
                                          Google Calendar
                                        </a>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem asChild>
                                        <a href={links.outlook} target="_blank" rel="noopener noreferrer">
                                          Outlook.com
                                        </a>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem asChild>
                                        <a href={links.office365} target="_blank" rel="noopener noreferrer">
                                          Office 365
                                        </a>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem asChild>
                                        <a href={links.yahoo} target="_blank" rel="noopener noreferrer">
                                          Yahoo Calendar
                                        </a>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => downloadICS(
                                          getActionTask(item),
                                          item.datetime!,
                                          60,
                                          result.summary.slice(0, 100)
                                        )}
                                      >
                                        Download ICS
                                      </DropdownMenuItem>
                                    </>
                                  );
                                })()}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground italic">No action items found.</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </section>
        
        {/* === HIỂN THỊ LỊCH SỬ GHI CHÚ === */}
        {!isGuestMode ? (
          <History selectedFolderId={selectedFolderId} userId={session.user.id} />
        ) : (
          <History isGuest={true} />
        )}

        {/* === TÌM KIẾM THEO NGỮ NGHĨA === */}
        {!isGuestMode && <SearchBar userId={session.user.id} />}
        </div>
      </div>
    {!isGuestMode && (
      <Dialog open={showFolders} onOpenChange={setShowFolders}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Folders</DialogTitle>
            <DialogDescription>Manage your folders and select one to filter notes.</DialogDescription>
          </DialogHeader>
          <FolderSidebar 
            userId={session.user.id}
            onFolderSelect={(id) => { setSelectedFolderId(id); setShowFolders(false); }}
            selectedFolderId={selectedFolderId}
          />
        </DialogContent>
      </Dialog>
    )}
    
    {/* Guest Upgrade Dialog */}
    {isGuestMode && (
      <GuestUpgradeDialog 
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
      />
    )}
    </main>
  );
}