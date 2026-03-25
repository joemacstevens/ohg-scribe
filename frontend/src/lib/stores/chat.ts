// src/lib/stores/chat.ts
// Store for managing transcript interrogation chat state

import { writable, get } from 'svelte/store';
import { workspaceStore } from './workspace';
import { getHistoryEntry, updateHistoryEntry } from '$lib/services/history';
import type { ChatMessage } from '$lib/services/chat';

export interface ChatState {
    messages: ChatMessage[];
    isLoading: boolean;
    currentJobId: string | null;
}

function createChatStore() {
    const { subscribe, set, update } = writable<ChatState>({
        messages: [],
        isLoading: false,
        currentJobId: null,
    });

    let saveTimeout: ReturnType<typeof setTimeout> | null = null;

    /**
     * Debounced persistence to history entry
     */
    function debouncedSave() {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            const state = get({ subscribe });
            if (!state.currentJobId || state.messages.length === 0) return;

            try {
                const entry = await getHistoryEntry(state.currentJobId);
                if (entry) {
                    entry.chatHistory = state.messages;
                    await updateHistoryEntry(entry);
                    console.log('[ChatStore] Saved chat history for', state.currentJobId);
                }
            } catch (e) {
                console.error('[ChatStore] Failed to save chat history:', e);
            }
        }, 2000);
    }

    return {
        subscribe,

        /**
         * Initialize chat for a specific job. Restores from history if available.
         */
        initForJob: async (jobId: string) => {
            // Clear any pending save for the previous job
            if (saveTimeout) clearTimeout(saveTimeout);

            try {
                const entry = await getHistoryEntry(jobId);
                const restoredMessages = entry?.chatHistory || [];
                set({
                    messages: restoredMessages,
                    isLoading: false,
                    currentJobId: jobId,
                });
                if (restoredMessages.length > 0) {
                    console.log('[ChatStore] Restored', restoredMessages.length, 'messages for', jobId);
                }
            } catch (e) {
                console.error('[ChatStore] Failed to load chat history:', e);
                set({ messages: [], isLoading: false, currentJobId: jobId });
            }
        },

        /**
         * Add a user message to the conversation.
         */
        addUserMessage: (content: string) => {
            const message: ChatMessage = {
                id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                role: 'user',
                content,
                timestamp: new Date().toISOString(),
            };
            update(s => ({ ...s, messages: [...s.messages, message], isLoading: true }));
        },

        /**
         * Add an assistant response and persist.
         */
        addAssistantMessage: (content: string) => {
            const message: ChatMessage = {
                id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                role: 'assistant',
                content,
                timestamp: new Date().toISOString(),
            };
            update(s => ({ ...s, messages: [...s.messages, message], isLoading: false }));
            debouncedSave();
        },

        /**
         * Set loading state (for error recovery).
         */
        setLoading: (loading: boolean) => {
            update(s => ({ ...s, isLoading: loading }));
        },

        /**
         * Clear chat for current job.
         */
        clearChat: () => {
            update(s => ({ ...s, messages: [] }));
            debouncedSave();
        },

        /**
         * Reset the store entirely.
         */
        reset: () => {
            if (saveTimeout) clearTimeout(saveTimeout);
            set({ messages: [], isLoading: false, currentJobId: null });
        },
    };
}

export const chatStore = createChatStore();
