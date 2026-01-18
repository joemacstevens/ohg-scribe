// src/lib/stores/vocabulary.ts
import { writable, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import type { Vocabulary, VocabularyCategory, VocabularyState, VocabularyData } from '../types/vocabulary';

function createVocabularyStore() {
    const { subscribe, set, update } = writable<VocabularyState>({
        categories: [],
        vocabularies: [],
        loading: true,
        error: null
    });

    return {
        subscribe,

        // Load all vocabularies (system + user) on app start
        async load() {
            update(s => ({ ...s, loading: true, error: null }));
            try {
                const data = await invoke<VocabularyData>('load_vocabularies');
                set({
                    categories: data.categories,
                    vocabularies: data.vocabularies,
                    loading: false,
                    error: null
                });
            } catch (e) {
                update(s => ({
                    ...s,
                    loading: false,
                    error: e instanceof Error ? e.message : String(e)
                }));
            }
        },

        // Get a specific vocabulary by ID
        getPreset(id: string): Vocabulary | undefined {
            const state = get({ subscribe });
            return state.vocabularies.find(v => v.id === id);
        },

        // Get all terms for selected preset IDs (merged, deduplicated)
        getTermsForPresets(ids: string[]): string[] {
            const state = get({ subscribe });
            const terms: string[] = [];

            ids.forEach(id => {
                const vocab = state.vocabularies.find(v => v.id === id);
                if (vocab) {
                    terms.push(...vocab.terms);
                }
            });

            return [...new Set(terms)]; // Deduplicate
        },

        // Search vocabularies by name
        search(query: string): Vocabulary[] {
            const state = get({ subscribe });
            const lowerQuery = query.toLowerCase();
            return state.vocabularies.filter(v =>
                v.name.toLowerCase().includes(lowerQuery)
            );
        },

        // Get vocabularies grouped by category
        getByCategory(): Map<VocabularyCategory, Vocabulary[]> {
            const state = get({ subscribe });
            const result = new Map<VocabularyCategory, Vocabulary[]>();

            for (const category of state.categories) {
                const vocabs = state.vocabularies.filter(v => v.category === category.id);
                result.set(category, vocabs);
            }

            return result;
        },

        // Create a new vocabulary
        async create(name: string, category: string, terms: string[]): Promise<Vocabulary> {
            const newVocab = await invoke<Vocabulary>('create_vocabulary', { name, category, terms });
            update(s => ({
                ...s,
                vocabularies: [...s.vocabularies, newVocab]
            }));
            return newVocab;
        },

        // Update an existing vocabulary
        async updateVocab(id: string, updates: { name?: string; category?: string; terms?: string[] }): Promise<Vocabulary> {
            const updated = await invoke<Vocabulary>('update_vocabulary', { id, ...updates });
            update(s => ({
                ...s,
                vocabularies: s.vocabularies.map(v => v.id === id ? updated : v)
            }));
            return updated;
        },

        // Delete a vocabulary
        async delete(id: string): Promise<void> {
            await invoke('delete_vocabulary', { id });
            update(s => ({
                ...s,
                vocabularies: s.vocabularies.filter(v => v.id !== id)
            }));
        },

        // Duplicate a system vocabulary to user vocabularies
        async duplicate(id: string, newName: string): Promise<Vocabulary> {
            const duplicated = await invoke<Vocabulary>('duplicate_vocabulary', { id, newName });
            update(s => ({
                ...s,
                vocabularies: [...s.vocabularies, duplicated]
            }));
            return duplicated;
        },

        // Create a new category
        async createCategory(name: string): Promise<VocabularyCategory> {
            const category = await invoke<VocabularyCategory>('create_vocabulary_category', { name });
            update(s => ({
                ...s,
                categories: [...s.categories, category]
            }));
            return category;
        },

        // Export all user vocabularies as JSON
        async exportAll(): Promise<string> {
            return await invoke<string>('export_vocabularies');
        },

        // Import vocabularies from JSON
        async importVocabs(json: string): Promise<number> {
            const count = await invoke<number>('import_vocabularies', { json });
            await this.load(); // Reload to get fresh data
            return count;
        }
    };
}

export const vocabularyStore = createVocabularyStore();
