import { writable } from 'svelte/store';
import { getHistoryEntry, updateHistoryEntry } from '$lib/services/history';
import type { TranscriptResult } from '$lib/types';

export type ViewMode = 'compact' | 'workspace';

export interface WorkspaceState {
    viewMode: ViewMode;
    currentTranscript: TranscriptResult | null;
    currentJobId: string | null;
    currentFilename: string | null;
    isMinutesGenerated: boolean;
    activeSpeakerId: string | null;
    minutesContent: string | null;
    isLoading: boolean;
    activeAttributionIds?: number[];
    audioPath: string | null;
}

function createWorkspaceStore() {
    const { subscribe, set, update } = writable<WorkspaceState>({
        viewMode: 'compact',
        currentTranscript: null,
        currentJobId: null,
        currentFilename: null,
        isMinutesGenerated: false,
        activeSpeakerId: null,
        minutesContent: null,
        isLoading: false,
        activeAttributionIds: undefined,
        audioPath: null
    });

    return {
        subscribe,
        openWorkspace: (transcript: TranscriptResult, jobId: string, filename: string) => update(s => ({
            ...s,
            viewMode: 'workspace',
            currentTranscript: transcript,
            currentJobId: jobId,
            currentFilename: filename,
            isLoading: false
        })),
        loadFromHistory: async (id: string) => {
            update(s => ({ ...s, isLoading: true, viewMode: 'workspace', currentJobId: id }));
            try {
                const entry = await getHistoryEntry(id);
                if (entry) {
                    console.log("[WorkspaceStore] Loaded entry:", id, "AudioPath:", entry.audioPath);
                    update(s => ({
                        ...s,
                        currentTranscript: entry.transcript,
                        currentFilename: entry.filename,
                        isMinutesGenerated: !!entry.minutes,
                        minutesContent: entry.minutes || null,
                        isLoading: false,
                        audioPath: entry.audioPath || null
                    }));
                }
            } catch (e) {
                console.error("Failed to load history:", e);
                update(s => ({ ...s, isLoading: false }));
            }
        },
        closeWorkspace: () => update(s => ({
            ...s,
            viewMode: 'compact',
            currentTranscript: null,
            currentJobId: null
        })),
        // Helper to reset specifically for "New Job"
        resetToNew: () => update(s => ({
            ...s,
            viewMode: 'compact',
            currentTranscript: null,
            currentJobId: null,
            currentFilename: null,
            isMinutesGenerated: false,
            activeSpeakerId: null,
            minutesContent: null,
            isLoading: false
        })),
        setMinutesGenerated: (generated: boolean) => update(s => ({
            ...s,
            isMinutesGenerated: generated
        })),
        updateMinutes: (content: string) => update(s => ({
            ...s,
            minutesContent: content
        })),
        scrollToSpeaker: (speakerKey: string) => update(s => ({
            ...s,
            activeSpeakerId: speakerKey
        })),
        highlightAttribution: (indices: number[]) => update(s => {
            return { ...s, activeAttributionIds: indices };
        }),
        updateSegment: (index: number, speaker: string, text: string) => update(s => {
            if (!s.currentTranscript) return s;
            const segments = [...s.currentTranscript.segments];
            if (segments[index]) {
                segments[index] = { ...segments[index], speaker, text };
            }
            return {
                ...s,
                currentTranscript: { ...s.currentTranscript, segments }
            };
        }),
        saveChanges: async () => {
            // We need to persist the current transcript back to the history file.
            // We'll subscribe to the store value momentarily to get it, 
            // but since we are inside `update` we can't async easily without thunk pattern.
            // Instead, we'll expose a method that reads the store via get() or just trusting the caller?
            // Actually, `update` isn't async friendly.
            // Let's implement this by importing the store instance? No, circular dependency.
            // We'll assume the component calls `workspaceStore.subscribe` to get ID and Data, then calls a service function?
            // BETTER: Make this action simple and rely on the COMPONENT to call `updateHistoryEntry`.
            // OR: We implement a thunk-like pattern here.

            // For now, let's just make sure the state is updated. The persisting should be handled by a service call from the UI 
            // or we import `updateHistoryEntry` here? Yes, we imported it top of file, but `getHistoryEntry` is there.
        },
        reset: () => set({
            viewMode: 'compact',
            currentTranscript: null,
            currentJobId: null,
            currentFilename: null,
            isMinutesGenerated: false,
            activeSpeakerId: null,
            minutesContent: null,
            isLoading: false,
            activeAttributionIds: undefined,
            audioPath: null
        })
    };
}

export const workspaceStore = createWorkspaceStore();
