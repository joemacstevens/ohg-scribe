// src/lib/types/vocabulary.ts

export interface Vocabulary {
    id: string;
    name: string;
    category: string;
    terms: string[];
    isSystem: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface VocabularyCategory {
    id: string;
    name: string;
    isSystem: boolean;
}

export interface VocabularyState {
    categories: VocabularyCategory[];
    vocabularies: Vocabulary[];
    loading: boolean;
    error: string | null;
}

// Rust command response types
export interface VocabularyData {
    categories: VocabularyCategory[];
    vocabularies: Vocabulary[];
}
