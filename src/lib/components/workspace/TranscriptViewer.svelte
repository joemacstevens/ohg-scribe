<script lang="ts">
    import { workspaceStore } from "$lib/stores/workspace";
    import { updateHistoryEntry, getHistoryEntry } from "$lib/services/history";

    let segments = $derived($workspaceStore.currentTranscript?.segments || []);
    let activeSpeakerId = $derived($workspaceStore.activeSpeakerId);
    let activeAttributionIds = $derived(
        $workspaceStore.activeAttributionIds || [],
    );

    // Audio Player State
    import { convertFileSrc } from "@tauri-apps/api/core";
    let audioPath = $derived($workspaceStore.audioPath);
    let audioSrc = $derived(audioPath ? convertFileSrc(audioPath) : null);

    let audioElement: HTMLAudioElement | null = $state(null);
    let isPlaying = $state(false);
    let currentTime = $state(0);
    let duration = $state(0);

    // Editing State
    let editingSpeakerIndex = $state<number | null>(null);
    let editSpeakerName = $state("");

    // Metadata
    let uniqueSpeakers = $derived(new Set(segments.map((s) => s.speaker)).size);
    let wordCount = $derived(
        segments.reduce((acc, s) => acc + s.text.split(" ").length, 0),
    );

    // Formatting
    function formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }

    function formatDate(dateStr: string | undefined) {
        if (!dateStr)
            return new Date().toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        return new Date(dateStr).toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function formatTimestamp(seconds: number) {
        const date = new Date(seconds); // segment.start is usually ms or s? Check data. segment.start typcially ms in this project?
        // Wait, jumpToTime uses startMs / 1000. So segments.start is ms.
        // But handleTimeUpdate uses seconds.
        // Let's assume start is ms.
        const s = Math.floor(seconds / 1000);
        return formatTime(s);
    }

    // Audio Actions
    function togglePlayPause() {
        if (!audioElement) return;
        if (isPlaying) {
            audioElement.pause();
        } else {
            audioElement.play();
        }
        isPlaying = !isPlaying;
    }

    function handleTimeUpdate() {
        if (audioElement) {
            currentTime = audioElement.currentTime;
        }
    }

    function handleLoadedMetadata() {
        if (audioElement) {
            duration = audioElement.duration;
        }
    }

    function jumpToTime(startMs: number) {
        if (audioElement) {
            audioElement.currentTime = startMs / 1000;
            audioElement.play();
            isPlaying = true;
        }
    }

    // Playback Tracking
    let currentSegmentIndex = $derived(
        segments.findIndex((s) => {
            const start = s.start / 1000;
            const end = s.end / 1000;
            return currentTime >= start && currentTime < end;
        }),
    );

    $effect(() => {
        // Auto-scroll to playing segment if not manually scrolling?
        // For now, let's just highlight. Auto-scroll can be annoying if editing elsewhere.
    });

    // Scroll to Attribution
    let blockRefs: HTMLElement[] = $state([]);
    $effect(() => {
        if (activeAttributionIds.length > 0) {
            const firstIndex = activeAttributionIds[0];
            if (blockRefs[firstIndex]) {
                blockRefs[firstIndex].scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                });
            }
        }
    });

    // Content Editing
    async function handleTextBlur(index: number, e: Event) {
        const target = e.target as HTMLElement;
        const newText = target.innerText;
        const segment = segments[index];

        if (newText !== segment.text) {
            workspaceStore.updateSegment(index, segment.speaker, newText);
            await persistChanges();
        }
    }

    // Speaker Editing
    function startEditingSpeaker(index: number, currentName: string) {
        editingSpeakerIndex = index;
        editSpeakerName = currentName;
    }

    async function saveSpeakerName(index: number) {
        if (editingSpeakerIndex !== index) return;

        const segment = segments[index];
        const oldName = segment.speaker;
        const newName = editSpeakerName.trim();

        if (newName && newName !== oldName) {
            if ($workspaceStore.currentTranscript) {
                // Update specific segment
                // To do bulk update properly, we might want a store action, but here we loop
                for (let i = 0; i < segments.length; i++) {
                    if (segments[i].speaker === oldName) {
                        workspaceStore.updateSegment(
                            i,
                            newName,
                            segments[i].text,
                        );
                    }
                }
                await persistChanges();
            }
        }
        editingSpeakerIndex = null;
    }

    async function persistChanges() {
        if ($workspaceStore.currentJobId && $workspaceStore.currentTranscript) {
            try {
                const entry = await getHistoryEntry(
                    $workspaceStore.currentJobId,
                );
                if (entry) {
                    entry.transcript = $workspaceStore.currentTranscript;
                    await updateHistoryEntry(entry);
                }
            } catch (e) {
                console.error("Failed to persist transcript changes", e);
            }
        }
    }
</script>

<div class="viewer-layout">
    <div class="viewer-header">
        <h1 class="transcript-title">
            {$workspaceStore.currentFilename || "Transcript"}
        </h1>
        <div class="transcript-meta">
            <span class="meta-item">📅 {formatDate(undefined)}</span>
            <span class="meta-separator">•</span>
            <span class="meta-item">👥 {uniqueSpeakers} speakers</span>
            <span class="meta-separator">•</span>
            <span class="meta-item">📝 {wordCount.toLocaleString()} words</span>
        </div>
    </div>

    <div class="transcript-scrollable">
        {#each segments as segment, i}
            <div
                class="transcript-entry"
                class:active={activeSpeakerId === segment.speaker}
                class:attributed={activeAttributionIds.includes(i)}
                class:playing={currentSegmentIndex === i}
                bind:this={blockRefs[i]}
            >
                <div class="entry-header">
                    {#if editingSpeakerIndex === i}
                        <input
                            type="text"
                            bind:value={editSpeakerName}
                            class="speaker-edit-input"
                            onblur={() => saveSpeakerName(i)}
                            onkeydown={(e) =>
                                e.key === "Enter" && saveSpeakerName(i)}
                            autofocus
                        />
                    {:else}
                        <button
                            class="speaker-name-btn"
                            onclick={() =>
                                startEditingSpeaker(i, segment.speaker)}
                            title="Click to rename"
                        >
                            {segment.speaker}
                        </button>
                    {/if}
                    <span class="timestamp"
                        >{formatTimestamp(segment.start)}</span
                    >
                    {#if audioSrc}
                        <button
                            class="play-entry-btn"
                            onclick={() => jumpToTime(segment.start)}
                            title="Play segment"
                        >
                            ▶
                        </button>
                    {/if}
                </div>

                <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
                <p
                    class="entry-text"
                    contenteditable
                    onblur={(e) => handleTextBlur(i, e)}
                    role="textbox"
                    tabindex="0"
                >
                    {segment.text}
                </p>
            </div>
        {/each}
    </div>

    {#if audioSrc}
        <div class="audio-player-fixed">
            <audio
                bind:this={audioElement}
                src={audioSrc}
                ontimeupdate={handleTimeUpdate}
                onloadedmetadata={handleLoadedMetadata}
                onplay={() => (isPlaying = true)}
                onpause={() => (isPlaying = false)}
                onended={() => (isPlaying = false)}
            ></audio>

            <button class="player-play-btn" onclick={togglePlayPause}>
                {isPlaying ? "⏸" : "▶"}
            </button>

            <div class="player-controls">
                <span class="time-display"
                    >{formatTime(currentTime)} / {formatTime(duration)}</span
                >
                <input
                    type="range"
                    class="progress-bar"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    oninput={(e) => {
                        const val = Number(e.currentTarget.value);
                        if (audioElement) audioElement.currentTime = val;
                        currentTime = val;
                    }}
                />
            </div>
        </div>
    {/if}
</div>

<style>
    .viewer-layout {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--bg-primary);
    }

    .viewer-header {
        padding: 24px 32px;
        background: var(--bg-primary);
        flex-shrink: 0;
    }

    .transcript-title {
        font-size: 24px;
        font-weight: 700;
        color: var(--navy);
        margin: 0 0 8px 0;
    }

    .transcript-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--gray-500);
        font-size: 14px;
    }

    .meta-separator {
        color: var(--gray-300);
    }

    .transcript-scrollable {
        flex: 1;
        overflow-y: auto;
        padding: 0 32px 100px 32px; /* Bottom padding for fixed player */
    }

    .transcript-entry {
        padding: 16px 20px;
        margin-bottom: 12px;
        background: var(--white);
        border-radius: 10px;
        border-left: 3px solid transparent;
        transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
    }

    .transcript-entry:hover {
        background: var(--lavender-light);
        border-left-color: var(--purple);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .transcript-entry.active {
        background: var(--lavender-light);
        border-left-color: var(--magenta);
    }

    .transcript-entry.attributed {
        background-color: #fff9c4;
        border-left-color: #fbc02d;
    }

    .transcript-entry.playing {
        border-left-color: var(--success-color);
        background-color: var(--gray-100);
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    }

    .entry-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
    }

    .speaker-name-btn {
        font-weight: 600;
        font-size: 14px;
        color: var(--purple); /* Could be dynamic per speaker */
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
    }

    .speaker-name-btn:hover {
        text-decoration: underline;
    }

    .speaker-edit-input {
        font-size: 14px;
        font-weight: 600;
        padding: 2px 4px;
        border: 1px solid var(--magenta);
        border-radius: 4px;
        outline: none;
    }

    .timestamp {
        font-size: 12px;
        color: var(--gray-400);
        font-family: monospace;
    }

    .entry-text {
        margin: 0;
        font-size: 15px;
        line-height: 1.6;
        color: var(--navy);
        outline: none;
    }

    .play-entry-btn {
        opacity: 0;
        background: none;
        border: none;
        color: var(--magenta);
        font-size: 10px;
        cursor: pointer;
        padding: 2px;
        transition: opacity 0.2s;
    }

    .transcript-entry:hover .play-entry-btn {
        opacity: 1;
    }

    /* Fixed Audio Player */
    .audio-player-fixed {
        position: fixed; /* Or absolute if container is relative, but fixed ensures overlay on scroll */
        bottom: 0;
        left: 0;
        right: 0; /* Will need adjustment if panel is open? No, it's inside viewer-layout? */
        /* If I put it inside viewer-layout, and viewer-layout is flex, I don't need fixed. */
        /* BUT the user asked for "Fixed to bottom of viewport". */
        /* If the right panel opens, the viewer shrinks. If I use `fixed` relative to viewport, it spans full width? */
        /* No, I should make it sticky or part of the flex layout. */
        /* The prompted CSS used "position: fixed". */
        /* I will use flex layout for structure, so the player stays at bottom of the viewer area. */
        /* Using normal flow in flex column is better than fixed. */
        background: var(--white);
        border-top: 1px solid var(--gray-200);
        padding: 16px 24px;
        display: flex;
        align-items: center;
        gap: 16px;
        z-index: 40;
        box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
    }

    /* Correction: If I make it part of flex, I just remove position:fixed. */
    /* So I'll override the previous .audio-player-fixed with flex properties */

    .audio-player-fixed {
        position: relative; /* It's just the last item in flex col */
        width: 100%;
    }

    .player-play-btn {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--magenta);
        color: white;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        cursor: pointer;
        transition: transform 0.1s;
    }

    .player-play-btn:active {
        transform: scale(0.95);
    }

    .player-controls {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 16px;
    }

    .time-display {
        font-family: monospace;
        font-size: 12px;
        color: var(--gray-600);
        min-width: 100px;
    }

    .progress-bar {
        flex: 1;
        accent-color: var(--magenta);
        height: 4px;
        cursor: pointer;
    }
</style>
