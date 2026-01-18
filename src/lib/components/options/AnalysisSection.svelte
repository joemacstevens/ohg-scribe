<script lang="ts">
    import ToggleSwitch from "./ToggleSwitch.svelte";

    interface Props {
        includeSummary: boolean;
        detectTopics: boolean;
        analyzeSentiment: boolean;
        extractKeyPhrases: boolean;
        onSummaryChange: (value: boolean) => void;
        onTopicsChange: (value: boolean) => void;
        onSentimentChange: (value: boolean) => void;
        onKeyPhrasesChange: (value: boolean) => void;
    }

    let {
        includeSummary = $bindable(),
        detectTopics = $bindable(),
        analyzeSentiment = $bindable(),
        extractKeyPhrases = $bindable(),
        onSummaryChange,
        onTopicsChange,
        onSentimentChange,
        onKeyPhrasesChange,
    }: Props = $props();
</script>

<div class="section">
    <div class="section-header">
        <div class="section-icon">
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke-width="2"
                stroke-linecap="round"
            >
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
        </div>
        <div>
            <div class="section-title">Analysis</div>
            <div class="section-subtitle">Extra processing on transcript</div>
        </div>
    </div>
    <div class="section-content">
        <div class="toggle-grid">
            <ToggleSwitch
                label="Summary"
                bind:checked={includeSummary}
                onchange={onSummaryChange}
            />
            <ToggleSwitch
                label="Topics"
                bind:checked={detectTopics}
                onchange={onTopicsChange}
            />
            <ToggleSwitch
                label="Sentiment"
                bind:checked={analyzeSentiment}
                onchange={onSentimentChange}
            />
            <ToggleSwitch
                label="Key phrases"
                bind:checked={extractKeyPhrases}
                onchange={onKeyPhrasesChange}
            />
        </div>
    </div>
</div>

<style>
    .section {
        padding: 16px 20px;
        border-bottom: 1px solid var(--gray-100, #f9fafb);
    }

    .section:last-child {
        border-bottom: none;
    }

    .section-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
    }

    .section-icon {
        width: 28px;
        height: 28px;
        background: var(--lavender, #f0ebf5);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .section-icon svg {
        width: 16px;
        height: 16px;
        stroke: var(--purple, #6b2d7b);
    }

    .section-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--navy, #1a2b4a);
    }

    .section-subtitle {
        font-size: 11px;
        color: var(--gray-400, #9ca3af);
        margin-top: 2px;
    }

    .section-content {
        margin-left: 38px;
    }

    .toggle-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
    }
</style>
