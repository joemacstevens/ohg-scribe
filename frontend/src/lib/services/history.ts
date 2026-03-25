// src/lib/services/history.ts
// Service for storing and retrieving transcription history
import type { TranscriptResult } from '../types';

export interface MinutesGeneration {
    id: string;
    generatedAt: string;
    content: string;
    templateName?: string;
    citations?: ParagraphCitation[]; // Citation data for this generation
}

// Citation source linking to a specific part of the transcript
export interface CitationSource {
    speaker: string;
    startTime: number; // seconds into the audio
    endTime: number;
    text: string; // The actual transcript text
}

// Citations for a single paragraph in the minutes
export interface ParagraphCitation {
    paragraphIndex: number; // 0-indexed paragraph number
    paragraphHash: string; // Hash of paragraph content to detect edits
    sources: CitationSource[];
    isStale?: boolean; // Set to true when paragraph is edited
}

export interface HistoryEntry {
    id: string;
    filename: string;
    originalPath: string;
    transcribedAt: string; // ISO date string
    duration?: number; // audio duration in seconds
    speakerCount: number;
    wordCount: number;
    transcript: TranscriptResult;
    audioPath?: string; // Path to stored audio file for playback
    options: {
        speakerNames: string[];
        includedSummary: boolean;
        includedTopics: boolean;
        includedSentiment: boolean;
    };
    aiInferredSpeakers?: string[]; // Speakers names that were AI-inferred (not user-confirmed)
    minutes?: string; // HTML content of latest minutes (for quick access)
    minutesHistory?: MinutesGeneration[]; // Array of all generations
    chatHistory?: { id: string; role: 'user' | 'assistant'; content: string; timestamp: string }[]; // Chat conversation
}

export interface HistorySummary {
    id: string;
    filename: string;
    transcribedAt: string;
    speakerCount: number;
    wordCount: number;
    preview: string; // First ~100 chars of transcript
}

// Save a new transcription to history
export async function saveToHistory(entry: HistoryEntry): Promise<void> {
    console.log('Saving to history:', entry.filename);
    const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: entry.id,
            filename: entry.filename,
            speaker_count: entry.speakerCount,
            word_count: entry.wordCount,
            data: entry,
        })
    });
    if (!res.ok) throw new Error(`Failed to save history: ${res.statusText}`);
}

// Get all history entries (summaries only for performance)
export async function getHistoryList(): Promise<HistorySummary[]> {
    const res = await fetch('/api/history');
    if (!res.ok) throw new Error(`Failed to load history: ${res.statusText}`);
    return res.json();
}

// Get a single history entry by ID (full transcript)
export async function getHistoryEntry(id: string): Promise<HistoryEntry | null> {
    const res = await fetch(`/api/history/${id}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to load history entry: ${res.statusText}`);
    const payload = await res.json();
    // Backend wraps the full entry in a "data" field
    return payload.data as HistoryEntry;
}

// Delete a history entry
export async function deleteHistoryEntry(id: string): Promise<void> {
    const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete history entry: ${res.statusText}`);
}

// Update an existing history entry (e.g., after identifying speakers)
export async function updateHistoryEntry(entry: HistoryEntry): Promise<void> {
    console.log('Updating history entry:', entry.id);
    await saveToHistory(entry);
}

// Generate a unique ID for new entries
export function generateHistoryId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Create a history entry from transcript result
export function createHistoryEntry(
    filename: string,
    originalPath: string,
    transcript: TranscriptResult,
    options: HistoryEntry['options'],
    audioPath?: string
): HistoryEntry {
    // Count words
    const wordCount = transcript.segments.reduce((count, segment) => {
        return count + segment.text.split(/\s+/).length;
    }, 0);

    // Count unique speakers
    const speakers = new Set(transcript.segments.map(s => s.speaker));

    return {
        id: generateHistoryId(),
        filename,
        originalPath,
        transcribedAt: new Date().toISOString(),
        speakerCount: speakers.size,
        wordCount,
        transcript,
        audioPath,
        options
    };
}
