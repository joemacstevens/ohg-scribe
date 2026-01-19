<script lang="ts">
    import type { ConversationType } from "$lib/types";
    import { CONVERSATION_TYPE_LABELS } from "$lib/types";

    interface Props {
        speakerCount: "auto" | number;
        conversationType: ConversationType;
        speakerNames: string;
        onSpeakerCountChange: (value: "auto" | number) => void;
        onConversationTypeChange: (value: ConversationType) => void;
        onSpeakerNamesChange: (value: string) => void;
    }

    let {
        speakerCount,
        conversationType,
        speakerNames,
        onSpeakerCountChange,
        onConversationTypeChange,
        onSpeakerNamesChange,
    }: Props = $props();

    function handleSpeakerCountChange(e: Event) {
        const value = (e.target as HTMLSelectElement).value;
        onSpeakerCountChange(value === "auto" ? "auto" : parseInt(value));
    }

    function handleConversationTypeChange(e: Event) {
        const value = (e.target as HTMLSelectElement).value as ConversationType;
        onConversationTypeChange(value);
    }

    function handleSpeakerNamesChange(e: Event) {
        const value = (e.target as HTMLInputElement).value;
        onSpeakerNamesChange(value);
    }
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
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        </div>
        <div class="section-title">Speakers</div>
    </div>
    <div class="section-content">
        <div class="input-row">
            <div class="input-group small">
                <label class="input-label" for="speaker-count">Count</label>
                <select
                    id="speaker-count"
                    class="new-select"
                    value={speakerCount}
                    onchange={handleSpeakerCountChange}
                >
                    <option value="auto">Auto</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5+</option>
                </select>
            </div>
            <div class="input-group">
                <label class="input-label" for="conversation-type"
                    >Conversation type</label
                >
                <select
                    id="conversation-type"
                    class="new-select"
                    value={conversationType}
                    onchange={handleConversationTypeChange}
                >
                    {#each Object.entries(CONVERSATION_TYPE_LABELS) as [value, label]}
                        <option {value}>{label}</option>
                    {/each}
                </select>
            </div>
        </div>
        <div class="input-row">
            <div class="input-group">
                <label class="input-label" for="speaker-names"
                    >Speaker names (optional)</label
                >
                <input
                    type="text"
                    id="speaker-names"
                    class="new-input"
                    placeholder="Dr. Smith, Lindsay, Kate"
                    value={speakerNames}
                    oninput={handleSpeakerNamesChange}
                />
            </div>
        </div>

        <div class="inline-help">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
            </svg>
            <p>
                Setting the exact speaker count improves identification
                accuracy. Add names in speaking order to label speakers in the
                transcript.
            </p>
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

    .section-content {
        margin-left: 38px;
    }

    .input-row {
        display: flex;
        gap: 12px;
        margin-bottom: 12px;
    }

    .input-row:last-child {
        margin-bottom: 0;
    }

    .input-group {
        flex: 1;
    }

    .input-group.small {
        flex: 0 0 100px;
    }

    .input-label {
        font-size: 11px;
        color: var(--gray-500, #6b7280);
        margin-bottom: 4px;
        display: block;
    }

    .new-select,
    .new-input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--gray-200, #e5e7eb);
        border-radius: 8px;
        font-size: 13px;
        color: var(--navy, #1a2b4a);
        background: var(--gray-100, #f9fafb);
        transition: all 0.2s;
    }

    .new-select:focus,
    .new-input:focus {
        outline: none;
        border-color: var(--magenta, #e91388);
        background: white;
        box-shadow: 0 0 0 3px rgba(233, 19, 136, 0.1);
    }

    .new-input::placeholder {
        color: var(--gray-400, #9ca3af);
    }

    .inline-help {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 10px 12px;
        background: var(--lavender-light, #f8f5fa);
        border-radius: 8px;
        margin-top: 12px;
    }

    .inline-help svg {
        width: 14px;
        height: 14px;
        stroke: var(--purple, #6b2d7b);
        flex-shrink: 0;
        margin-top: 1px;
    }

    .inline-help p {
        font-size: 11px;
        color: var(--gray-500, #6b7280);
        line-height: 1.4;
        margin: 0;
    }
</style>
