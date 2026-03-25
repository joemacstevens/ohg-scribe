<script lang="ts">
    import type { HistoryEntry } from "$lib/services/history";

    interface Props {
        entry: HistoryEntry;
        onRefine: (options: RefineOptions) => Promise<void>;
        onClose: () => void;
        isRefining?: boolean;
        refineProgress?: string;
    }

    export interface RefineOptions {
        speakerCount: number | "auto";
        boostWords: string[];
        speakerLabelMode: string;
    }

    let {
        entry,
        onRefine,
        onClose,
        isRefining = false,
        refineProgress = "",
    }: Props = $props();

    // Refinement options
    let speakerCount = $state<number | "auto">("auto");
    let speakerCountValue = $state(4);
    let useAutoSpeakers = $state(true);
    let boostWordsInput = $state("");
    let speakerLabelMode = $state<"generic" | "auto-names">("generic");
    // Use prop value for refining state
    let localRefining = $state(false);
    const refiningActive = $derived(isRefining || localRefining);

    // Initialize with current entry's detected speaker count
    $effect(() => {
        speakerCountValue = entry.speakerCount || 4;
    });

    async function handleRefine() {
        localRefining = true;
        try {
            await onRefine({
                speakerCount: useAutoSpeakers ? "auto" : speakerCountValue,
                boostWords: boostWordsInput
                    .split(",")
                    .map((w) => w.trim())
                    .filter((w) => w.length > 0),
                speakerLabelMode,
            });
        } finally {
            localRefining = false;
        }
    }

    function handleBackdropClick(event: MouseEvent) {
        if (event.target === event.currentTarget && !refiningActive) {
            onClose();
        }
    }
</script>

<div
    class="panel-backdrop"
    onclick={handleBackdropClick}
    role="dialog"
    aria-modal="true"
>
    <div class="panel">
        <header class="panel-header">
            <h2>⚙️ Refine Transcript</h2>
            <button
                class="close-btn"
                onclick={onClose}
                disabled={refiningActive}
                aria-label="Close">×</button
            >
        </header>

        <div class="panel-body">
            <div class="warning-banner">
                <span class="warning-icon">⚠️</span>
                <span
                    >This will re-transcribe using the cached audio file. API
                    credits will be used.</span
                >
            </div>

            <div class="option-group">
                <label class="option-label">Speaker Count</label>
                <p class="option-hint">
                    Adjust if the AI detected the wrong number of speakers
                </p>

                <div class="toggle-row">
                    <label class="checkbox-label">
                        <input type="checkbox" bind:checked={useAutoSpeakers} />
                        Auto-detect (1-10 speakers)
                    </label>
                </div>

                {#if !useAutoSpeakers}
                    <div class="slider-row">
                        <input
                            type="range"
                            min="1"
                            max="20"
                            bind:value={speakerCountValue}
                            class="slider"
                        />
                        <span class="slider-value">{speakerCountValue}</span>
                    </div>
                {/if}
            </div>

            <div class="option-group">
                <label class="option-label">Vocabulary Boost</label>
                <p class="option-hint">
                    Add words to improve recognition (drug names, acronyms,
                    etc.)
                </p>
                <input
                    type="text"
                    class="text-input"
                    placeholder="e.g. Keytruda, HCP, HEOR"
                    bind:value={boostWordsInput}
                />
            </div>

            <div class="option-group">
                <label class="option-label">Speaker Labels</label>
                <p class="option-hint">
                    How speakers should be labeled in the output
                </p>
                <div class="radio-group">
                    <label class="radio-label">
                        <input
                            type="radio"
                            bind:group={speakerLabelMode}
                            value="generic"
                        />
                        Generic (Speaker 1, Speaker 2...)
                    </label>
                    <label class="radio-label">
                        <input
                            type="radio"
                            bind:group={speakerLabelMode}
                            value="auto-names"
                        />
                        AI-infer names from conversation
                    </label>
                </div>
            </div>
        </div>

        {#if refiningActive && refineProgress}
            <div class="progress-bar">
                <div class="progress-indicator"></div>
                <span class="progress-text">{refineProgress}</span>
            </div>
        {/if}

        <footer class="panel-footer">
            <button
                class="cancel-btn"
                onclick={onClose}
                disabled={refiningActive}>Cancel</button
            >
            <button
                class="refine-btn"
                onclick={handleRefine}
                disabled={refiningActive}
            >
                {refiningActive
                    ? refineProgress || "Refining..."
                    : "🔄 Refine Transcript"}
            </button>
        </footer>
    </div>
</div>

<style>
    .panel-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        animation: fadeIn 0.15s ease-out;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    .panel {
        background: var(--white, #ffffff);
        border-radius: 16px;
        width: 90%;
        max-width: 520px;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.2s ease-out;
    }

    @keyframes slideUp {
        from {
            transform: translateY(20px);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }

    .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        border-bottom: 1px solid var(--lavender-dark, #e8e0f0);
    }

    .panel-header h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--navy, #1a2b4a);
    }

    .close-btn {
        background: none;
        border: none;
        font-size: 24px;
        color: var(--gray-400, #9ca3af);
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
    }

    .close-btn:hover:not(:disabled) {
        background: var(--lavender-light, #f8f5fa);
        color: var(--gray-600, #4b5563);
    }

    .close-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .panel-body {
        padding: 20px 24px;
        overflow-y: auto;
        flex: 1;
    }

    .warning-banner {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        background: #fef3c7;
        border: 1px solid #f59e0b;
        border-radius: 8px;
        padding: 12px 14px;
        margin-bottom: 20px;
        font-size: 13px;
        color: #92400e;
    }

    .warning-icon {
        flex-shrink: 0;
    }

    .option-group {
        margin-bottom: 24px;
    }

    .option-label {
        display: block;
        font-weight: 600;
        font-size: 14px;
        color: var(--navy, #1a2b4a);
        margin-bottom: 4px;
    }

    .option-hint {
        font-size: 13px;
        color: var(--gray-500, #6b7280);
        margin: 0 0 12px;
    }

    .toggle-row {
        margin-bottom: 12px;
    }

    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        color: var(--gray-700, #374151);
        cursor: pointer;
    }

    .checkbox-label input {
        width: 16px;
        height: 16px;
        accent-color: var(--magenta, #e91388);
    }

    .slider-row {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .slider {
        flex: 1;
        height: 6px;
        -webkit-appearance: none;
        appearance: none;
        background: var(--lavender-dark, #e8e0f0);
        border-radius: 3px;
        cursor: pointer;
    }

    .slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--magenta, #e91388);
        cursor: pointer;
    }

    .slider-value {
        font-weight: 600;
        font-size: 14px;
        color: var(--magenta, #e91388);
        min-width: 24px;
        text-align: center;
    }

    .text-input {
        width: 100%;
        padding: 10px 12px;
        font-size: 14px;
        border: 1px solid var(--lavender-dark, #e8e0f0);
        border-radius: 8px;
        color: var(--navy, #1a2b4a);
    }

    .text-input:focus {
        outline: none;
        border-color: var(--magenta, #e91388);
        box-shadow: 0 0 0 2px rgba(233, 19, 136, 0.1);
    }

    .radio-group {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .radio-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        color: var(--gray-700, #374151);
        cursor: pointer;
    }

    .radio-label input {
        width: 16px;
        height: 16px;
        accent-color: var(--magenta, #e91388);
    }

    .panel-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 24px;
        border-top: 1px solid var(--lavender-dark, #e8e0f0);
    }

    .cancel-btn {
        padding: 10px 20px;
        font-size: 14px;
        border: 1px solid var(--lavender-dark, #e8e0f0);
        background: var(--white, #ffffff);
        border-radius: 8px;
        cursor: pointer;
        color: var(--gray-600, #4b5563);
    }

    .cancel-btn:hover:not(:disabled) {
        background: var(--lavender-light, #f8f5fa);
    }

    .cancel-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .refine-btn {
        padding: 10px 20px;
        font-size: 14px;
        border: none;
        background: linear-gradient(
            135deg,
            var(--magenta, #e91388) 0%,
            var(--purple, #6b2d7b) 100%
        );
        color: white;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
    }

    .refine-btn:hover:not(:disabled) {
        box-shadow: 0 4px 12px rgba(233, 19, 136, 0.3);
    }

    .refine-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .progress-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 24px;
        background: linear-gradient(
            90deg,
            #f8f5fa 0%,
            #f0e8f5 50%,
            #f8f5fa 100%
        );
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        border-top: 1px solid var(--lavender-dark, #e8e0f0);
    }

    @keyframes shimmer {
        0% {
            background-position: 100% 0;
        }
        100% {
            background-position: -100% 0;
        }
    }

    .progress-indicator {
        width: 16px;
        height: 16px;
        border: 2px solid var(--lavender-dark, #e8e0f0);
        border-top-color: var(--magenta, #e91388);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .progress-text {
        font-size: 13px;
        color: var(--gray-600, #4b5563);
        font-weight: 500;
    }
</style>
