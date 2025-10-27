import { NextResponse } from 'next/server';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { getGroqSummary } from '@/lib/groq'; // Dùng lại logic AI

export async function POST(req: Request) {
  try {
    const { url, customPersona } = await req.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required." }, { status: 400 });
    }

    // 1. Fetch HTML từ URL
    const response = await fetch(url);
    const html = await response.text();

    // 2. Dùng JSDOM và Readability để trích xuất nội dung chính
    const doc = new JSDOM(html, { url });
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    if (!article || !article.textContent) {
      return NextResponse.json({ error: "Could not extract content from the URL." }, { status: 400 });
    }
    
    // 3. Lấy nội dung text và gửi đến hàm tóm tắt
    const content = article.textContent;
    const jsonResponse = await getGroqSummary(content, customPersona);
    
    return NextResponse.json(jsonResponse);

  } catch (error) {
    console.error("Error in /api/summarize-url:", error);
    return NextResponse.json({ error: "Failed to process the request." }, { status: 500 });
  }
}