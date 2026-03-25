// src/lib/stores/vocabulary.ts
import { writable, get } from 'svelte/store';
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
                const res = await fetch('/api/vocabularies');
                if (!res.ok) throw new Error(`Failed to load vocabularies: ${res.statusText}`);
                const data: VocabularyData = await res.json();
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
                if (vocab) terms.push(...vocab.terms);
            });
            return [...new Set(terms)];
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
            const res = await fetch('/api/vocabularies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, category_id: category, terms })
            });
            if (!res.ok) throw new Error(`Failed to create vocabulary: ${res.statusText}`);
            const newVocab: Vocabulary = await res.json();
            update(s => ({ ...s, vocabularies: [...s.vocabularies, newVocab] }));
            return newVocab;
        },

        // Update an existing vocabulary
        async updateVocab(id: string, updates: { name?: string; category?: string; terms?: string[] }): Promise<Vocabulary> {
            const res = await fetch(`/api/vocabularies/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: updates.name,
                    category_id: updates.category,
                    terms: updates.terms
                })
            });
            if (!res.ok) throw new Error(`Failed to update vocabulary: ${res.statusText}`);
            const updated: Vocabulary = await res.json();
            update(s => ({
                ...s,
                vocabularies: s.vocabularies.map(v => v.id === id ? updated : v)
            }));
            return updated;
        },

        // Delete a vocabulary
        async delete(id: string): Promise<void> {
            const res = await fetch(`/api/vocabularies/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(`Failed to delete vocabulary: ${res.statusText}`);
            update(s => ({
                ...s,
                vocabularies: s.vocabularies.filter(v => v.id !== id)
            }));
        },

        // Duplicate a system vocabulary to user vocabularies
        async duplicate(id: string, newName: string): Promise<Vocabulary> {
            const res = await fetch(`/api/vocabularies/${id}/duplicate`, { method: 'POST' });
            if (!res.ok) throw new Error(`Failed to duplicate vocabulary: ${res.statusText}`);
            const duplicated: Vocabulary = await res.json();
            update(s => ({ ...s, vocabularies: [...s.vocabularies, duplicated] }));
            return duplicated;
        },

        // Create a new category
        async createCategory(name: string): Promise<VocabularyCategory> {
            const res = await fetch('/api/vocabularies/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (!res.ok) throw new Error(`Failed to create category: ${res.statusText}`);
            const category: VocabularyCategory = await res.json();
            update(s => ({ ...s, categories: [...s.categories, category] }));
            return category;
        },

        // Export all user vocabularies as JSON
        async exportAll(): Promise<string> {
            const res = await fetch('/api/vocabularies/export');
            if (!res.ok) throw new Error(`Failed to export vocabularies: ${res.statusText}`);
            const data = await res.json();
            return JSON.stringify(data);
        },

        // Import vocabularies from JSON
        async importVocabs(json: string): Promise<number> {
            const parsed = JSON.parse(json);
            const res = await fetch('/api/vocabularies/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed)
            });
            if (!res.ok) throw new Error(`Failed to import vocabularies: ${res.statusText}`);
            const data = await res.json();
            await this.load();
            return data.imported;
        }
    };
}

export const vocabularyStore = createVocabularyStore();
