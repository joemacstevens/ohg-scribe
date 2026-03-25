<script lang="ts">
    import type { Style } from "$lib/types/minutes";
    import { DEFAULT_STYLES } from "$lib/data/styles";

    let {
        selected = $bindable(),
        styles = DEFAULT_STYLES,
    }: {
        selected: Style;
        styles?: Style[];
    } = $props();

    function getStylePreview(style: Style): string {
        return `${style.voice.voice} voice, ${style.attribution.format}, decisions as "${style.decisions.vocabulary.approved}"`;
    }
</script>

<div class="style-selector">
    <label class="section-label">Client Style</label>
    <select bind:value={selected} class="style-select">
        {#each styles as style}
            <option value={style}>{style.name}</option>
        {/each}
    </select>
    {#if selected}
        <p class="style-preview">{getStylePreview(selected)}</p>
    {/if}
</div>

<style>
    .style-selector {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .section-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--navy);
    }

    .style-select {
        width: 100%;
        padding: 10px;
        border-radius: 8px;
        border: 1px solid var(--gray-300);
        background: white;
        font-size: 14px;
        color: var(--navy);
    }

    .style-preview {
        margin: 0;
        font-size: 12px;
        color: var(--gray-500);
        font-style: italic;
    }
</style>
