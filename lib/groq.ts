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

    After adopting the persona, you must provide the output ONLY in a valid JSON format with three keys:
    1. "summary": A summary written entirely in the voice of the persona.
    2. "takeaways": An array of key points, also written in the persona's voice.
    3. "actions": A simple array of clear action items.

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