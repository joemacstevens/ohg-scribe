<script lang="ts">
    import { optionsStore } from "$lib/stores/options";
    import type { SpeakerLabelMode } from "$lib/types";

    // Local state synced with store
    let identifySpeakers = $state(true);
    let labelMode = $state<"generic" | "roles" | "names">("generic");
    let selectedRole = $state<"interview" | "podcast" | "panel">("interview");
    let namesInput = $state("");
    let isInitialized = false;

    // Subscribe to store - only sync on initial load
    optionsStore.subscribe((value) => {
        // Only sync on first subscription call
        if (!isInitialized) {
            isInitialized = true;
            const mode = value.speakerLabelMode;
            if (
                mode === "interview" ||
                mode === "podcast" ||
                mode === "panel"
            ) {
                labelMode = "roles";
                selectedRole = mode;
            } else if (mode === "known-names" || mode === "auto-names") {
                labelMode = "names";
            } else {
                labelMode = "generic";
            }
            namesInput = value.speakerNamesInput || "";
        }
    });

    // Update store when UI changes
    function updateStore() {
        let speakerLabelMode: SpeakerLabelMode;

        if (!identifySpeakers) {
            // When speakers off, use generic (backend will still diarize but no special labeling)
            speakerLabelMode = "generic";
        } else if (labelMode === "generic") {
            speakerLabelMode = "generic";
        } else if (labelMode === "roles") {
            speakerLabelMode = selectedRole;
        } else {
            speakerLabelMode = "known-names";
        }

        optionsStore.update({
            speakerLabelMode,
            speakerNamesInput: labelMode === "names" ? namesInput : "",
        });
    }

    function handleToggle() {
        identifySpeakers = !identifySpeakers;
        updateStore();
    }

    function handleLabelModeChange(mode: "generic" | "roles" | "names") {
        labelMode = mode;
        updateStore();
    }

    function handleRoleChange(e: Event) {
        selectedRole = (e.target as HTMLSelectElement).value as
            | "interview"
            | "podcast"
            | "panel";
        updateStore();
    }

    function handleNamesChange(e: Event) {
        namesInput = (e.target as HTMLInputElement).value;
        updateStore();
    }
</script>

<div class="speaker-controls">
    <div class="toggle-row">
        <span class="toggle-label">Identify Speakers</span>
        <button
            class="toggle"
            class:active={identifySpeakers}
            onclick={handleToggle}
            role="switch"
            aria-checked={identifySpeakers}
        >
            <span class="toggle-thumb"></span>
        </button>
    </div>

    {#if identifySpeakers}
        <div class="label-section">
            <span class="section-label">Label as:</span>
            <div class="pill-group">
                <button
                    class="pill"
                    class:selected={labelMode === "generic"}
                    onclick={() => handleLabelModeChange("generic")}
                >
                    Speaker 1, 2...
                </button>
                <button
                    class="pill"
                    class:selected={labelMode === "roles"}
                    onclick={() => handleLabelModeChange("roles")}
                >
                    Roles
                </button>
                <button
                    class="pill"
                    class:selected={labelMode === "names"}
                    onclick={() => handleLabelModeChange("names")}
                >
                    Names
                </button>
            </div>
        </div>

        {#if labelMode === "roles"}
            <div class="expansion">
                <select
                    class="role-select"
                    value={selectedRole}
                    onchange={handleRoleChange}
                >
                    <option value="interview"
                        >Interview (Interviewer / Interviewee)</option
                    >
                    <option value="podcast">Podcast (Host / Guest)</option>
                    <option value="panel">Panel (Moderator / Panelist)</option>
                </select>
            </div>
        {/if}

        {#if labelMode === "names"}
            <div class="expansion">
                <input
                    type="text"
                    class="names-input"
                    placeholder="e.g. John, Sarah, Dr. Smith"
                    value={namesInput}
                    oninput={handleNamesChange}
                />
                <span class="input-hint">Separate names with commas</span>
            </div>
        {/if}
    {/if}
</div>

<style>
    .speaker-controls {
        background: var(--white);
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .toggle-label {
        font-size: 14px;
        font-weight: 600;
        color: var(--navy);
    }

    .toggle {
        width: 44px;
        height: 24px;
        background: var(--lavender-dark, #e8e0f0);
        border: 1px solid var(--gray-300, #d1d5db);
        border-radius: 12px;
        cursor: pointer;
        position: relative;
        transition:
            background 0.2s,
            border-color 0.2s;
    }

    .toggle.active {
        background: var(--magenta);
        border-color: var(--magenta);
    }

    .toggle-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 20px;
        height: 20px;
        background: white;
        border-radius: 50%;
        transition: transform 0.2s;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    .toggle.active .toggle-thumb {
        transform: translateX(20px);
    }

    .label-section {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
    }

    .section-label {
        font-size: 13px;
        color: var(--gray-600);
    }

    .pill-group {
        display: flex;
        gap: 6px;
    }

    .pill {
        padding: 6px 12px;
        font-size: 13px;
        border: 1px solid var(--lavender-dark);
        background: var(--white);
        border-radius: 16px;
        cursor: pointer;
        color: var(--gray-600);
        transition: all 0.15s;
    }

    .pill:hover {
        border-color: var(--magenta);
        color: var(--magenta);
    }

    .pill.selected {
        background: var(--magenta);
        border-color: var(--magenta);
        color: white;
    }

    .expansion {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .role-select {
        padding: 10px 12px;
        font-size: 13px;
        border: 1px solid var(--lavender-dark);
        border-radius: 8px;
        background: var(--white);
        color: var(--navy);
        cursor: pointer;
    }

    .role-select:focus {
        outline: none;
        border-color: var(--magenta);
    }

    .names-input {
        padding: 10px 12px;
        font-size: 13px;
        border: 1px solid var(--lavender-dark);
        border-radius: 8px;
        background: var(--white);
        color: var(--navy);
    }

    .names-input:focus {
        outline: none;
        border-color: var(--magenta);
    }

    .names-input::placeholder {
        color: var(--gray-400);
    }

    .input-hint {
        font-size: 11px;
        color: var(--gray-500);
    }
</style>
