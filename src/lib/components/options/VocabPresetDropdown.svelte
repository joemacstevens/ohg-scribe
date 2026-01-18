<script lang="ts">
    import { vocabularyStore } from "$lib/stores/vocabulary";
    import { onMount } from "svelte";
    import type { Vocabulary, VocabularyCategory } from "$lib/types/vocabulary";

    interface Props {
        selectedPresets: string[];
        onPresetsChange: (presets: string[]) => void;
        onOpenManager?: () => void;
    }

    let { selectedPresets, onPresetsChange, onOpenManager }: Props = $props();

    let isOpen = $state(false);
    let searchQuery = $state("");
    let dropdownRef: HTMLDivElement;

    // Load vocabularies on mount
    onMount(() => {
        vocabularyStore.load();

        // Click outside handler
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
                isOpen = false;
            }
        }

        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    });

    // Get filtered vocabularies based on search
    function getFilteredVocabs(): Map<VocabularyCategory, Vocabulary[]> {
        const byCategory = vocabularyStore.getByCategory();
        if (!searchQuery) return byCategory;

        const lowerQuery = searchQuery.toLowerCase();
        const result = new Map<VocabularyCategory, Vocabulary[]>();

        for (const [category, vocabs] of byCategory) {
            const filtered = vocabs.filter((v) =>
                v.name.toLowerCase().includes(lowerQuery),
            );
            if (filtered.length > 0) {
                result.set(category, filtered);
            }
        }

        return result;
    }

    function togglePreset(id: string) {
        if (selectedPresets.includes(id)) {
            onPresetsChange(selectedPresets.filter((p) => p !== id));
        } else {
            onPresetsChange([...selectedPresets, id]);
        }
    }

    function handleOpenManager() {
        isOpen = false;
        onOpenManager?.();
    }

    $effect(() => {
        // Re-render when store updates
        $vocabularyStore;
    });
</script>

<div class="preset-dropdown" bind:this={dropdownRef}>
    <button class="preset-btn" onclick={() => (isOpen = !isOpen)}>
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        Disease Areas
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2">
            <polyline points="6 9 12 15 18 9" />
        </svg>
    </button>

    {#if isOpen}
        <div class="preset-menu">
            <div class="preset-menu-header">
                <div class="preset-menu-title">Disease Area Vocabularies</div>
                <input
                    type="text"
                    class="preset-menu-search"
                    placeholder="Search..."
                    bind:value={searchQuery}
                />
            </div>
            <div class="preset-menu-list">
                {#if $vocabularyStore.loading}
                    <div class="preset-loading">Loading vocabularies...</div>
                {:else}
                    {#each [...getFilteredVocabs()] as [category, vocabs]}
                        <div class="preset-category">{category.name}</div>
                        {#each vocabs as vocab}
                            <div
                                class="preset-item"
                                class:selected={selectedPresets.includes(
                                    vocab.id,
                                )}
                                onclick={() => togglePreset(vocab.id)}
                                role="option"
                                aria-selected={selectedPresets.includes(
                                    vocab.id,
                                )}
                            >
                                <span>{vocab.name}</span>
                                {#if selectedPresets.includes(vocab.id)}
                                    <svg
                                        class="check"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke-width="3"
                                    >
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                {:else}
                                    <span class="preset-count"
                                        >{vocab.terms.length} terms</span
                                    >
                                {/if}
                            </div>
                        {/each}
                    {/each}
                {/if}
            </div>
            <div class="preset-menu-footer">
                <button class="manage-link" onclick={handleOpenManager}>
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2">
                        <circle cx="12" cy="12" r="3" />
                        <path
                            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                        />
                    </svg>
                    Manage vocabularies
                </button>
            </div>
        </div>
    {/if}
</div>

<style>
    .preset-dropdown {
        position: relative;
    }

    .preset-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        background: var(--lavender, #f0ebf5);
        border: 1px solid var(--lavender-dark, #e8e0f0);
        border-radius: 8px;
        font-size: 12px;
        font-weight: 500;
        color: var(--purple, #6b2d7b);
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
    }

    .preset-btn:hover {
        background: var(--lavender-dark, #e8e0f0);
    }

    .preset-btn svg {
        width: 14px;
        height: 14px;
        stroke: var(--purple, #6b2d7b);
    }

    .preset-menu {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        width: 260px;
        background: white;
        border: 1px solid var(--gray-200, #e5e7eb);
        border-radius: 10px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
        z-index: 100;
        overflow: hidden;
    }

    .preset-menu-header {
        padding: 12px 14px;
        background: var(--lavender-light, #f8f5fa);
        border-bottom: 1px solid var(--gray-200, #e5e7eb);
    }

    .preset-menu-title {
        font-size: 11px;
        font-weight: 600;
        color: var(--navy, #1a2b4a);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .preset-menu-search {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid var(--gray-200, #e5e7eb);
        border-radius: 6px;
        font-size: 12px;
        margin-top: 8px;
        background: white;
    }

    .preset-menu-search:focus {
        outline: none;
        border-color: var(--magenta, #e91388);
    }

    .preset-menu-list {
        max-height: 280px;
        overflow-y: auto;
    }

    .preset-loading {
        padding: 16px;
        text-align: center;
        color: var(--gray-400, #9ca3af);
        font-size: 13px;
    }

    .preset-category {
        padding: 8px 14px 4px;
        font-size: 10px;
        font-weight: 600;
        color: var(--gray-400, #9ca3af);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .preset-item {
        padding: 10px 14px;
        font-size: 13px;
        color: var(--navy, #1a2b4a);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        transition: background 0.15s;
    }

    .preset-item:hover {
        background: var(--lavender-light, #f8f5fa);
    }

    .preset-item.selected {
        background: linear-gradient(
            135deg,
            rgba(233, 19, 136, 0.08) 0%,
            rgba(107, 45, 123, 0.08) 100%
        );
        color: var(--magenta, #e91388);
    }

    .preset-item .check {
        width: 16px;
        height: 16px;
        stroke: var(--magenta, #e91388);
    }

    .preset-count {
        font-size: 10px;
        color: var(--gray-400, #9ca3af);
        background: var(--gray-100, #f9fafb);
        padding: 2px 6px;
        border-radius: 4px;
    }

    .preset-item.selected .preset-count {
        background: rgba(233, 19, 136, 0.15);
        color: var(--magenta, #e91388);
    }

    .preset-menu-footer {
        padding: 10px 14px;
        border-top: 1px solid var(--gray-200, #e5e7eb);
        background: var(--gray-100, #f9fafb);
    }

    .manage-link {
        font-size: 12px;
        color: var(--purple, #6b2d7b);
        background: none;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0;
    }

    .manage-link:hover {
        color: var(--magenta, #e91388);
    }

    .manage-link svg {
        width: 14px;
        height: 14px;
        stroke: currentColor;
    }
</style>
