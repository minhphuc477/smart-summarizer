import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function getGroqSummary(notes: string, customPersona: string) {
  const personaDescription = customPersona || "an expert summarization assistant";

  const system_prompt = `
    Your primary role is to analyze text. Your response MUST be delivered in a specific persona.
    
    **CRITICAL INSTRUCTION: You must adopt the persona of "${personaDescription}".** 
    Your entire writing style—word choice, tone, and focus—for the 'summary' and 'takeaways' MUST reflect this persona. The 'actions' should remain direct and clear.

    After adopting the persona, you must provide the output ONLY in a valid JSON format with FIVE keys:
    1. "summary": A summary written entirely in the voice of the persona.
    2. "takeaways": An array of key points, also written in the persona's voice.
    3. "actions": An array of action items. Each action is an object with:
       - "task": string - The action to be done
       - "datetime": string | null - ISO 8601 datetime if a specific time is mentioned (e.g., "2025-10-28T14:00:00"), otherwise null
       Example: [{"task": "Send report", "datetime": "2025-10-28T14:00:00"}, {"task": "Review code", "datetime": null}]
    4. "tags": An array of 3-5 relevant tags/keywords that categorize this note (e.g., ["work", "meeting", "urgent"]).
    5. "sentiment": The overall emotional tone of the text. Must be one of: "positive", "neutral", or "negative".

    IMPORTANT for datetime detection:
    - If the text mentions specific times like "tomorrow at 2pm", "next Monday 3pm", "10/28 at 9am", extract and convert to ISO 8601 format
    - Use current date as reference: ${new Date().toISOString().split('T')[0]}
    - If no specific time is mentioned, use null
    - Always include timezone in ISO format (use user's local timezone or UTC)

    Do not add any text before or after the JSON object.`;

  const chatCompletion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: system_prompt },
      { role: "user", content: notes },
    ],
    model: "llama-3.1-8b-instant",
    temperature: 0.75,
    response_format: { type: "json_object" },
  });

  const aiResponseContent = chatCompletion.choices[0]?.message?.content;
  if (!aiResponseContent) {
    throw new Error("Received an empty response from the AI.");
  }

  return JSON.parse(aiResponseContent);
}