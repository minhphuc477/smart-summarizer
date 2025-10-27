import { NextResponse } from 'next/server';
import { getGroqSummary } from '@/lib/groq'; // Import hàm tái sử dụng

export async function POST(req: Request) {
  try {
    const { notes, customPersona } = await req.json();
    if (!notes) {
      return NextResponse.json({ error: "Notes content is required." }, { status: 400 });
    }

    const jsonResponse = await getGroqSummary(notes, customPersona);
    return NextResponse.json(jsonResponse);

  } catch (error) {
    console.error("Error in /api/summarize:", error);
    return NextResponse.json({ error: "Failed to process the request." }, { status: 500 });
  }
}