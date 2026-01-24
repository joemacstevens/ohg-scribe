export interface Template {
    id: string;
    name: string;
    description: string;
    icon: string; // visual icon identifier
    structure: string; // The markdown/HTML structure hint
    exampleOutput?: string; // One-shot example for the AI to mimic
}

export interface TerminologyRule {
    category: string;
    from: string[]; // Synonyms or source terms
    to: string;     // Preferred term
    acronym?: string; // Acronym to use after first mention
    notes?: string;   // Contextual hints
}

export interface Lexicon {
    source: string;
    rules: TerminologyRule[];
    editorialGuidelines?: string[];
}

export interface Persona {
    id: string;
    name: string;
    roleDefinition: string;
    toneDescription: string;
    formattingRules: string;
    lexicon?: Lexicon;
    isDefault?: boolean;
}

/**
 * Client-specific style conventions for output formatting.
 * Captures voice, attribution format, decision vocabulary, and Q&A structure.
 */
export interface Style {
    id: string;
    name: string;
    voice: {
        person: 'first' | 'third';
        voice: 'active' | 'passive';
    };
    attribution: {
        format: '4-char-initials' | 'first-initial-last' | 'full-name' | 'single-letter';
        unknownSpeaker: string;
    };
    decisions: {
        vocabulary: {
            approved: string;
            deferredToMeeting: string;
            deferredToEmail: string;
            notEndorsed: string;
        };
        forbiddenTerms: string[];
        formatting: 'bold_italic' | 'bold' | 'plain';
    };
    qanda: {
        nesting: boolean;
        indentStyle: 'dash' | 'bullet';
        preserveReasoning: boolean;
        verbs: {
            question: string;
            response: string;
        };
    };
    methodology: {
        summarization: 'none' | 'light' | 'standard';
    };
}

// Data constants have been moved to $lib/data/templates.ts and $lib/data/personas.ts
