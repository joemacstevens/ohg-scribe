// src/lib/services/presets.ts
// Service for storing and retrieving boost word presets

import { invoke } from '@tauri-apps/api/core';

export interface BoostWordPreset {
    id: string;
    name: string;
    words: string[];
    createdAt: string;
}

// Save a new preset
export async function savePreset(preset: BoostWordPreset): Promise<void> {
    console.log('Saving preset:', preset.name);
    await invoke('save_preset', { preset: JSON.stringify(preset) });
}

// Get all presets
export async function getPresets(): Promise<BoostWordPreset[]> {
    const result = await invoke<string>('get_presets');
    return JSON.parse(result);
}

// Delete a preset
export async function deletePreset(id: string): Promise<void> {
    await invoke('delete_preset', { id });
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
