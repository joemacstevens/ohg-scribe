<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import {
        getHistoryEntry,
        deleteHistoryEntry,
        updateHistoryEntry,
        type HistoryEntry,
    } from "$lib/services/history";
    import {
        generateWordDocument,
        saveDocument,
    } from "$lib/services/docx-export";
    import SpeakerEditModal from "$lib/components/SpeakerEditModal.svelte";
    import RefinePanel, {
        type RefineOptions,
    } from "$lib/components/RefinePanel.svelte";

    let entry: HistoryEntry | null = $state(null);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let exporting = $state(false);
    let identifying = $state(false);
    let speakerMapping = $state<Record<string, string>>({});

    // Audio player not available in web (no local file access)
    let audioElement: HTMLAudioElement | null = $state(null);
    let isPlaying = $state(false);
    let currentTime = $state(0);
    let duration = $state(0);
    let currentSegmentIndex = $state(-1);
    const audioSrc: null = null; // No local file system access

    // Inline speaker editing state - tracks segment INDEX for single-instance edits
    let editingSegmentIndex = $state<number | null>(null);
    let editingSpeakerNewName = $state("");

    // Bulk speaker edit modal state
    let showSpeakerEditModal = $state(false);

    // Refine panel state
    let showRefinePanel = $state(false);
    let isRefining = $state(false);
    let refineProgress = $state("");

    // Computed: Set of AI-inferred speaker names for display
    const aiInferredSet = $derived(new Set(entry?.aiInferredSpeakers ?? []));

    function isAiInferred(speakerName: string): boolean {
        return aiInferredSet.has(speakerName);
    }

    const id = $derived($page.params.id);

    onMount(async () => {
        await loadEntry();
    });

    async function loadEntry() {
        if (!id) {
            error = "No transcript ID provided";
            loading = false;
            return;
        }
        loading = true;
        error = null;
        try {
            entry = await getHistoryEntry(id);
        } catch (e) {
            error = `Failed to load transcript: ${e instanceof Error ? e.message : String(e)}`;
            console.error(error);
        } finally {
            loading = false;
        }
    }

    async function exportToWord() {
        if (!entry) return;

        exporting = true;
        error = null;
        try {
            const docBuffer = await generateWordDocument(entry.transcript, {
                filename: entry.filename,
                transcribedDate: new Date(entry.transcribedAt),
                includeSummary: entry.options.includedSummary,
                includeTopics: entry.options.includedTopics,
                includeSentiment: entry.options.includedSentiment,
            });

            const downloadName =
                entry.filename.replace(/\.[^/.]+$/, "") + "_transcript.docx";
            saveDocument(docBuffer, downloadName); // triggers browser download
        } catch (e) {
            error = `Failed to export: ${e instanceof Error ? e.message : String(e)}`;
            console.error(error);
        } finally {
            exporting = false;
        }
    }

    async function handleDelete() {
        if (!entry) return;
        if (
            !confirm(
                "Are you sure you want to delete this transcription from history?",
            )
        )
            return;

        try {
            await deleteHistoryEntry(entry.id);
            goto("/");
        } catch (e) {
            error = `Failed to delete: ${e instanceof Error ? e.message : String(e)}`;
        }
    }

    async function identifySpeakers() {
        if (!entry) return;

        identifying = true;
        error = null;

        try {
            const uniqueSpeakerLabels = [...new Set(entry.transcript.segments.map((s) => s.speaker))];
            const transcriptSample = entry.transcript.segments.slice(0, 80)
                .map((s) => `${s.speaker}: ${s.text}`)
                .join("\n");

            const systemPrompt = `You are an expert at identifying people from conversation transcripts.
Analyse the transcript below and identify real names for each speaker label.
Return ONLY a valid JSON object mapping speaker labels to their real names.
Example: {"SPEAKER_A": "Dr. Smith", "SPEAKER_B": "Jane Doe"}
If you cannot determine a name, keep the original label.`;

            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_prompt: systemPrompt,
                    messages: [{
                        role: 'user',
                        content: `Speaker labels: ${uniqueSpeakerLabels.join(', ')}\n\nTranscript sample:\n${transcriptSample}\n\nReturn ONLY the JSON mapping object.`
                    }]
                })
            });

            if (!res.ok) throw new Error(`Speaker ID request failed: ${res.statusText}`);
            const data = await res.json();

            let mapping: Record<string, string> = {};
            try {
                let rawText = data.text?.trim() || '{}';
                if (rawText.startsWith('```')) {
                    rawText = rawText.replace(/^```[a-z]*\n?/, '').replace(/```$/, '').trim();
                }
                mapping = JSON.parse(rawText);
            } catch {
                console.warn('Could not parse speaker mapping');
            }

            speakerMapping = mapping;

            if (Object.keys(mapping).length > 0) {
                const updatedSegments = entry.transcript.segments.map(
                    (segment) => ({
                        ...segment,
                        speaker: mapping[segment.speaker] || segment.speaker,
                    }),
                );

                const inferredNames = Object.values(mapping);

                entry = {
                    ...entry,
                    transcript: {
                        ...entry.transcript,
                        segments: updatedSegments,
                    },
                    aiInferredSpeakers: inferredNames,
                };

                await updateHistoryEntry(entry);
            }
        } catch (e) {
            error = `Failed to identify speakers: ${e instanceof Error ? e.message : String(e)}`;
            console.error(error);
        } finally {
            identifying = false;
        }
    }

    function formatDate(isoString: string): string {
        const date = new Date(isoString);
        return date.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    }

    function formatTime(ms: number): string {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${String(seconds).padStart(2, "0")}`;
    }

    function goBack() {
        goto("/");
    }

    function cleanTitle(filename: string): string {
        return filename
            .replace(/\.[^/.]+$/, "")
            .replace(/_/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    // Audio player functions (no-op in web — no local file)
    function handleTimeUpdate() {}
    function handleLoadedMetadata() {}
    function updateCurrentSegment() {}
    function seekToSegment(_segmentIndex: number) {}
    function togglePlayPause() {}
    function formatPlayTime(ms: number): string {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    // Inline speaker name editing
    function startEditingSegment(segmentIndex: number, event: MouseEvent) {
        event.stopPropagation();
        if (!entry) return;
        editingSegmentIndex = segmentIndex;
        editingSpeakerNewName = entry.transcript.segments[segmentIndex].speaker;
    }

    async function saveSegmentSpeaker() {
        if (
            !entry ||
            editingSegmentIndex === null ||
            !editingSpeakerNewName.trim()
        ) {
            editingSegmentIndex = null;
            return;
        }

        const oldName = entry.transcript.segments[editingSegmentIndex].speaker;
        const newName = editingSpeakerNewName.trim();

        if (oldName === newName) {
            editingSegmentIndex = null;
            return;
        }

        const updatedSegments = entry.transcript.segments.map((segment, i) => ({
            ...segment,
            speaker: i === editingSegmentIndex ? newName : segment.speaker,
        }));

        const stillUsed = updatedSegments.some((s) => s.speaker === oldName);
        let updatedAiInferred = entry.aiInferredSpeakers ?? [];
        if (!stillUsed) {
            updatedAiInferred = updatedAiInferred.filter((name) => name !== oldName);
        }

        entry = {
            ...entry,
            transcript: { ...entry.transcript, segments: updatedSegments },
            aiInferredSpeakers: updatedAiInferred,
        };

        await updateHistoryEntry(entry);
        editingSegmentIndex = null;
    }

    function cancelEditingSegment() {
        editingSegmentIndex = null;
        editingSpeakerNewName = "";
    }

    function handleEditKeydown(event: KeyboardEvent) {
        if (event.key === "Enter") saveSegmentSpeaker();
        else if (event.key === "Escape") cancelEditingSegment();
    }

    async function handleBulkSpeakerSave(renames: Record<string, string>) {
        if (!entry || Object.keys(renames).length === 0) {
            showSpeakerEditModal = false;
            return;
        }

        const updatedSegments = entry.transcript.segments.map((segment) => ({
            ...segment,
            speaker: renames[segment.speaker] ?? segment.speaker,
        }));

        let updatedAiInferred = [...(entry.aiInferredSpeakers ?? [])];
        for (const [oldName, newName] of Object.entries(renames)) {
            updatedAiInferred = updatedAiInferred.filter(
                (name) => name !== oldName && name !== newName,
            );
        }

        entry = {
            ...entry,
            transcript: { ...entry.transcript, segments: updatedSegments },
            aiInferredSpeakers: updatedAiInferred,
        };

        await updateHistoryEntry(entry);
        showSpeakerEditModal = false;
    }

    // Refine: Not available in web (requires stored audio file)
    async function handleRefine(_options: RefineOptions) {
        error = "Refinement requires stored audio, which is not available in the web version.";
        showRefinePanel = false;
    }
</script>

<svelte:head>
    <title
        >{entry ? cleanTitle(entry.filename) : "Transcript"} | OHG Scribe</title
    >
</svelte:head>

<main class="transcript-page">
    <header class="header">
        <button class="back-btn" onclick={goBack}>
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
            >
                <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
        </button>

        {#if entry}
            <div class="header-actions">
                <button
                    class="identify-btn"
                    onclick={identifySpeakers}
                    disabled={identifying}
                    title="Use AI to identify speaker names from transcript"
                >
                    {identifying ? "Identifying..." : "🪄 Identify Speakers"}
                </button>
                <button
                    class="edit-speakers-btn"
                    onclick={() => (showSpeakerEditModal = true)}
                    title="Bulk edit all speaker names"
                >
                    ✏️ Edit Speakers
                </button>
                {#if entry.audioPath}
                    <button
                        class="refine-btn"
                        onclick={() => (showRefinePanel = true)}
                        title="Re-transcribe with different settings"
                    >
                        ⚙️ Refine
                    </button>
                {/if}
                <button
                    class="export-btn"
                    onclick={exportToWord}
                    disabled={exporting}
                >
                    {exporting ? "Exporting..." : "Export to Word"}
                </button>
                <button class="delete-btn" onclick={handleDelete}>
                    Delete
                </button>
            </div>
        {/if}
    </header>

    <div class="content">
        {#if loading}
            <div class="loading">
                <div class="spinner"></div>
                <p>Loading transcript...</p>
            </div>
        {:else if error}
            <div class="error-state">
                <p class="error-message">{error}</p>
                <button class="retry-btn" onclick={loadEntry}>Try Again</button>
            </div>
        {:else if entry}
            <div class="transcript-header">
                <h1>{cleanTitle(entry.filename)}</h1>
                <div class="meta-row">
                    <span class="meta-item"
                        >📅 {formatDate(entry.transcribedAt)}</span
                    >
                    <span class="meta-item"
                        >👥 {entry.speakerCount} speakers</span
                    >
                    <span class="meta-item"
                        >📝 {entry.wordCount.toLocaleString()} words</span
                    >
                </div>
            </div>

            <!-- Audio Player -->
            {#if audioSrc}
                <div class="audio-player">
                    <audio
                        bind:this={audioElement}
                        src={audioSrc}
                        ontimeupdate={handleTimeUpdate}
                        onloadedmetadata={handleLoadedMetadata}
                        onplay={() => (isPlaying = true)}
                        onpause={() => (isPlaying = false)}
                        onended={() => {
                            isPlaying = false;
                            currentSegmentIndex = -1;
                        }}
                    ></audio>
                    <button class="play-btn" onclick={togglePlayPause}>
                        {isPlaying ? "⏸️" : "▶️"}
                    </button>
                    <div class="time-display">
                        {formatPlayTime(currentTime)} / {formatPlayTime(
                            duration,
                        )}
                    </div>
                    <input
                        type="range"
                        class="progress-slider"
                        min="0"
                        max={duration}
                        value={currentTime}
                        oninput={(e) => {
                            if (audioElement) {
                                audioElement.currentTime =
                                    Number(e.currentTarget.value) / 1000;
                            }
                        }}
                    />
                </div>
            {/if}

            <div class="transcript-body">
                {#each entry.transcript.segments as segment, i}
                    <div
                        id={`segment-${i}`}
                        class="segment"
                        class:even={i % 2 === 1}
                        class:playing={i === currentSegmentIndex}
                        onclick={() => seekToSegment(i)}
                        role="button"
                        tabindex="0"
                    >
                        <div class="segment-header">
                            {#if editingSegmentIndex === i}
                                <input
                                    type="text"
                                    class="speaker-edit-input"
                                    bind:value={editingSpeakerNewName}
                                    onblur={saveSegmentSpeaker}
                                    onkeydown={handleEditKeydown}
                                    onclick={(e) => e.stopPropagation()}
                                />
                            {:else}
                                <button
                                    class="speaker"
                                    class:ai-inferred={isAiInferred(
                                        segment.speaker,
                                    )}
                                    onclick={(e) => startEditingSegment(i, e)}
                                    title={isAiInferred(segment.speaker)
                                        ? "AI-inferred name — click to edit this instance"
                                        : "Click to edit this speaker instance"}
                                >
                                    {segment.speaker}
                                    {#if isAiInferred(segment.speaker)}
                                        <span
                                            class="ai-badge"
                                            title="AI-inferred name">✨</span
                                        >
                                    {/if}
                                </button>
                            {/if}
                            <span class="timestamp"
                                >{formatTime(segment.start)}</span
                            >
                        </div>
                        <p class="segment-text">{segment.text}</p>
                    </div>
                {/each}
            </div>
        {:else}
            <div class="empty-state">
                <p>Transcript not found.</p>
                <button class="back-btn-large" onclick={goBack}>Go Back</button>
            </div>
        {/if}
    </div>
</main>

{#if showSpeakerEditModal && entry}
    <SpeakerEditModal
        segments={entry.transcript.segments}
        aiInferredSpeakers={entry.aiInferredSpeakers ?? []}
        onSave={handleBulkSpeakerSave}
        onClose={() => (showSpeakerEditModal = false)}
    />
{/if}

{#if showRefinePanel && entry}
    <RefinePanel
        {entry}
        onRefine={handleRefine}
        onClose={() => (showRefinePanel = false)}
        {isRefining}
        {refineProgress}
    />
{/if}

<style>
    .transcript-page {
        height: 100vh;
        overflow: hidden;
        background: linear-gradient(
            180deg,
            var(--lavender-light, #f8f5fa) 0%,
            var(--white, #ffffff) 100%
        );
        display: flex;
        flex-direction: column;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 24px;
        background: rgba(255, 255, 255, 1);
        border-bottom: 1px solid var(--lavender-dark, #e8e0f0);
        position: sticky;
        top: 0;
        z-index: 100;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .back-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        background: none;
        border: none;
        color: var(--magenta, #e91388);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        padding: 8px 12px;
        border-radius: 8px;
        transition: all 0.2s;
    }

    .back-btn:hover {
        background: var(--lavender, #f0ebf5);
    }

    .header-actions {
        display: flex;
        gap: 12px;
    }

    .identify-btn {
        background: var(--white, #ffffff);
        color: var(--purple, #6b2d7b);
        border: 1px solid var(--purple, #6b2d7b);
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }

    .identify-btn:hover:not(:disabled) {
        background: var(--lavender-light, #f8f5fa);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(107, 45, 123, 0.2);
    }

    .identify-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .edit-speakers-btn {
        background: var(--white, #ffffff);
        color: var(--gray-600, #4b5563);
        border: 1px solid var(--lavender-dark, #e8e0f0);
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }

    .edit-speakers-btn:hover {
        background: var(--lavender-light, #f8f5fa);
        border-color: var(--purple, #6b2d7b);
        color: var(--purple, #6b2d7b);
    }

    .refine-btn {
        background: var(--white, #ffffff);
        color: var(--gray-600, #4b5563);
        border: 1px solid var(--lavender-dark, #e8e0f0);
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }

    .refine-btn:hover {
        background: var(--lavender-light, #f8f5fa);
        border-color: var(--gray-400, #9ca3af);
    }

    .export-btn {
        background: linear-gradient(
            135deg,
            var(--magenta, #e91388) 0%,
            var(--purple, #6b2d7b) 100%
        );
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }

    .export-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(233, 19, 136, 0.3);
    }

    .export-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .delete-btn {
        background: var(--white, #ffffff);
        color: var(--error-color, #ef4444);
        border: 1px solid var(--error-color, #ef4444);
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }

    .delete-btn:hover {
        background: var(--error-bg, #fef2f2);
    }

    .content {
        flex: 1;
        max-width: 900px;
        width: 100%;
        margin: 0 auto;
        padding: 32px 24px;
        overflow-y: auto;
    }

    .loading,
    .empty-state,
    .error-state {
        text-align: center;
        padding: 60px 20px;
        color: var(--gray-600, #4b5563);
    }

    .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--lavender-dark, #e8e0f0);
        border-top-color: var(--magenta, #e91388);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .error-message {
        background: var(--error-bg, #fef2f2);
        color: var(--error-color, #ef4444);
        padding: 16px;
        border-radius: 8px;
        margin-bottom: 16px;
    }

    .retry-btn,
    .back-btn-large {
        background: var(--lavender, #f0ebf5);
        border: none;
        color: var(--navy, #1a2b4a);
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        cursor: pointer;
    }

    .transcript-header {
        margin-bottom: 32px;
    }

    .transcript-header h1 {
        margin: 0 0 12px;
        font-size: 24px;
        font-weight: 600;
        color: var(--navy, #1a2b4a);
        word-break: break-word;
    }

    .meta-row {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
    }

    .meta-item {
        font-size: 14px;
        color: var(--gray-600, #4b5563);
    }

    .transcript-body {
        background: var(--white, #ffffff);
        border-radius: 16px;
        padding: 24px;
        padding-bottom: 100px; /* Space for fixed audio player */
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .segment {
        padding: 16px 0;
        padding-left: 12px;
        margin-left: -12px;
        border-bottom: 1px solid var(--lavender-dark, #e8e0f0);
        border-radius: 8px;
        cursor: pointer;
        transition:
            background-color var(--duration-fast, 150ms)
                var(--ease-out, ease-out),
            transform var(--duration-fast, 150ms) var(--ease-out, ease-out);
    }

    .segment:last-child {
        border-bottom: none;
    }

    .segment:hover {
        background-color: var(--lavender-light, #f8f5fa);
    }

    .segment.playing {
        background-color: rgba(233, 19, 136, 0.05);
        transform: translateX(4px);
    }

    .segment-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
    }

    .speaker {
        font-weight: 600;
        color: var(--magenta, #e91388);
        background: none;
        border: none;
        padding: 2px 6px;
        margin: -2px -6px;
        border-radius: 4px;
        cursor: pointer;
        font-size: inherit;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: background 0.15s;
    }

    .speaker:hover {
        background: var(--lavender-light, #f8f5fa);
    }

    .segment.even .speaker {
        color: var(--purple, #6b2d7b);
    }

    .speaker.ai-inferred {
        font-style: italic;
    }

    .ai-badge {
        font-size: 12px;
        cursor: help;
    }

    .speaker-edit-input {
        font-size: 14px;
        font-weight: 600;
        color: var(--magenta, #e91388);
        border: 1px solid var(--magenta, #e91388);
        border-radius: 4px;
        padding: 4px 8px;
        background: var(--white, #ffffff);
        outline: none;
        min-width: 120px;
    }

    .speaker-edit-input:focus {
        box-shadow: 0 0 0 2px rgba(233, 19, 136, 0.2);
    }

    .timestamp {
        font-size: 12px;
        color: var(--gray-400, #9ca3af);
        background: var(--lavender-light, #f8f5fa);
        padding: 2px 8px;
        border-radius: 4px;
    }

    .segment-text {
        margin: 0;
        font-size: 15px;
        line-height: 1.7;
        color: var(--navy, #1a2b4a);
    }

    /* Audio player - fixed to bottom */
    .audio-player {
        display: flex;
        align-items: center;
        gap: 12px;
        background: var(--white, #ffffff);
        border-radius: 12px 12px 0 0;
        padding: 16px 20px;
        box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 100;
    }

    .play-btn {
        background: linear-gradient(
            135deg,
            var(--magenta, #e91388) 0%,
            var(--purple, #6b2d7b) 100%
        );
        border: none;
        border-radius: 50%;
        width: 48px;
        height: 48px;
        font-size: 20px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        flex-shrink: 0;
    }

    .play-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(233, 19, 136, 0.3);
    }

    .time-display {
        font-size: 13px;
        color: var(--gray-600, #4b5563);
        font-variant-numeric: tabular-nums;
        min-width: 85px;
    }

    .progress-slider {
        flex: 1;
        height: 6px;
        -webkit-appearance: none;
        appearance: none;
        background: var(--lavender-dark, #e8e0f0);
        border-radius: 3px;
        cursor: pointer;
    }

    .progress-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--magenta, #e91388);
        cursor: pointer;
    }

    /* Clickable and playing segments */
    .segment {
        padding: 16px;
        border-bottom: 1px solid var(--lavender-dark, #e8e0f0);
        cursor: pointer;
        border-radius: 8px;
        margin: 0 -16px;
        transition:
            background 0.2s,
            border-color 0.2s;
    }

    .segment:hover {
        background: var(--lavender-light, #f8f5fa);
    }

    .segment.playing {
        background: linear-gradient(
            90deg,
            rgba(233, 19, 136, 0.08) 0%,
            rgba(107, 45, 123, 0.08) 100%
        );
        border-left: 3px solid var(--magenta, #e91388);
        padding-left: 13px;
    }
</style>
