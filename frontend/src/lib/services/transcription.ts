// src/lib/services/transcription.ts
import type { TranscriptionOptions, TranscriptResult, TranscriptSegment } from '../types';

export interface TranscriptResponse {
    id: string;
    status: string;
    text?: string;
    utterances?: Utterance[];
    summary?: string;
    iab_categories_result?: {
        summary: Record<string, number>;
    };
    sentiment_analysis_results?: SentimentResult[];
    auto_highlights_result?: {
        results: { text: string; count: number; rank: number }[];
    };
    error?: string;
}

export interface Utterance {
    speaker: string;
    text: string;
    start: number;
    end: number;
}

export interface SentimentResult {
    text: string;
    start: number;
    end: number;
    sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    confidence: number;
    speaker?: string;
}

/**
 * Get the AssemblyAI API key from the server.
 * Used by the browser to upload audio directly to AssemblyAI,
 * bypassing the gateway for large file transfers.
 */
export async function getAssemblyAIKey(): Promise<string> {
    const res = await fetch('/api/transcription/key');
    if (!res.ok) throw new Error('Could not retrieve AssemblyAI key from server');
    const data = await res.json();
    return data.key;
}

/**
 * Upload audio directly to AssemblyAI from the browser.
 * Uses the server-issued key.  Returns the upload URL.
 */
export async function uploadAudio(file: File): Promise<string> {
    const apiKey = await getAssemblyAIKey();
    const res = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/octet-stream',
        },
        body: file,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
    const data = await res.json();
    return data.upload_url;
}

/**
 * Submit a transcription job via the backend (backend holds the key server-side).
 * Returns the AssemblyAI transcript ID.
 */
export async function submitTranscription(
    audioUrl: string,
    filename: string,
    options: TranscriptionOptions
): Promise<string> {
    const speakerValues = options.speakerNamesInput
        ? options.speakerNamesInput.split(',').map(s => s.trim()).filter(s => s.length > 0)
        : [];

    const res = await fetch('/api/transcription/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            audio_url: audioUrl,
            filename,
            options: {
                max_speakers: options.speakerCount === 'auto' ? null : options.speakerCount,
                boost_words: options.boostWords,
                include_summary: options.includeSummary,
                detect_topics: options.detectTopics,
                analyze_sentiment: options.analyzeSentiment,
                extract_key_phrases: options.extractKeyPhrases,
                speaker_label_mode: options.speakerLabelMode,
                speaker_values: speakerValues,
            }
        })
    });
    if (!res.ok) throw new Error(`Submit failed: ${res.statusText}`);
    const data = await res.json();
    return data.id;
}

/**
 * Poll the backend for transcript status.
 * Backend proxies to AssemblyAI.
 */
export async function pollTranscription(transcriptId: string): Promise<TranscriptResponse> {
    const res = await fetch(`/api/transcription/${transcriptId}`);
    if (!res.ok) throw new Error(`Poll failed: ${res.statusText}`);
    return res.json();
}

/** Poll until transcription completes or times out. */
export async function waitForTranscription(
    transcriptId: string,
    onProgress?: (status: string) => void,
    initialDelayMs: number = 5000,
    pollIntervalMs: number = 3000,
    timeoutMs: number = 30 * 60 * 1000
): Promise<TranscriptResponse> {
    const startTime = Date.now();
    await new Promise(resolve => setTimeout(resolve, initialDelayMs));

    while (Date.now() - startTime < timeoutMs) {
        const response = await pollTranscription(transcriptId);
        onProgress?.(response.status);

        if (response.status === 'completed') return response;
        if (response.status === 'error') {
            throw new Error(response.error || 'Transcription failed');
        }
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    throw new Error('Transcription timed out');
}

/** Convert raw AssemblyAI response to our segment format. */
export function parseTranscriptResponse(
    response: TranscriptResponse,
    speakerNames: string[]
): TranscriptResult {
    const segments: TranscriptSegment[] = [];

    if (response.utterances) {
        const speakerMap: Record<string, string> = {};
        let speakerIndex = 0;

        for (const utterance of response.utterances) {
            if (!speakerMap[utterance.speaker]) {
                speakerMap[utterance.speaker] = (speakerIndex < speakerNames.length && speakerNames[speakerIndex])
                    ? speakerNames[speakerIndex]
                    : utterance.speaker;
                speakerIndex++;
            }

            let sentiment: 'positive' | 'neutral' | 'negative' | undefined;
            if (response.sentiment_analysis_results) {
                const sr = response.sentiment_analysis_results.find(
                    s => s.start >= utterance.start && s.end <= utterance.end
                );
                if (sr) sentiment = sr.sentiment.toLowerCase() as 'positive' | 'neutral' | 'negative';
            }

            segments.push({
                speaker: speakerMap[utterance.speaker],
                text: utterance.text,
                start: utterance.start,
                end: utterance.end,
                sentiment
            });
        }
    }

    const topics: { label: string; relevance: number }[] = [];
    if (response.iab_categories_result?.summary) {
        for (const [label, relevance] of Object.entries(response.iab_categories_result.summary)) {
            topics.push({ label, relevance: relevance * 100 });
        }
        topics.sort((a, b) => b.relevance - a.relevance);
    }

    return {
        segments,
        summary: response.summary,
        topics: topics.length > 0 ? topics : undefined
    };
}
