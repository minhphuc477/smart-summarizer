"use client";

import { useState } from 'react';
import { supabase } from '../lib/supabase'; // Import Supabase client
import type { Session } from '@supabase/supabase-js';

// Import tất cả các components giao diện cần thiết
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Copy, X } from "lucide-react";

// Import component hiển thị lịch sử
import History from './History';

// Định nghĩa kiểu dữ liệu cho kết quả
type SummaryResult = {
  summary: string;
  takeaways: string[];
  actions: string[];
};

// Component chính của ứng dụng, chỉ hiển thị khi người dùng đã đăng nhập
export default function SummarizerApp({ session }: { session: Session }) {
  
  // === Quản lý State ===
  const [notes, setNotes] = useState("");
  const [customPersona, setCustomPersona] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hàm tiện ích để copy text
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Hàm xử lý đăng xuất
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // Trang sẽ tự động reload về màn hình đăng nhập
  };

  // Hàm chính xử lý việc gọi API và lưu dữ liệu
  const handleSubmit = async () => {
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      // 1. Gọi API backend để AI xử lý
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, customPersona }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data: SummaryResult = await response.json();
      setResult(data);

      // 2. Lưu kết quả vào database Supabase
      const { error: insertError } = await supabase
        .from('notes')
        .insert({
          user_id: session.user.id, // ID của người dùng hiện tại
          persona: customPersona,
          original_notes: notes,
          summary: data.summary,
          takeaways: data.takeaways,
          actions: data.actions
        });

      if (insertError) {
        // Nếu không lưu được, chỉ cần log lỗi ra console mà không làm phiền người dùng
        console.error("Error saving note to Supabase:", insertError);
      }

    } catch (err) {
      setError("Sorry, something went wrong. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <main className="flex min-h-screen flex-col items-center p-6 sm:p-12 bg-gray-50">
      {/* === Header với thông tin người dùng và nút Đăng xuất === */}
      <div className="w-full max-w-3xl flex justify-between items-center mb-6">
        <span className="text-gray-600 text-sm hidden sm:block">Welcome, {session.user.email}</span>
        <Button onClick={handleSignOut} variant="outline">Sign Out</Button>
      </div>

      <div className="w-full max-w-3xl">
        <header className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-800 tracking-tight">Smart Note Summarizer</h1>
          <p className="text-gray-600 mt-2">
            Describe an AI persona, paste your notes, and watch the magic happen.
          </p>
        </header>

        {/* === KHU VỰC NHẬP LIỆU === */}
        <section className="mb-8 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Describe AI Persona (Optional)</label>
            <Input
              type="text"
              placeholder="e.g., A cynical pirate looking for treasure..."
              className="w-full bg-white"
              value={customPersona}
              onChange={(e) => setCustomPersona(e.target.value)}
            />
          </div>

          <div className="relative">
             <Textarea
                placeholder="Paste your messy notes here..."
                className="min-h-[200px] text-base p-4 border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              {notes && (
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-gray-500 hover:text-gray-800" onClick={() => setNotes("")}>
                  <X className="h-4 w-4" />
                </Button>
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
                  <Button variant="ghost" size="icon" onClick={() => handleCopy(result.summary)}><Copy className="h-4 w-4" /></Button>
                </CardHeader>
                <CardContent><p className="text-gray-700">{result.summary}</p></CardContent>
              </Card>

              <Card>
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Key Takeaways</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => handleCopy(result.takeaways.join('\n- '))}><Copy className="h-4 w-4" /></Button>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-2 text-gray-700">
                    {result.takeaways.map((item, index) => <li key={`takeaway-${index}`}>{item}</li>)}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Action Items</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => handleCopy(result.actions.join('\n- '))}><Copy className="h-4 w-4" /></Button>
                </CardHeader>
                <CardContent>
                  {result.actions.length > 0 ? (
                    <ul className="list-disc list-inside space-y-2 text-gray-700">
                      {result.actions.map((item, index) => <li key={`action-${index}`}>{item}</li>)}
                    </ul>
                  ) : (
                    <p className="text-gray-500 italic">No action items found.</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </section>
        
        {/* === HIỂN THỊ LỊCH SỬ GHI CHÚ === */}
        <History />
      </div>
    </main>
  );
}