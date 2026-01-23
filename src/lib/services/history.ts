// src/lib/services/history.ts
// Service for storing and retrieving transcription history

import { invoke } from '@tauri-apps/api/core';
import type { TranscriptResult } from '../types';

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
    minutes?: string; // HTML content of generated minutes
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
    await invoke('save_history_entry', { entry: JSON.stringify(entry) });
}

// Get all history entries (summaries only for performance)
export async function getHistoryList(): Promise<HistorySummary[]> {
    const result = await invoke<string>('get_history_list');
    return JSON.parse(result);
}

// Get a single history entry by ID (full transcript)
export async function getHistoryEntry(id: string): Promise<HistoryEntry | null> {
    const result = await invoke<string | null>('get_history_entry', { id });
    if (result) {
        return JSON.parse(result);
    }
    return null;
}

// Delete a history entry
export async function deleteHistoryEntry(id: string): Promise<void> {
    await invoke('delete_history_entry', { id });
}

// Update an existing history entry (e.g., after identifying speakers)
export async function updateHistoryEntry(entry: HistoryEntry): Promise<void> {
    console.log('Updating history entry:', entry.id);
    await invoke('save_history_entry', { entry: JSON.stringify(entry) });
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
