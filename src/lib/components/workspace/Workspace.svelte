<script lang="ts">
    import { workspaceStore } from "$lib/stores/workspace";
    import {
        generateWordDocument,
        generateMinutesDocument,
        saveDocument,
    } from "$lib/services/docx-export";
    import { fade, fly } from "svelte/transition";
    import TranscriptNavigator from "./TranscriptNavigator.svelte";
    import TranscriptViewer from "./TranscriptViewer.svelte";
    import MinutesSetup from "./setup/MinutesSetup.svelte";
    import MinutesEditor from "./editor/MinutesEditor.svelte";

    // Temporary placeholders until we build them
    let TranscriptNavigatorComponent = TranscriptNavigator;
    let TranscriptViewerComponent = TranscriptViewer;
    let MinutesSetupComponent = MinutesSetup;
    let MinutesEditorComponent = MinutesEditor;

    let isExportMenuOpen = $state(false);
    let isExporting = $state(false);
    let showMeetingMinutes = $state(false);

    // Resizable Panel Logic
    let panelWidth = $state(400); // Default width
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
        if (newWidth >= 300 && newWidth <= 800) {
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

    function identifySpeakers() {
        // TODO: Implement identify speakers logic
        console.log("Identify speakers clicked");
        alert("Speaker identification feature is coming soon.");
    }

    function openMeetingMinutes() {
        showMeetingMinutes = true;
    }

    // View Navigation Logic
    let minutesViewMode = $state<"setup" | "editor">("setup");

    $effect.root(() => {
        minutesViewMode = $workspaceStore.isMinutesGenerated
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

            <button class="btn-outline" onclick={identifySpeakers}>
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
                    <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"
                    ></path>
                    <path d="M4 6v12a2 2 0 0 0 2 2h14v-4"></path>
                    <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z"></path>
                </svg>
                Identify Speakers
            </button>

            <button class="btn-outline" onclick={openMeetingMinutes}>
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
                        <button onclick={handleExportTranscript}>
                            <span>📄</span> Export to Word
                        </button>
                        <button onclick={openMeetingMinutes}>
                            <span>📝</span> Create Meeting Minutes...
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
        class:panel-open={showMeetingMinutes}
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
                <div class="resize-handle" onmousedown={startResize}></div>
                <div class="panel-header">
                    <h3>Create Meeting Minutes</h3>
                    <button
                        class="btn-icon"
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
    </div>
</div>

<style>
    .workspace-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: var(--bg-secondary);
        z-index: 100;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .workspace-header {
        height: 64px;
        background: var(--white);
        border-bottom: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 24px;
        flex-shrink: 0;
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
        height: 24px;
        background: var(--gray-200);
        margin: 0 4px;
    }

    .back-btn {
        background: none;
        border: none;
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--text-secondary);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        padding: 6px 12px;
        border-radius: 6px;
        transition: all 0.2s;
    }

    .back-btn:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
    }

    .btn-outline {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: white;
        border: 1px solid var(--gray-300);
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        color: var(--navy);
        cursor: pointer;
        transition: all 0.2s;
    }

    .btn-outline:hover {
        background: var(--gray-50);
        border-color: var(--gray-400);
    }

    .btn-primary {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: linear-gradient(
            135deg,
            var(--magenta) 0%,
            var(--purple) 100%
        );
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        color: white;
        cursor: pointer;
        transition: all 0.2s;
    }

    .btn-primary:hover {
        opacity: 0.9;
    }

    .btn-danger-outline {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: white;
        border: 1px solid #fee2e2;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        color: #ef4444;
        cursor: pointer;
        transition: all 0.2s;
    }

    .btn-danger-outline:hover {
        background: #fef2f2;
        border-color: #fca5a5;
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
        /* Use the CSS variable if set, otherwise fallback logic in media queries if needed */
        /* But here we set margin dynamically */
        transition: margin-right 0.05s ease-out; /* Faster transition for resizing */
        background: var(--gray-50);
    }

    /* When not resizing, we can have smooth transition. When resizing, instant. */
    /* Implementing separate class for resizing could be nice but complexity. */

    .transcript-layout.panel-open .transcript-main {
        margin-right: var(--panel-width, 360px);
    }

    .meeting-minutes-panel {
        position: fixed;
        top: 64px; /* Header height */
        right: 0;
        bottom: 0;
        /* Width set inline */
        background: white;
        border-left: 1px solid var(--gray-200);
        display: flex;
        flex-direction: column;
        box-shadow: -4px 0 20px rgba(0, 0, 0, 0.05);
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
        padding: 16px 20px;
        border-bottom: 1px solid var(--gray-100);
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .panel-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--navy);
    }

    .panel-content {
        flex: 1;
        overflow-y: auto;
    }

    .btn-icon {
        background: none;
        border: none;
        color: var(--gray-400);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .btn-icon:hover {
        background: var(--gray-100);
        color: var(--text-primary);
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
        background: white;
        border: 1px solid var(--gray-200);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        width: 240px;
        z-index: 200;
        padding: 4px;
        display: flex;
        flex-direction: column;
    }

    .export-dropdown button {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border: none;
        background: none;
        text-align: left;
        font-size: 14px;
        color: var(--navy);
        cursor: pointer;
        border-radius: 4px;
        width: 100%;
    }

    .export-dropdown button:hover:not(:disabled) {
        background: var(--lavender-light);
        color: var(--purple);
    }
</style>
