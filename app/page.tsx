"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import type { Session } from '@supabase/supabase-js';

// Import các UI components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Copy, X, Mic, Square, Link as LinkIcon, Trash2 } from "lucide-react"; // Thêm icon Trash2

// Định nghĩa kiểu dữ liệu cho kết quả và lịch sử
type SummaryResult = {
  summary: string;
  takeaways: string[];
  actions: string[];
};

type HistoryNote = {
  id: number;
  created_at: string;
  summary: string;
  persona: string;
  original_notes: string;
};

export default function Home() {
  // === QUẢN LÝ STATE ===
  const [session, setSession] = useState<Session | null>(null);
  const [notes, setNotes] = useState("");
  const [customPersona, setCustomPersona] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [historyNotes, setHistoryNotes] = useState<HistoryNote[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // === XỬ LÝ LOGIC (HOOKS & FUNCTIONS) ===
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchNotes = async () => {
      if (!session) return;
      setHistoryLoading(true);
      const { data, error } = await supabase.from('notes').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(10);
      if (error) console.error("Error fetching notes:", error);
      else setHistoryNotes(data as HistoryNote[]);
      setHistoryLoading(false);
    };
    fetchNotes();
  }, [session]);

  const handleSignOut = async () => { await supabase.auth.signOut(); };
  const handleCopy = (text: string) => { navigator.clipboard.writeText(text); };

  const saveResultToDb = async (summaryResult: SummaryResult, originalContent: string) => {
    if (!session) return;
    const { data: newNote, error } = await supabase.from('notes').insert({ user_id: session.user.id, persona: customPersona, original_notes: originalContent, summary: summaryResult.summary, takeaways: summaryResult.takeaways, actions: summaryResult.actions }).select('*').single();
    if (error) console.error("Error saving note:", error);
    else if (newNote) setHistoryNotes(prev => [newNote as HistoryNote, ...prev]);
  };
  
  // === HÀM XÓA LỊCH SỬ MỚI ===
  const handleDelete = async (noteId: number) => {
    // Hỏi xác nhận trước khi xóa
    if (window.confirm("Are you sure you want to delete this note?")) {
      // Cập nhật UI ngay lập tức để tạo cảm giác nhanh
      setHistoryNotes(currentNotes => currentNotes.filter(note => note.id !== noteId));
      
      // Gửi yêu cầu xóa đến Supabase
      const { error } = await supabase.from('notes').delete().eq('id', noteId);

      if (error) {
        console.error("Error deleting note:", error);
        // Tùy chọn: có thể hiện lại note đã xóa nếu có lỗi
        setError("Could not delete the note. Please refresh the page.");
      }
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true); setResult(null); setError(null);
    try {
      const response = await fetch("/api/summarize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes, customPersona }) });
      if (!response.ok) throw new Error(`Server responded with status: ${response.status}`);
      const data: SummaryResult = await response.json();
      setResult(data);
      await saveResultToDb(data, notes);
    } catch (err) { setError("Sorry, something went wrong with the summary. Please try again."); console.error(err); }
    finally { setIsLoading(false); }
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    setIsLoading(true); setResult(null); setError(null); setNotes("");
    try {
      const response = await fetch("/api/summarize-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: urlInput, customPersona }) });
      if (!response.ok) throw new Error(`Server responded with status: ${response.status}`);
      const data: SummaryResult = await response.json();
      setResult(data);
      await saveResultToDb(data, `URL: ${urlInput}`);
    } catch (err) { setError("Failed to summarize the URL. Please check the link and try again."); console.error(err); }
    finally { setIsLoading(false); }
  };
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const audioChunks: Blob[] = [];
      recorder.ondataavailable = (event) => audioChunks.push(event.data);
      recorder.onstop = async () => {
        const audioFile = new File([new Blob(audioChunks, { type: 'audio/webm' })], "recording.webm");
        const formData = new FormData();
        formData.append('file', audioFile);
        setIsLoading(true); setError(null);
        try {
          const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Transcription failed');
          setNotes(prev => prev ? `${prev}\n${data.text}` : data.text);
        } catch (err) { setError("Sorry, could not transcribe the audio."); console.error(err); }
        finally { setIsLoading(false); }
      };
      recorder.start(); setIsRecording(true);
    } catch (err) { setError("Microphone access was denied. Please allow it in your browser settings."); console.error(err); }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current) { mediaRecorderRef.current.stop(); setIsRecording(false); }
  };

  if (!session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-12 bg-gray-50">
        <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-xl"><h1 className="text-2xl font-bold text-center mb-4">Welcome to Smart Summarizer</h1><p className="text-center text-gray-600 mb-6">Sign in to save your notes and access your history.</p><Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} providers={['google', 'github']} theme="light" /></div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-6 sm:p-12 bg-gray-50">
      <div className="w-full max-w-3xl">
        <div className="w-full flex justify-between items-center mb-6"><p className="text-sm text-gray-600">Welcome, {session.user.email}</p><Button onClick={handleSignOut} variant="outline">Sign Out</Button></div>
        <header className="text-center mb-10"><h1 className="text-4xl font-bold text-gray-800 tracking-tight">Smart Note Summarizer</h1><p className="text-gray-600 mt-2">Record audio, paste a URL, or type your notes to get an intelligent summary.</p></header>

        <section className="mb-8 space-y-4">
          <div><label className="text-sm font-medium text-gray-700">Describe AI Persona (Optional)</label><Input type="text" placeholder="e.g., A cynical pirate looking for treasure..." className="w-full bg-white" value={customPersona} onChange={(e) => setCustomPersona(e.target.value)} /></div>
          <div className="relative"><Textarea placeholder="Paste your messy notes here, or record your voice..." className="min-h-[200px] text-base p-4 border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white" value={notes} onChange={(e) => setNotes(e.target.value)} /><div className="absolute top-2 right-2 flex items-center">{notes && <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-800" onClick={() => setNotes("")}><X className="h-4 w-4" /></Button>}<Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-800" onClick={isRecording ? stopRecording : startRecording}>{isRecording ? <Square className="h-4 w-4 text-red-500 animate-pulse" /> : <Mic className="h-4 w-4" />}</Button></div></div>
          <div className="flex w-full items-center space-x-2"><LinkIcon className="h-5 w-5 text-gray-500" /><Input type="url" placeholder="Or paste a URL to summarize..." className="w-full bg-white" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} /><Button onClick={handleUrlSubmit} disabled={isLoading || !urlInput.trim()}>Summarize URL</Button></div>
          <Button size="lg" className="w-full text-lg font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400" onClick={handleSubmit} disabled={isLoading || !notes.trim()}>{isLoading ? "Processing..." : "Generate Summary from Text"}</Button>
        </section>
        
        <section className="space-y-6">
          {error && <Alert variant="destructive"><Terminal className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          {isLoading && !result && <><Card><CardHeader><CardTitle>Summary (TL;DR)</CardTitle></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-[80%]" /></CardContent></Card></>}
          {result && !isLoading && <><Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle>Summary (TL;DR)</CardTitle><Button variant="ghost" size="icon" onClick={() => handleCopy(result.summary)}><Copy className="h-4 w-4" /></Button></CardHeader><CardContent><p className="text-gray-700">{result.summary}</p></CardContent></Card><Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle>Key Takeaways</CardTitle><Button variant="ghost" size="icon" onClick={() => handleCopy(result.takeaways.join('\n- '))}><Copy className="h-4 w-4" /></Button></CardHeader><CardContent><ul className="list-disc list-inside space-y-2 text-gray-700">{result.takeaways.map((item, index) => <li key={`takeaway-${index}`}>{item}</li>)}</ul></CardContent></Card><Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle>Action Items</CardTitle><Button variant="ghost" size="icon" onClick={() => handleCopy(result.actions.join('\n- '))}><Copy className="h-4 w-4" /></Button></CardHeader><CardContent>{result.actions.length > 0 ? <ul className="list-disc list-inside space-y-2 text-gray-700">{result.actions.map((item, index) => <li key={`action-${index}`}>{item}</li>)}</ul> : <p className="text-gray-500 italic">No action items found.</p>}</CardContent></Card></>}
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">History</h2>
          <div className="space-y-4">
            {historyLoading && <><Skeleton className="w-full h-24 mb-4" /><Skeleton className="w-full h-24" /></>}
            {!historyLoading && historyNotes.length > 0 ? (
              historyNotes.map(note => (
                <Card key={note.id} className="bg-white">
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{note.summary}</CardTitle>
                      <p className="text-sm text-gray-500 pt-2">
                        Created on {new Date(note.created_at).toLocaleDateString()}
                        {note.persona && ` — Persona: "${note.persona}"`}
                      </p>
                    </div>
                    {/* === NÚT XÓA MỚI === */}
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(note.id)}>
                      <Trash2 className="h-4 w-4 text-gray-500 hover:text-red-500" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 font-medium mt-2">Original:</p>
                    <p className="text-sm text-gray-500 mt-1 truncate">{note.original_notes}</p>
                  </CardContent>
                </Card>
              ))
            ) : (!historyLoading && <p className="text-gray-500">Your saved notes will appear here.</p>)}
          </div>
        </section>
      </div>
    </main>
  );
}