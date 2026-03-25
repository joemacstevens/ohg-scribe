// src/lib/services/presets.ts
// Service for storing and retrieving boost word presets

export interface BoostWordPreset {
    id: string;
    name: string;
    words: string[];
    createdAt: string;
}

// Save a new preset
export async function savePreset(preset: BoostWordPreset): Promise<void> {
    console.log('Saving preset:', preset.name);
    const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: preset.name, options: preset })
    });
    if (!res.ok) throw new Error(`Failed to save preset: ${res.statusText}`);
}

// Get all presets
export async function getPresets(): Promise<BoostWordPreset[]> {
    const res = await fetch('/api/presets');
    if (!res.ok) throw new Error(`Failed to load presets: ${res.statusText}`);
    const list = await res.json();
    // Backend stores the full preset object in options
    return list.map((p: { id: string; name: string; options: BoostWordPreset }) =>
        p.options || { id: p.id, name: p.name, words: [], createdAt: '' }
    );
}

// Delete a preset
export async function deletePreset(id: string): Promise<void> {
    const res = await fetch(`/api/presets/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete preset: ${res.statusText}`);
}

// Generate a unique ID for new presets
export function generatePresetId(): string {
    return `preset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

// Create a new preset from words
export function createPreset(name: string, words: string[]): BoostWordPreset {
    return {
        id: generatePresetId(),
        name: name.trim(),
        words: words.filter(w => w.trim()),
        createdAt: new Date().toISOString()
    };
}
