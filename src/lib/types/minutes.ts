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

// Data constants have been moved to $lib/data/templates.ts and $lib/data/personas.ts
