<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { Editor } from "@tiptap/core";
    import StarterKit from "@tiptap/starter-kit";
    import Placeholder from "@tiptap/extension-placeholder";
    import BubbleMenuExtension from "@tiptap/extension-bubble-menu";
    import { Table } from "@tiptap/extension-table";
    import { TableRow } from "@tiptap/extension-table-row";
    import { TableCell } from "@tiptap/extension-table-cell";
    import { TableHeader } from "@tiptap/extension-table-header";
    import { workspaceStore } from "$lib/stores/workspace";
    import { refineText, expandText } from "$lib/services/ai";
    import {
        getHistoryEntry,
        updateHistoryEntry,
        type MinutesGeneration,
    } from "$lib/services/history";

    // Props
    let { onGoToSetup }: { onGoToSetup?: () => void } = $props();

    let element: HTMLElement;
    let editor: Editor;
    let bubbleMenuElement: HTMLElement;

    let isRefining = $state(false);
    let saveStatus = $state<"saved" | "saving" | "unsaved">("saved");
    let showHistory = $state(false);
    let historyItems = $state<MinutesGeneration[]>([]);
    let saveTimeout: ReturnType<typeof setTimeout>;

    // Debounced save to history
    async function saveToHistory() {
        const jobId = $workspaceStore.currentJobId;
        const content = editor?.getHTML();
        if (!jobId || !content) return;

        saveStatus = "saving";
        try {
            const entry = await getHistoryEntry(jobId);
            if (entry) {
                entry.minutes = content;
                // Update latest generation content if exists
                if (entry.minutesHistory && entry.minutesHistory.length > 0) {
                    entry.minutesHistory[0].content = content;
                }
                await updateHistoryEntry(entry);
                saveStatus = "saved";
            }
        } catch (e) {
            console.error("[MinutesEditor] Failed to save:", e);
            saveStatus = "unsaved";
        }
    }

    function debouncedSave() {
        saveStatus = "unsaved";
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveToHistory, 2000);
    }

    async function loadHistory() {
        const jobId = $workspaceStore.currentJobId;
        if (!jobId) return;

        const entry = await getHistoryEntry(jobId);
        historyItems = entry?.minutesHistory || [];
        showHistory = true;
    }

    function restoreGeneration(generation: MinutesGeneration) {
        if (editor) {
            editor.commands.setContent(generation.content);
            workspaceStore.updateMinutes(generation.content);
            showHistory = false;
        }
    }

    onMount(() => {
        editor = new Editor({
            element: element,
            extensions: [
                StarterKit,
                Placeholder.configure({
                    placeholder: "Generative minutes will appear here...",
                }),
                BubbleMenuExtension.configure({
                    element: bubbleMenuElement,
                    tippyOptions: { duration: 100 },
                }),
                Table.configure({
                    resizable: true,
                }),
                TableRow,
                TableHeader,
                TableCell,
            ],
            content: $workspaceStore.minutesContent || "",
            onUpdate: ({ editor }) => {
                workspaceStore.updateMinutes(editor.getHTML());
                debouncedSave();
            },
        });
    });

    onDestroy(() => {
        clearTimeout(saveTimeout);
        if (editor) {
            editor.destroy();
        }
    });

    async function handleRefine(instruction: string) {
        if (!editor) return;
        const { from, to, empty } = editor.state.selection;
        if (empty) return;

        const selectedText = editor.state.doc.textBetween(from, to, " ");

        isRefining = true;
        try {
            const refined = await refineText(selectedText, instruction);
            // Replace selection with refined text
            editor.chain().focus().insertContentAt({ from, to }, refined).run();
        } catch (e) {
            console.error(e);
            alert("Failed to refine text: " + String(e));
        } finally {
            isRefining = false;
        }
    }

    async function handleExpand() {
        if (!editor) return;
        const { from, to, empty } = editor.state.selection;
        if (empty) return;

        const selectedText = editor.state.doc.textBetween(from, to, " ");
        const transcriptData = $workspaceStore.currentTranscript;

        if (!transcriptData) {
            alert("No transcript available for context");
            return;
        }

        // Convert transcript segments to readable text
        const transcriptText = transcriptData.segments
            .map((seg) => `${seg.speaker}: ${seg.text}`)
            .join("\n");

        // Get the current minutes content for style matching
        const currentMinutes = editor.getText();

        isRefining = true;
        try {
            const expanded = await expandText(
                selectedText,
                transcriptText,
                currentMinutes,
            );
            // Replace selection with expanded text
            editor
                .chain()
                .focus()
                .insertContentAt({ from, to }, expanded)
                .run();
        } catch (e) {
            console.error(e);
            alert("Failed to expand text: " + String(e));
        } finally {
            isRefining = false;
        }
    }

    function handleStartOver() {
        // Non-destructive: just navigate back to setup screen
        // Minutes are auto-saved, user can return anytime
        if (onGoToSetup) {
            onGoToSetup();
        }
    }

    function formatDate(iso: string): string {
        return new Date(iso).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    }

    // Citation click handling
    let activeCitationIndex = $state<number | null>(null);

    function handleEditorClick(event: MouseEvent) {
        const citations = $workspaceStore.currentCitations;
        if (!citations || citations.length === 0) {
            console.log("[MinutesEditor] No citations available");
            return;
        }

        // Find the closest citable element (p or li)
        const target = event.target as HTMLElement;
        const citableElement = target.closest("p, li");
        if (!citableElement) {
            activeCitationIndex = null;
            clearActiveHighlights();
            return;
        }

        // Find the element index by walking through all <p> and <li> elements in the editor
        const editorElement = element?.querySelector(".ProseMirror");
        if (!editorElement) {
            console.log("[MinutesEditor] Editor element not found");
            return;
        }

        // Get all citable elements in order
        const allCitableElements = editorElement.querySelectorAll("p, li");
        let elementIndex = -1;
        allCitableElements.forEach((el, i) => {
            if (el === citableElement) elementIndex = i;
        });

        if (elementIndex === -1) {
            console.log("[MinutesEditor] Element not found in editor");
            return;
        }

        console.log(
            `[MinutesEditor] Clicked element index: ${elementIndex}, total citations: ${citations.length}`,
        );

        // Look up citation for this element
        const citation = citations.find(
            (c) => c.paragraphIndex === elementIndex,
        );

        if (citation && citation.sources.length > 0) {
            activeCitationIndex = elementIndex;
            console.log("[MinutesEditor] Found citation:", citation);

            // Find the transcript segment indices that match the citation times
            const transcript = $workspaceStore.currentTranscript;
            if (transcript) {
                const matchingIndices: number[] = [];
                citation.sources.forEach((source) => {
                    transcript.segments.forEach((seg, idx) => {
                        // Check if segment overlaps with citation time range (wider tolerance)
                        if (
                            seg.start >= source.startTime - 10 &&
                            seg.start <= source.endTime + 10
                        ) {
                            if (!matchingIndices.includes(idx)) {
                                matchingIndices.push(idx);
                            }
                        }
                    });
                });

                if (matchingIndices.length > 0) {
                    // Highlight these segments in the transcript
                    workspaceStore.highlightAttribution(matchingIndices);
                    console.log(
                        "[MinutesEditor] Scrolling to segments:",
                        matchingIndices,
                    );
                } else {
                    console.log(
                        "[MinutesEditor] No matching transcript segments found for times:",
                        citation.sources.map(
                            (s) => `${s.startTime}-${s.endTime}`,
                        ),
                    );
                }
            }

            // Add visual indicator to the clicked element
            highlightElement(allCitableElements, elementIndex);
        } else {
            console.log(
                `[MinutesEditor] No citation found for element index ${elementIndex}`,
            );
            activeCitationIndex = null;
            clearActiveHighlights();
        }
    }

    function highlightElement(elements: NodeListOf<Element>, index: number) {
        elements.forEach((el, i) => {
            el.classList.remove("citation-active");
            if (i === index) {
                el.classList.add("citation-active");
            }
        });
    }

    function clearActiveHighlights() {
        const editorElement = element?.querySelector(".ProseMirror");
        if (editorElement) {
            editorElement.querySelectorAll(".citation-active").forEach((el) => {
                el.classList.remove("citation-active");
            });
        }
    }
</script>

<div class="editor-layout">
    <div class="toolbar">
        <button
            class="tool-btn"
            onclick={() => editor?.chain().focus().toggleBold().run()}
            class:active={editor?.isActive("bold")}
        >
            <b>B</b>
        </button>
        <button
            class="tool-btn"
            onclick={() => editor?.chain().focus().toggleItalic().run()}
            class:active={editor?.isActive("italic")}
        >
            <i>I</i>
        </button>
        <div class="divider"></div>
        <button
            class="tool-btn"
            onclick={() =>
                editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            class:active={editor?.isActive("heading", { level: 1 })}
        >
            H1
        </button>
        <button
            class="tool-btn"
            onclick={() =>
                editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            class:active={editor?.isActive("heading", { level: 2 })}
        >
            H2
        </button>
        <div class="divider"></div>
        <button
            class="tool-btn"
            onclick={() => editor?.chain().focus().toggleBulletList().run()}
            class:active={editor?.isActive("bulletList")}
        >
            • List
        </button>

        <div class="spacer"></div>

        <!-- Save status indicator -->
        <div
            class="save-status"
            class:saved={saveStatus === "saved"}
            class:saving={saveStatus === "saving"}
        >
            {#if saveStatus === "saving"}
                <span class="status-dot"></span> Saving...
            {:else if saveStatus === "saved"}
                <span class="status-dot"></span> Saved
            {:else}
                <span class="status-dot"></span> Unsaved
            {/if}
        </div>

        {#if $workspaceStore.currentCitations && $workspaceStore.currentCitations.length > 0}
            <div
                class="citation-status"
                title="Click any paragraph to see its source in the transcript"
            >
                🔗 {$workspaceStore.currentCitations.length} citations
            </div>
        {/if}

        <div class="toolbar-actions">
            <button
                class="action-btn"
                class:active={showHistory}
                onclick={() => {
                    if (!showHistory) loadHistory();
                    else showHistory = false;
                }}
                title="View generation history"
            >
                📜 History
            </button>

            <button
                class="action-btn regenerate"
                onclick={handleStartOver}
                title="Go back and regenerate with different settings"
            >
                🔄 Regenerate
            </button>
        </div>
    </div>

    <!-- Main content area with optional history panel -->
    <div class="content-area">
        {#if showHistory}
            <div class="history-sidebar">
                <div class="history-header">
                    <h3>History</h3>
                    <button
                        class="close-btn"
                        onclick={() => (showHistory = false)}>×</button
                    >
                </div>
                <div class="history-list">
                    {#if historyItems.length === 0}
                        <p class="empty-state">No previous generations</p>
                    {:else}
                        {#each historyItems as item, i}
                            <button
                                class="history-item"
                                class:current={i === 0}
                                onclick={() => restoreGeneration(item)}
                            >
                                <div class="history-date">
                                    {formatDate(item.generatedAt)}
                                </div>
                                <div class="history-template">
                                    {item.templateName || "Unknown template"}
                                </div>
                                {#if i === 0}
                                    <span class="current-badge">Current</span>
                                {/if}
                            </button>
                        {/each}
                    {/if}
                </div>
            </div>
        {/if}

        <div
            class="editor-container"
            class:has-citations={$workspaceStore.currentCitations &&
                $workspaceStore.currentCitations.length > 0}
            bind:this={element}
            onclick={handleEditorClick}
        ></div>
    </div>

    <!-- Bubble Menu using pure HTML/CSS tied to Tiptap -->
    <div bind:this={bubbleMenuElement} class="bubble-menu-wrapper">
        {#if isRefining}
            <div class="refining-state">✨ Refining...</div>
        {:else}
            <div class="refine-options">
                <button
                    class="refine-btn"
                    onclick={() =>
                        handleRefine("Make this more professional and concise")}
                >
                    Formalize
                </button>
                <div class="sep"></div>
                <button
                    class="refine-btn"
                    onclick={() => handleRefine("Shorten this text")}
                >
                    Shorten
                </button>
                <div class="sep"></div>
                <button
                    class="refine-btn"
                    onclick={() => handleRefine("Fix grammar and spelling")}
                >
                    Fix Grammar
                </button>
                <div class="sep"></div>
                <button
                    class="refine-btn expand-btn"
                    onclick={handleExpand}
                    title="Add more detail from the transcript"
                >
                    ✨ Expand
                </button>
            </div>
        {/if}
    </div>
</div>

<style>
    .editor-layout {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: white;
    }

    .toolbar {
        padding: 12px;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        gap: 8px;
        align-items: center;
        background: var(--gray-100);
    }

    .spacer {
        flex: 1;
    }

    .text-btn {
        width: auto;
        padding: 0 12px;
        gap: 6px;
        font-family: var(--font-sans, sans-serif);
        font-size: 13px;
        color: var(--gray-600);
        font-weight: 500;
    }

    .text-btn:hover {
        color: var(--navy);
        background: var(--gray-200);
    }

    .icon {
        font-size: 16px;
        line-height: 1;
    }

    .tool-btn {
        width: 32px;
        height: 32px;
        border: 1px solid transparent;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-family: serif;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }

    .tool-btn:hover {
        background: var(--bg-hover);
    }
    .tool-btn.active {
        background: var(--lavender);
        color: var(--purple);
        border-color: var(--lavender-dark);
    }

    .divider {
        width: 1px;
        height: 20px;
        background: var(--gray-300);
        margin: 0 4px;
    }

    .editor-container {
        flex: 1;
        overflow-y: auto;
        padding: 40px;
        cursor: text;
    }

    /* Citation mode - clickable paragraphs and list items */
    .editor-container.has-citations :global(.ProseMirror p),
    .editor-container.has-citations :global(.ProseMirror li) {
        cursor: pointer;
        transition:
            background-color 0.2s ease,
            border-left 0.2s ease;
        padding-left: 8px;
        margin-left: -8px;
        border-left: 3px solid transparent;
        border-radius: 4px;
    }

    .editor-container.has-citations :global(.ProseMirror p:hover),
    .editor-container.has-citations :global(.ProseMirror li:hover) {
        background-color: rgba(99, 102, 241, 0.08);
        border-left-color: var(--magenta-light);
    }

    .editor-container.has-citations :global(.ProseMirror p.citation-active),
    .editor-container.has-citations :global(.ProseMirror li.citation-active) {
        background-color: rgba(99, 102, 241, 0.15);
        border-left-color: var(--magenta);
    }

    /* Bubble Menu */
    .bubble-menu-wrapper {
        background: var(--navy);
        color: white;
        border-radius: 8px;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
        padding: 4px;
        display: flex;
        align-items: center;
        overflow: hidden;
    }

    /* Hide bubble menu when idle */
    :global(.tippy-box[data-state="hidden"]) {
        opacity: 0;
    }

    .refine-options {
        display: flex;
        align-items: center;
    }

    .refine-btn {
        background: transparent;
        border: none;
        color: white;
        font-size: 12px;
        font-weight: 500;
        padding: 6px 10px;
        cursor: pointer;
        transition: background 0.1s;
        border-radius: 4px;
    }

    .refine-btn:hover {
        background: rgba(255, 255, 255, 0.1);
    }

    .sep {
        width: 1px;
        height: 12px;
        background: rgba(255, 255, 255, 0.2);
        margin: 0 2px;
    }

    .expand-btn {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 4px;
    }

    .expand-btn:hover {
        background: rgba(255, 255, 255, 0.25);
    }

    .refining-state {
        padding: 6px 12px;
        font-size: 12px;
        color: var(--magenta-light);
        font-weight: 600;
    }

    /* Tiptap Styles */
    :global(.ProseMirror) {
        outline: none;
        max-width: 800px;
        margin: 0 auto;
    }

    :global(.ProseMirror p.is-editor-empty:first-child::before) {
        color: #adb5bd;
        content: attr(data-placeholder);
        float: left;
        height: 0;
        pointer-events: none;
    }

    :global(.ProseMirror h1) {
        color: var(--navy);
        margin-top: 0;
    }
    :global(.ProseMirror h2) {
        color: var(--navy-light);
        margin-top: 24px;
    }
    :global(.ProseMirror ul) {
        padding-left: 20px;
    }
    :global(.ProseMirror li) {
        margin-bottom: 4px;
    }

    /* Table Styles */
    :global(.ProseMirror table) {
        border-collapse: collapse;
        width: 100%;
        margin: 16px 0;
        font-size: 14px;
    }

    :global(.ProseMirror th),
    :global(.ProseMirror td) {
        border: 1px solid var(--gray-300);
        padding: 10px 12px;
        text-align: left;
        vertical-align: top;
    }

    :global(.ProseMirror th) {
        background: var(--lavender);
        font-weight: 600;
        color: var(--navy);
    }

    :global(.ProseMirror tr:nth-child(even)) {
        background: var(--gray-100);
    }

    :global(.ProseMirror tr:hover) {
        background: var(--lavender-light);
    }

    /* Decision column styling */
    :global(.ProseMirror td:last-child) {
        font-weight: 500;
    }

    /* Save Status */
    .save-status {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--gray-500);
        padding: 0 8px;
    }

    .save-status .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--gray-400);
    }

    .save-status.saved .status-dot {
        background: var(--success-color, #10b981);
    }

    .save-status.saving .status-dot {
        background: var(--warning-color, #f59e0b);
        animation: pulse 1s ease-in-out infinite;
    }

    @keyframes pulse {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.4;
        }
    }

    .citation-status {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--magenta);
        padding: 0 12px;
        border-left: 1px solid var(--gray-300);
        cursor: help;
    }

    /* Toolbar Actions */
    .toolbar-actions {
        display: flex;
        gap: 8px;
        margin-left: 8px;
    }

    .action-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border: 1px solid var(--gray-300);
        border-radius: 6px;
        background: white;
        font-size: 13px;
        font-weight: 500;
        color: var(--gray-700);
        cursor: pointer;
        transition: all 0.15s ease;
        white-space: nowrap;
    }

    .action-btn:hover {
        background: var(--gray-100);
        border-color: var(--gray-400);
    }

    .action-btn.active {
        background: var(--lavender);
        border-color: var(--purple);
        color: var(--purple);
    }

    .action-btn.regenerate {
        background: linear-gradient(
            135deg,
            var(--magenta) 0%,
            var(--purple) 100%
        );
        color: white;
        border: none;
    }

    .action-btn.regenerate:hover {
        opacity: 0.9;
    }

    /* Content Area with Sidebar */
    .content-area {
        flex: 1;
        display: flex;
        overflow: hidden;
    }

    .content-area .editor-container {
        flex: 1;
        overflow-y: auto;
        padding: 40px;
        cursor: text;
    }

    /* History Sidebar */
    .history-sidebar {
        width: 240px;
        border-right: 1px solid var(--gray-200);
        background: var(--gray-50);
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
    }

    .history-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid var(--gray-200);
        background: white;
    }

    .history-header h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--navy);
    }

    .history-header .close-btn {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: var(--gray-500);
        padding: 0;
        line-height: 1;
    }

    .history-header .close-btn:hover {
        color: var(--gray-700);
    }

    .history-list {
        overflow-y: auto;
        padding: 8px;
        flex: 1;
    }

    .history-list .empty-state {
        text-align: center;
        color: var(--gray-500);
        padding: 24px 16px;
        font-size: 13px;
    }

    .history-item {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
        padding: 10px 12px;
        border: 1px solid var(--gray-200);
        border-radius: 6px;
        margin-bottom: 6px;
        background: white;
        cursor: pointer;
        text-align: left;
        transition: all 0.15s ease;
    }

    .history-item:hover {
        background: var(--lavender-light);
        border-color: var(--purple);
    }

    .history-item.current {
        background: var(--lavender);
        border-color: var(--purple);
    }

    .history-date {
        font-size: 12px;
        font-weight: 500;
        color: var(--navy);
    }

    .history-template {
        font-size: 11px;
        color: var(--gray-500);
    }

    .current-badge {
        font-size: 9px;
        background: var(--purple);
        color: white;
        padding: 2px 6px;
        border-radius: 8px;
        font-weight: 500;
        margin-top: 2px;
    }
</style>
