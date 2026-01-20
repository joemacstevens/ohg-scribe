<script lang="ts">
    import type { TranscriptSegment } from "$lib/types";

    interface Props {
        segments: TranscriptSegment[];
        aiInferredSpeakers: string[];
        onSave: (renames: Record<string, string>) => void;
        onClose: () => void;
    }

    let { segments, aiInferredSpeakers, onSave, onClose }: Props = $props();

    // Build speaker list with utterance counts
    const speakerData = $derived(() => {
        const counts: Record<string, number> = {};
        for (const segment of segments) {
            counts[segment.speaker] = (counts[segment.speaker] || 0) + 1;
        }
        return Object.entries(counts).map(([name, count]) => ({
            originalName: name,
            newName: name,
            count,
            isAiInferred: aiInferredSpeakers.includes(name),
        }));
    });

    let editedSpeakers = $state<
        {
            originalName: string;
            newName: string;
            count: number;
            isAiInferred: boolean;
        }[]
    >([]);

    // Initialize on mount
    $effect(() => {
        editedSpeakers = speakerData();
    });

    function handleSave() {
        const renames: Record<string, string> = {};
        for (const speaker of editedSpeakers) {
            if (
                speaker.originalName !== speaker.newName &&
                speaker.newName.trim()
            ) {
                renames[speaker.originalName] = speaker.newName.trim();
            }
        }
        onSave(renames);
    }

    function handleBackdropClick(event: MouseEvent) {
        if (event.target === event.currentTarget) {
            onClose();
        }
    }
</script>

<div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    role="dialog"
    aria-modal="true"
>
    <div class="modal">
        <header class="modal-header">
            <h2>Edit Speaker Names</h2>
            <button class="close-btn" onclick={onClose} aria-label="Close"
                >×</button
            >
        </header>

        <div class="modal-body">
            <p class="hint">
                Rename speakers to update all occurrences throughout the
                transcript.
            </p>

            <div class="speaker-list">
                {#each editedSpeakers as speaker, i}
                    <div class="speaker-row">
                        <input
                            type="text"
                            class="speaker-input"
                            bind:value={editedSpeakers[i].newName}
                            placeholder="Speaker name"
                        />
                        <span class="count"
                            >{speaker.count} utterance{speaker.count === 1
                                ? ""
                                : "s"}</span
                        >
                        {#if speaker.isAiInferred}
                            <span class="ai-tag" title="AI-inferred name"
                                >✨ AI</span
                            >
                        {/if}
                    </div>
                {/each}
            </div>
        </div>

        <footer class="modal-footer">
            <button class="cancel-btn" onclick={onClose}>Cancel</button>
            <button class="save-btn" onclick={handleSave}>Save All</button>
        </footer>
    </div>
</div>

<style>
    .modal-backdrop {
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

    .modal {
        background: var(--white, #ffffff);
        border-radius: 16px;
        width: 90%;
        max-width: 480px;
        max-height: 80vh;
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

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        border-bottom: 1px solid var(--lavender-dark, #e8e0f0);
    }

    .modal-header h2 {
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

    .close-btn:hover {
        background: var(--lavender-light, #f8f5fa);
        color: var(--gray-600, #4b5563);
    }

    .modal-body {
        padding: 20px 24px;
        overflow-y: auto;
        flex: 1;
    }

    .hint {
        font-size: 14px;
        color: var(--gray-600, #4b5563);
        margin: 0 0 16px;
    }

    .speaker-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .speaker-row {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .speaker-input {
        flex: 1;
        padding: 10px 12px;
        font-size: 14px;
        border: 1px solid var(--lavender-dark, #e8e0f0);
        border-radius: 8px;
        color: var(--navy, #1a2b4a);
    }

    .speaker-input:focus {
        outline: none;
        border-color: var(--magenta, #e91388);
        box-shadow: 0 0 0 2px rgba(233, 19, 136, 0.1);
    }

    .count {
        font-size: 12px;
        color: var(--gray-500, #6b7280);
        white-space: nowrap;
    }

    .ai-tag {
        font-size: 11px;
        color: var(--purple, #6b2d7b);
        background: var(--lavender-light, #f8f5fa);
        padding: 2px 6px;
        border-radius: 4px;
        white-space: nowrap;
    }

    .modal-footer {
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

    .cancel-btn:hover {
        background: var(--lavender-light, #f8f5fa);
    }

    .save-btn {
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

    .save-btn:hover {
        box-shadow: 0 4px 12px rgba(233, 19, 136, 0.3);
    }
</style>
