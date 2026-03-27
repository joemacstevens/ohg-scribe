<script lang="ts">
    import { workspaceStore } from "$lib/stores/workspace";
    import {
        generateWordDocument,
        generateMinutesDocument,
        saveDocument,
    } from "$lib/services/docx-export";
    import { generateMinutesPDF, savePDF } from "$lib/services/pdf-export";
    import { fade, fly } from "svelte/transition";
    import TranscriptNavigator from "./TranscriptNavigator.svelte";
    import TranscriptViewer from "./TranscriptViewer.svelte";
    import MinutesSetup from "./setup/MinutesSetup.svelte";
    import MinutesEditor from "./editor/MinutesEditor.svelte";
    import TranscriptChat from "./TranscriptChat.svelte";

    // Temporary placeholders until we build them
    let TranscriptNavigatorComponent = TranscriptNavigator;
    let TranscriptViewerComponent = TranscriptViewer;
    let MinutesSetupComponent = MinutesSetup;
    let MinutesEditorComponent = MinutesEditor;

    let isExportMenuOpen = $state(false);
    let isExporting = $state(false);
    let showMeetingMinutes = $state(false);
    let showTranscriptChat = $state(false);

    // Active panel type for mutually exclusive behavior
    type ActivePanel = "none" | "minutes" | "chat";
    let activePanel = $derived<ActivePanel>(
        showMeetingMinutes ? "minutes" : showTranscriptChat ? "chat" : "none",
    );

    // Resizable Panel Logic
    let panelWidth = $state(Math.min(window.innerWidth * 0.5, 900)); // Start expanded
    let isResizing = $state(false);

    function startResize(e: MouseEvent) {
        isResizing = true;
        // Prevent text selection while resizing
        document.body.style.userSelect = "none";
        document.body.style.cursor = "col-resize";

        window.addEventListener("mousemove", handleResize);
        window.addEventListener("mouseup", stopResize);
    }

    function handleResize(e: MouseEvent) {
        if (!isResizing) return;

        // Calculate new width: Window width - mouse X position
        const newWidth = window.innerWidth - e.clientX;

        // Constraints
        if (newWidth >= 300 && newWidth <= 900) {
            panelWidth = newWidth;
        }
    }

    function stopResize() {
        isResizing = false;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        window.removeEventListener("mousemove", handleResize);
        window.removeEventListener("mouseup", stopResize);
    }

    async function handleExportTranscript() {
        if (!$workspaceStore.currentTranscript || !$workspaceStore.currentJobId)
            return;
        isExportMenuOpen = false;
        isExporting = true;
        try {
            const buffer = await generateWordDocument(
                $workspaceStore.currentTranscript,
                {
                    filename:
                        $workspaceStore.currentJobId.split("/").pop() ||
                        "Transcript",
                    transcribedDate: new Date(),
                    includeSummary: true,
                    includeTopics: true,
                    includeSentiment: false,
                },
            );
            const path = $workspaceStore.currentJobId.replace(
                /\.[^/.]+$/,
                "_transcript.docx",
            );
            await saveDocument(buffer, path);
            alert("Transcript exported successfully to " + path);
        } catch (e) {
            console.error(e);
            alert("Export failed: " + String(e));
        } finally {
            isExporting = false;
        }
    }

    async function handleExportMinutes() {
        if (!$workspaceStore.minutesContent || !$workspaceStore.currentJobId)
            return;
        isExportMenuOpen = false;
        isExporting = true;
        try {
            const buffer = await generateMinutesDocument(
                $workspaceStore.minutesContent,
                $workspaceStore.currentJobId.split("/").pop() || "Minutes",
            );
            const path = $workspaceStore.currentJobId.replace(
                /\.[^/.]+$/,
                "_minutes.docx",
            );
            await saveDocument(buffer, path);
            alert("Minutes exported successfully to " + path);
        } catch (e) {
            console.error(e);
            alert("Export failed: " + String(e));
        } finally {
            isExporting = false;
        }
    }

    function confirmDelete() {
        if (
            confirm(
                "Are you sure you want to delete this transcript? This action cannot be undone.",
            )
        ) {
            // TODO: Implement delete logic
            console.log("Delete confirmed");
            workspaceStore.closeWorkspace();
        }
    }

    async function handleExportMinutesPDF() {
        if (!$workspaceStore.minutesContent || !$workspaceStore.currentJobId)
            return;
        isExportMenuOpen = false;
        isExporting = true;
        try {
            const buffer = await generateMinutesPDF(
                $workspaceStore.minutesContent,
                $workspaceStore.currentJobId.split("/").pop() || "Minutes",
            );
            const path = $workspaceStore.currentJobId.replace(
                /\.[^/.]+$/,
                "_minutes.pdf",
            );
            await savePDF(buffer, path);
            alert("PDF exported successfully to " + path);
        } catch (e) {
            console.error(e);
            alert("PDF export failed: " + String(e));
        } finally {
            isExporting = false;
        }
    }

    function openMeetingMinutes() {
        showTranscriptChat = false;
        showMeetingMinutes = true;
    }

    function openTranscriptChat() {
        showMeetingMinutes = false;
        showTranscriptChat = true;
    }

    // View Navigation Logic
    // Show editor if there's actual content, otherwise show setup
    let minutesViewMode = $state<"setup" | "editor">("setup");

    $effect.root(() => {
        // Check for actual content, not just the flag
        const hasContent =
            !!$workspaceStore.minutesContent &&
            $workspaceStore.minutesContent.trim().length > 0;
        minutesViewMode =
            hasContent && $workspaceStore.isMinutesGenerated
                ? "editor"
                : "setup";
    });
</script>

<div class="workspace-container" in:fade={{ duration: 200 }}>
    <header class="workspace-header">
        <div class="header-left">
            <button
                class="back-btn"
                onclick={() => workspaceStore.closeWorkspace()}
            >
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

            <div class="header-divider"></div>

            <button
                class="btn-outline"
                class:btn-outline-active={activePanel === "minutes"}
                onclick={openMeetingMinutes}
            >
                <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path
                        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                    ></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                Meeting Minutes
            </button>

            <button
                class="btn-outline"
                class:btn-outline-active={activePanel === "chat"}
                onclick={openTranscriptChat}
            >
                <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path
                        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                    ></path>
                </svg>
                Ask Transcript
            </button>
        </div>

        <div class="header-right">
            <!-- Export Dropdown -->
            <div class="export-wrapper">
                <button
                    class="btn-primary"
                    onclick={() => (isExportMenuOpen = !isExportMenuOpen)}
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                        ></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    {isExporting ? "Exporting..." : "Export"}
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>

                {#if isExportMenuOpen}
                    <div class="export-dropdown">
                        <button
                            onclick={handleExportMinutes}
                            disabled={!$workspaceStore.minutesContent}
                        >
                            <span>📄</span> Export to Word
                        </button>
                        <button
                            onclick={handleExportMinutesPDF}
                            disabled={!$workspaceStore.minutesContent}
                        >
                            <span>📕</span> Export to PDF
                        </button>
                    </div>
                {/if}
            </div>

            <button class="btn-danger-outline" onclick={confirmDelete}>
                <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path
                        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"
                    ></path>
                </svg>
                Delete
            </button>
            <button
                class="btn-icon"
                title="More options"
                onclick={() => alert("Re-transcribe options coming soon")}
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <circle cx="12" cy="12" r="1"></circle>
                    <circle cx="12" cy="5" r="1"></circle>
                    <circle cx="12" cy="19" r="1"></circle>
                </svg>
            </button>
        </div>
    </header>

    <div
        class="transcript-layout"
        class:panel-open={showMeetingMinutes || showTranscriptChat}
        style="--panel-width: {panelWidth}px"
    >
        <main class="transcript-main">
            <TranscriptViewerComponent />
        </main>

        {#if showMeetingMinutes}
            <aside
                class="meeting-minutes-panel"
                style="width: {panelWidth}px"
                transition:fly={{ x: 300, duration: 250 }}
            >
                <div class="resize-handle" role="presentation" aria-hidden="true" onmousedown={startResize}></div>
                <div class="panel-header">
                    <h3>Create Meeting Minutes</h3>
                    <button
                        class="btn-icon"
                        aria-label="Close Meeting Minutes panel"
                        onclick={() => (showMeetingMinutes = false)}
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="panel-content">
                    {#if minutesViewMode === "editor"}
                        <MinutesEditorComponent
                            onGoToSetup={() => (minutesViewMode = "setup")}
                        />
                    {:else}
                        <MinutesSetupComponent
                            onGoToEditor={() => (minutesViewMode = "editor")}
                            onMinutesGenerated={() =>
                                (minutesViewMode = "editor")}
                        />
                    {/if}
                </div>
            </aside>
        {/if}

        {#if showTranscriptChat}
            <aside
                class="meeting-minutes-panel"
                style="width: {panelWidth}px"
                transition:fly={{ x: 300, duration: 250 }}
            >
                <div class="resize-handle" role="presentation" aria-hidden="true" onmousedown={startResize}></div>
                <div class="panel-header">
                    <h3>💬 Ask the Transcript</h3>
                    <button
                        class="btn-icon"
                        aria-label="Close Ask Transcript panel"
                        onclick={() => (showTranscriptChat = false)}
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="panel-content">
                    <TranscriptChat />
                </div>
            </aside>
        {/if}
    </div>
</div>

<style>
    .workspace-container {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: var(--color-bg-surface);
    }

    .workspace-header {
        height: var(--header-height);
        background: var(--color-header-bg);
        border-bottom: 3px solid var(--color-accent);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 20px;
        flex-shrink: 0;
        gap: 8px;
    }

    .header-left {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .header-right {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .header-divider {
        width: 1px;
        height: 20px;
        background: var(--color-header-border);
        margin: 0 4px;
    }

    .back-btn {
        background: none;
        border: none;
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--color-header-text-secondary);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        font-family: var(--font-family);
        cursor: pointer;
        padding: 6px 10px;
        border-radius: var(--radius-md);
        transition: all var(--transition-fast);
    }

    .back-btn:hover {
        background: var(--color-header-hover);
        color: var(--color-header-text);
    }

    .btn-outline {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 6px 12px;
        background: var(--color-header-hover);
        border: 1px solid var(--color-header-border);
        border-radius: var(--radius-md);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        font-family: var(--font-family);
        color: var(--color-header-text-secondary);
        cursor: pointer;
        transition: all var(--transition-fast);
    }

    .btn-outline:hover {
        background: rgba(255,255,255,0.12);
        color: var(--color-header-text);
        border-color: rgba(255,255,255,0.2);
    }

    .btn-outline-active {
        background: var(--color-accent-muted);
        border-color: var(--color-accent);
        color: var(--color-accent);
    }

    .btn-primary {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 7px 16px;
        background: var(--color-accent);
        border: none;
        border-radius: var(--radius-md);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        font-family: var(--font-family);
        color: white;
        cursor: pointer;
        transition: all var(--transition-fast);
        box-shadow: 0 2px 8px var(--color-accent-glow);
    }

    .btn-primary:hover {
        background: var(--color-accent-hover);
        box-shadow: 0 4px 12px var(--color-accent-glow);
    }

    .btn-danger-outline {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 6px 12px;
        background: var(--color-header-hover);
        border: 1px solid rgba(239,68,68,0.3);
        border-radius: var(--radius-md);
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-medium);
        font-family: var(--font-family);
        color: #ff6b6b;
        cursor: pointer;
        transition: all var(--transition-fast);
    }

    .btn-danger-outline:hover {
        background: rgba(239,68,68,0.15);
        border-color: rgba(239,68,68,0.5);
        color: #ff4444;
    }

    .transcript-layout {
        flex: 1;
        display: flex;
        height: 100%;
        overflow: hidden;
        position: relative;
    }

    .transcript-main {
        flex: 1;
        overflow-y: auto;
        transition: margin-right 0.05s ease-out;
        background: var(--color-bg-surface);
    }

    /* When not resizing, we can have smooth transition. When resizing, instant. */
    /* Implementing separate class for resizing could be nice but complexity. */

    .transcript-layout.panel-open .transcript-main {
        margin-right: var(--panel-width, 360px);
    }

    .meeting-minutes-panel {
        position: fixed;
        top: var(--header-height);
        right: 0;
        bottom: 0;
        background: var(--color-bg-secondary);
        border-left: 1px solid var(--color-border);
        display: flex;
        flex-direction: column;
        box-shadow: -4px 0 24px rgba(0, 0, 0, 0.07);
        z-index: 50;
    }

    .resize-handle {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 12px; /* Invisible grab area */
        margin-left: -6px;
        cursor: col-resize;
        z-index: 60;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .resize-handle::after {
        content: "";
        width: 4px;
        height: 48px;
        background-color: var(--gray-300);
        border-radius: 2px;
        opacity: 0;
        transition: opacity 0.2s;
    }

    .resize-handle:hover::after,
    .meeting-minutes-panel:hover .resize-handle::after {
        /* Show handle on hover for discoverability */
        opacity: 0.5;
    }

    .panel-header {
        padding: 14px 20px;
        border-bottom: 1px solid var(--color-border-subtle);
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--color-header-bg);
        flex-shrink: 0;
    }

    .panel-header h3 {
        margin: 0;
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-semibold);
        color: var(--color-header-text);
        font-family: var(--font-family);
    }

    .panel-content {
        flex: 1;
        overflow-y: auto;
    }

    .btn-icon {
        background: none;
        border: none;
        color: var(--color-header-text-secondary);
        cursor: pointer;
        padding: 5px;
        border-radius: var(--radius-sm);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .btn-icon:hover {
        background: var(--color-header-hover);
        color: var(--color-header-text);
    }

    /* Export Dropdown */
    .export-wrapper {
        position: relative;
    }

    .export-dropdown {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 8px;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        width: 220px;
        z-index: 200;
        padding: 4px;
        display: flex;
        flex-direction: column;
    }

    .export-dropdown button {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 12px;
        border: none;
        background: none;
        text-align: left;
        font-size: var(--font-size-sm);
        font-family: var(--font-family);
        color: var(--color-text-primary);
        cursor: pointer;
        border-radius: var(--radius-sm);
        width: 100%;
    }

    .export-dropdown button:hover:not(:disabled) {
        background: var(--color-accent-muted);
        color: var(--color-accent);
    }

    .export-dropdown button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
</style>
