"use client";

import { useState } from 'react';
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
import { Terminal, Copy, X, Volume2, VolumeX, AlertCircle, Calendar } from "lucide-react";
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
import VoiceInputButton from './VoiceInputButton';
import LanguageSelector from './LanguageSelector';
import EncryptionDialog from './EncryptionDialog';
import NavigationMenu from './NavigationMenu';

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

  // Hàm xử lý đăng xuất
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // Trang sẽ tự động reload về màn hình đăng nhập
  };

  // Hàm chính xử lý việc gọi API và lưu dữ liệu
  const handleSubmit = async () => {
    // Check guest limit
    if (isGuestMode && !canGuestUse()) {
      setError("You've reached the guest limit. Please sign in to continue!");
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
        <div className="w-full max-w-3xl flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              {!isGuestMode && <NavigationMenu />}
              <span className="text-muted-foreground text-sm hidden sm:block">
            {isGuestMode ? (
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Guest Mode ({remainingUses} uses left)
              </span>
            ) : (
              `Welcome, ${session.user.email}`
            )}
          </span>
            </div>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <ThemeToggle />
            {!isGuestMode && (
              <Button onClick={handleSignOut} variant="outline">Sign Out</Button>
            )}
          </div>
        </div>

        <div className="w-full max-w-3xl">
          <header className="text-center mb-10">
            <h1 className="text-4xl font-bold text-foreground tracking-tight">Smart Note Summarizer</h1>
            <p className="text-muted-foreground mt-2">
              Describe an AI persona, paste your notes, and watch the magic happen.
            </p>
            {isGuestMode && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                ⚠️ Guest mode: Limited to {remainingUses} summaries. Sign in for unlimited access!
              </p>
            )}
          </header>

        {/* === KHU VỰC NHẬP LIỆU === */}
        <section className="mb-8 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Describe AI Persona (Optional)</label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="e.g., A cynical pirate looking for treasure..."
                className="flex-1"
                value={customPersona}
                onChange={(e) => setCustomPersona(e.target.value)}
              />
              <TemplateSelector 
                onSelectTemplate={(template) => {
                  setCustomPersona(template.name);
                  setNotes(template.content);
                }}
              />
            </div>
          </div>

          <div className="relative">
             <Textarea
                placeholder="Paste your messy notes here..."
                className="min-h-[200px] text-base p-4"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              {notes && (
                <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => setNotes("")}>
                  <X className="h-4 w-4" />
                </Button>
              )}
          </div>

          {/* Voice Input & Encryption Buttons */}
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

          <Button
            size="lg"
            className="w-full text-lg font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400"
            onClick={handleSubmit}
            disabled={isLoading || !notes.trim()}
          >
            {isLoading ? "Generating..." : "Generate Summary"}
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
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Summary (TL;DR)</CardTitle>
                  <div className="flex gap-1">
                    {isSupported && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleSpeak(result.summary, 'summary')}
                        className={currentSpeaking === 'summary' && isSpeaking ? "text-blue-600 dark:text-blue-400" : ""}
                      >
                        {currentSpeaking === 'summary' && isSpeaking ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleCopy(result.summary)}>
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
                    <CardTitle className="text-lg">Tags & Sentiment</CardTitle>
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
                              #{tag}
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
                  <CardTitle>Key Takeaways</CardTitle>
                  <div className="flex gap-1">
                    {isSupported && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleSpeak(result.takeaways.join('. '), 'takeaways')}
                        className={currentSpeaking === 'takeaways' && isSpeaking ? "text-blue-600 dark:text-blue-400" : ""}
                      >
                        {currentSpeaking === 'takeaways' && isSpeaking ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleCopy(result.takeaways.join('\n- '))}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-2 text-foreground">
                    {result.takeaways.map((item, index) => <li key={`takeaway-${index}`}>{item}</li>)}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Action Items</CardTitle>
                  <div className="flex gap-1">
                    {isSupported && result.actions.length > 0 && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleSpeak(result.actions.join('. '), 'actions')}
                        className={currentSpeaking === 'actions' && isSpeaking ? "text-blue-600 dark:text-blue-400" : ""}
                      >
                        {currentSpeaking === 'actions' && isSpeaking ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleCopy(result.actions.map(a => a.task).join('\n- '))}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {result.actions.length > 0 ? (
                    <ul className="list-disc list-inside space-y-2 text-foreground">
                      {result.actions.map((item, index) => (
                        <li key={`action-${index}`} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1">
                            <span>{item.task}</span>
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
                                    task: item.task,
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
                                          item.task,
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
          <History selectedFolderId={selectedFolderId} />
        ) : (
          <History isGuest={true} />
        )}

        {/* === TÌM KIẾM THEO NGỮ NGHĨA === */}
        {!isGuestMode && <SearchBar userId={session.user.id} />}
        </div>
      </div>
    </main>
  );
}