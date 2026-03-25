// src/lib/services/chat.ts
// Service for transcript interrogation chat
import type { TranscriptResult } from '../types';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

/**
 * Build the system prompt that grounds Claude in the transcript content.
 * The full transcript is injected so Claude can answer from it directly.
 */
export function buildTranscriptSystemPrompt(transcript: TranscriptResult): string {
    // Format transcript segments with timestamps and speakers
    const formattedTranscript = transcript.segments
        .map(seg => {
            const mins = Math.floor(seg.start / 60);
            const secs = Math.floor(seg.start % 60);
            const timestamp = `${mins}:${secs.toString().padStart(2, '0')}`;
            return `[${timestamp}] ${seg.speaker}: ${seg.text}`;
        })
        .join('\n');

    const summarySection = transcript.summary
        ? `\n## Meeting Summary\n${transcript.summary}\n`
        : '';

    const topicsSection = transcript.topics?.length
        ? `\n## Detected Topics\n${transcript.topics.map(t => `- ${t.label} (relevance: ${(t.relevance * 100).toFixed(0)}%)`).join('\n')}\n`
        : '';

    return `You are a knowledgeable meeting analyst. You have access to the complete transcript of a meeting and should answer the user's questions based ONLY on the transcript content.

# GROUNDING RULES
- Answer ONLY from the transcript content provided below.
- When quoting or referencing what someone said, cite the speaker name and timestamp, e.g. "Dr. Smith mentioned at 12:34..."
- If the transcript does not contain information to answer the question, say so clearly. Do NOT make up or infer information not present in the transcript.
- Be concise but thorough. Use bullet points for lists when appropriate.
- When multiple speakers discuss a topic, attribute statements to the correct speaker.
${summarySection}${topicsSection}
# FULL TRANSCRIPT
${formattedTranscript}`;
}

/**
 * Send a chat message grounded in the transcript.
 * Takes the full conversation history for multi-turn context.
 */
export async function sendChatMessage(
    userMessage: string,
    transcript: TranscriptResult,
    conversationHistory: ChatMessage[]
): Promise<string> {
    const systemPrompt = buildTranscriptSystemPrompt(transcript);

    // Build messages array: all previous messages + new user message
    const messages = [
        ...conversationHistory.map(msg => ({
            role: msg.role,
            content: msg.content,
        })),
        {
            role: 'user' as const,
            content: userMessage,
        },
    ];

    const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_prompt: systemPrompt, messages }),
    });
    if (!res.ok) throw new Error(`Chat request failed: ${res.statusText}`);
    const data = await res.json();
    return data.text;
}
