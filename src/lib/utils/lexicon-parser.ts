import type { TerminologyRule } from '$lib/types/minutes';
import Papa from 'papaparse';

interface SharePointLexiconRow {
    domain: string;
    sourceTerm: string;
    preferredTerm: string;
    acronym: string; // "FALSE" or the acronym string? Looking at CSV it has "FALSE" in 'firstUseExpand'? No, check columns.
    // CSV Cols: "domain","sourceTerm","preferredTerm","acronym","firstUseExpand","matchStrategy","terminologyToAvoid","sourceReference","isActive","version"
    firstUseExpand: string;
    matchStrategy: string;
    terminologyToAvoid: string;
    sourceReference: string;
    isActive: string;
    version: string;
}

export function parseLexiconCSV(csvContent: string): TerminologyRule[] {
    // 1. Clean up "ListSchema" preamble if present (SharePoint export artifact)
    let cleanCsv = csvContent;
    if (csvContent.trim().startsWith('ListSchema')) {
        const firstLineBreak = csvContent.indexOf('\n');
        if (firstLineBreak !== -1) {
            cleanCsv = csvContent.slice(firstLineBreak + 1);
        }
    }

    const { data } = Papa.parse<SharePointLexiconRow>(cleanCsv.trim(), {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim()
    });

    return data
        .filter(row => row.sourceTerm && row.preferredTerm && row.isActive !== 'FALSE')
        .map(row => {
            const rule: TerminologyRule = {
                category: row.domain || 'General',
                from: [row.sourceTerm], // The CSV has one source term per row, but our model supports multiple.
                to: row.preferredTerm
            };

            // Handle Acronyms
            // In CSV, 'acronym' field seems to contain the acronym if exists, or empty.
            if (row.acronym && row.acronym.trim()) {
                rule.acronym = row.acronym.trim();
            }

            // Handle "Terminology to Avoid" and convert to notes
            if (row.terminologyToAvoid && row.terminologyToAvoid.length > 2) {
                // Heuristic: if it looks like a real instruction
                rule.notes = `Avoid using: ${row.terminologyToAvoid}`;
            }

            return rule;
        });
}

/**
 * Merges rules that map to the same target term to consolidate 'from' arrays.
 */
export function consolidateRules(rules: TerminologyRule[]): TerminologyRule[] {
    const map = new Map<string, TerminologyRule>();

    for (const rule of rules) {
        // Key by the target term + category to avoid merging distinct concepts that happen to share a name (unlikely but safe)
        const key = `${rule.category}::${rule.to}`;

        if (map.has(key)) {
            const existing = map.get(key)!;
            // Merge 'from' terms
            existing.from = Array.from(new Set([...existing.from, ...rule.from]));

            // Merge acronyms (prefer one that exists)
            if (!existing.acronym && rule.acronym) existing.acronym = rule.acronym;

            // Merge notes
            if (rule.notes) {
                if (existing.notes && !existing.notes.includes(rule.notes)) {
                    existing.notes += ` | ${rule.notes}`;
                } else if (!existing.notes) {
                    existing.notes = rule.notes;
                }
            }
        } else {
            map.set(key, { ...rule });
        }
    }

    return Array.from(map.values());
}
