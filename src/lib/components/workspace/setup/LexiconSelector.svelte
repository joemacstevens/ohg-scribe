<script lang="ts">
    import type { Lexicon } from "$lib/types/minutes";
    import SEMAGLUTIDE_LEXICON from "$lib/data/lexicons/semaglutide.json";

    // Create a "None" option with empty rules
    const NONE_LEXICON: Lexicon = {
        source: "None (No terminology enforcement)",
        rules: [],
    };

    const DEFAULT_LEXICONS: Lexicon[] = [
        SEMAGLUTIDE_LEXICON as Lexicon,
        NONE_LEXICON,
    ];

    let {
        selected = $bindable(),
        lexicons = DEFAULT_LEXICONS,
    }: {
        selected: Lexicon | null;
        lexicons?: Lexicon[];
    } = $props();
</script>

<div class="lexicon-selector">
    <label class="section-label">Therapeutic Area</label>
    <select bind:value={selected} class="lexicon-select">
        {#each lexicons as lexicon}
            <option value={lexicon}>{lexicon.source}</option>
        {/each}
    </select>
    {#if selected && selected.rules.length > 0}
        <p class="lexicon-preview">
            {selected.rules.length} terminology rules active
        </p>
    {/if}
</div>

<style>
    .lexicon-selector {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .section-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--navy);
    }

    .lexicon-select {
        width: 100%;
        padding: 10px;
        border-radius: 8px;
        border: 1px solid var(--gray-300);
        background: white;
        font-size: 14px;
        color: var(--navy);
    }

    .lexicon-preview {
        margin: 0;
        font-size: 12px;
        color: var(--gray-500);
        font-style: italic;
    }
</style>
