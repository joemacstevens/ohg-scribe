<script lang="ts">
    import { workspaceStore } from "$lib/stores/workspace";
    import {
        type Template,
        type Lexicon,
        type Style,
    } from "$lib/types/minutes";
    import { DEFAULT_TEMPLATES } from "$lib/data/templates";
    import { DEFAULT_STYLES } from "$lib/data/styles";
    import { MEDICAL_WRITER } from "$lib/data/personas";
    import SEMAGLUTIDE_LEXICON from "$lib/data/lexicons/semaglutide.json";
    import { generateMinutes } from "$lib/services/ai";
    import { fade, fly } from "svelte/transition";
    import StyleSelector from "./StyleSelector.svelte";
    import LexiconSelector from "./LexiconSelector.svelte";
    import { invoke } from "@tauri-apps/api/core";
    import { open } from "@tauri-apps/plugin-dialog";

    let selectedTemplate = $state<Template | null>(null);
    let selectedStyle = $state<Style>(DEFAULT_STYLES[1]); // Novo Nordisk as default
    let selectedLexicon = $state<Lexicon>(SEMAGLUTIDE_LEXICON as Lexicon);
    let isGenerating = $state(false);
    let error = $state<string | null>(null);
    let slideContext = $state("");

    // File Upload State
    let isExtracting = $state(false);
    let isDragOver = $state(false);

    async function handleGenerate() {
        if (!selectedTemplate || !$workspaceStore.currentTranscript) return;

        isGenerating = true;
        error = null;

        try {
            const minutesHtml = await generateMinutes({
                transcript: $workspaceStore.currentTranscript,
                template: selectedTemplate,
                persona: MEDICAL_WRITER, // Fixed base agent
                style: selectedStyle,
                lexicon: selectedLexicon,
                slideContext,
            });

            // First update content
            workspaceStore.updateMinutes(minutesHtml);

            // Then flip the flag to show the editor
            workspaceStore.setMinutesGenerated(true);
        } catch (e) {
            console.error(e);
            error = e instanceof Error ? e.message : String(e);
        } finally {
            isGenerating = false;
        }
    }

    function handleStyleSave(newStyle: Style) {
        selectedStyle = newStyle;
    }

    let {
        onGoToEditor,
        onMinutesGenerated,
    }: { onGoToEditor?: () => void; onMinutesGenerated?: () => void } =
        $props();

    // Intercept generate to call callback
    async function executeGenerate() {
        await handleGenerate();
        onMinutesGenerated?.();
    }

    // --- File Upload Logic ---

    async function handleFileRead(path: string) {
        isExtracting = true;
        error = null;
        try {
            const text = await invoke<string>("extract_document_text", {
                path,
            });
            if (text) {
                // Append with a separator if context already exists
                const separator = slideContext
                    ? "\n\n--- IMPORTED FILE ---\n"
                    : "";
                slideContext += separator + text;
            }
        } catch (e) {
            console.error(e);
            error = `Failed to read file: ${e}`;
        } finally {
            isExtracting = false;
        }
    }

    async function handleBrowse() {
        const selected = await open({
            multiple: false,
            filters: [
                {
                    name: "Presentations & Documents",
                    extensions: ["pptx", "ppt", "pdf", "docx", "txt", "md"],
                },
            ],
        });

        if (selected && typeof selected === "string") {
            await handleFileRead(selected);
        }
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault();
        isDragOver = false;

        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
            // In Tauri webview, File object might not have path directly exposed continuously
            // depending on version, but typically we need the OS path.
            // NOTE: The standard HTML5 File API doesn't expose full path for security.
            // However, Tauri's drop event usually does if configured, or we rely on the specific
            // tauri drag-drop plugin event.
            // WAIT - Standard web drag/drop in Tauri v2 essentially gives limited info.
            // BUT since user explicitly enabled "tauri-plugin-drag-drop" (historically) or uses file-drop event.
            // Let's assume standard behavior: we might need `tauri-plugin-fs` logic or the `tauri://file-drop` event
            // if we are listening on window.
            // actually, let's stick to the browsing button as primary reliable method
            // and try a simple check for 'path' property if available in current Tauri setup (often mocked in dev).
            // Safer to assume we might need the browse button mostly, but let's try reading the name at least.
            // Actually, reading file content via JS FileReader is possible for drag-drop!
            // BUT we want to use the RUST backend 'extract_document_text' which takes a PATH.
            // Obtaining a Path from a DragEvent in Webview is restricted.
            // Workaround: TAURI provides a specific event for file drops.
            // Let's implement `listen` imported from `@tauri-apps/api/event`.
            // HOWEVER, simple impl: just use Browse button to be 100% safe on paths.
            // Let's keep Drag/Drop as a visual cue but trigger browse?
            // OR - if we use `window.__TAURI__.event.listen('tauri://file-drop', ...)`

            // Re-evaluating: The user prompt asked to "upload". Drag and drop is nice.
            // `ExtractFromDocument.svelte` likely uses `open` dialog.
            // Let's stick to `open` dialog for guaranteed Path access for the Rust backend.
            // If I implement `handleDrop`, I can't easily get the absolute path for Rust
            // without using the tauri file-drop event listener which is global.
            // I will implement the Visual Drop Zone that just asks you to click it to browse,
            // or I'll add the global listener. Global listener is complex for a component.
            // I will settle for a Clickable "Drop Zone" visual that triggers browse.
            handleBrowse();
        }
    }
</script>

<div class="setup-container" in:fade>
    <div class="content-wrapper">
        <header class="setup-header">
            <h3>Create Meeting Minutes</h3>
            <p>
                Select a template to generate structured minutes from your
                transcript.
            </p>
        </header>

        <div class="template-grid">
            {#each DEFAULT_TEMPLATES as template}
                <button
                    class="template-card"
                    class:selected={selectedTemplate?.id === template.id}
                    onclick={() => (selectedTemplate = template)}
                >
                    <div class="preview-window">
                        <!-- Mini Wireframe Visualization -->
                        <div class="wireframe">
                            <div class="wf-header"></div>
                            <div class="wf-line long"></div>
                            <div class="wf-line short"></div>
                            <div class="wf-block"></div>
                            {#if template.id === "medical"}
                                <div class="wf-circle"></div>
                            {/if}
                            {#if template.id === "adboard"}
                                <div class="wf-cols">
                                    <div class="wf-col"></div>
                                    <div class="wf-col"></div>
                                </div>
                            {/if}
                        </div>
                    </div>
                    <div class="card-meta">
                        <span class="template-name">{template.name}</span>
                        <span class="template-desc">{template.description}</span
                        >
                    </div>
                </button>
            {/each}
        </div>

        <div class="selector-row">
            <StyleSelector bind:selected={selectedStyle} />
            <LexiconSelector bind:selected={selectedLexicon} />
        </div>

        <div class="field">
            <label class="section-label">Context Materials (Optional)</label>
            <p class="help-text">
                Import slides or paste text. This content is prioritized over
                the transcript for dates/titles/data.
            </p>

            <!-- Upload/Context Area -->
            <div class="context-container">
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="upload-zone"
                    class:drag-over={isDragOver}
                    class:processing={isExtracting}
                    onclick={handleBrowse}
                    ondragover={(e) => {
                        e.preventDefault();
                        isDragOver = true;
                    }}
                    ondragleave={() => (isDragOver = false)}
                    ondrop={handleDrop}
                >
                    {#if isExtracting}
                        <div class="spinner"></div>
                        <span>Extracting text...</span>
                    {:else}
                        <div class="icon">
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                            >
                                <path
                                    d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                                ></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                        </div>
                        <div class="upload-text">Import PDF / PPTX</div>
                    {/if}
                </div>

                <div class="divider">
                    <span>OR PASTE TEXT</span>
                </div>

                <textarea
                    class="context-input"
                    bind:value={slideContext}
                    placeholder="Results from imported file will appear here. &#10;You can also paste Slide/OCR text directly..."
                ></textarea>
            </div>
        </div>

        <div class="actions">
            {#if error}
                <div class="error-msg">{error}</div>
            {/if}

            <div class="action-row">
                {#if $workspaceStore.isMinutesGenerated}
                    <button class="cancel-btn" onclick={onGoToEditor}>
                        Cancel
                    </button>
                    <!-- "Generate" will overwrite -->
                {/if}

                <button
                    class="generate-btn"
                    disabled={!selectedTemplate || isGenerating}
                    onclick={executeGenerate}
                >
                    {#if isGenerating}
                        Generating...
                    {:else}
                        {$workspaceStore.isMinutesGenerated
                            ? "Regenerate Draft"
                            : "Generate Draft"}
                    {/if}
                </button>
            </div>
        </div>
    </div>
</div>

<style>
    .setup-container {
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 40px;
        background: var(--gray-100);
        overflow-y: auto;
    }

    .content-wrapper {
        width: 100%;
        max-width: 600px;
        display: flex;
        flex-direction: column;
        gap: 32px;
    }

    .setup-header {
        text-align: center;
    }

    .setup-header h3 {
        font-size: 20px;
        font-weight: 700;
        margin: 0 0 8px 0;
        color: var(--navy);
    }

    .setup-header p {
        margin: 0;
        color: var(--text-secondary);
        font-size: 15px;
    }

    /* Template Grid */
    .template-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 16px;
    }

    .template-card {
        display: flex;
        flex-direction: column;
        background: var(--white);
        border: 2px solid transparent;
        border-radius: 12px;
        padding: 0;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        overflow: hidden;
        text-align: left;
    }

    .template-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    }

    .template-card.selected {
        border-color: var(--magenta);
        background: #fff;
        box-shadow: 0 0 0 4px rgba(233, 19, 136, 0.15);
    }

    .preview-window {
        height: 100px;
        background: var(--lavender-light);
        border-bottom: 1px solid var(--gray-200);
        position: relative;
        padding: 12px;
        display: flex;
        justify-content: center;
    }

    .card-meta {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .template-name {
        font-weight: 600;
        color: var(--navy);
        font-size: 14px;
    }

    .template-desc {
        font-size: 12px;
        color: var(--gray-600);
        line-height: 1.4;
    }

    /* Wireframes */
    .wireframe {
        width: 80%;
        height: 100%;
        background: white;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        border-radius: 4px;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .wf-header {
        height: 6px;
        width: 40%;
        background: var(--gray-400);
        border-radius: 2px;
        margin-bottom: 4px;
    }
    .wf-line {
        height: 4px;
        background: var(--gray-200);
        border-radius: 2px;
    }
    .wf-line.long {
        width: 100%;
    }
    .wf-line.short {
        width: 70%;
    }
    .wf-block {
        flex: 1;
        background: var(--lavender);
        border-radius: 2px;
        margin-top: 4px;
        opacity: 0.5;
    }
    .wf-circle {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--magenta-light);
        margin-top: 4px;
    }
    .wf-cols {
        display: flex;
        gap: 4px;
        height: 40%;
        margin-top: 4px;
    }
    .wf-col {
        flex: 1;
        background: var(--gray-200);
        border-radius: 2px;
    }

    /* Style and Lexicon Selectors */
    .selector-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
    }

    .section-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--navy);
    }

    /* Actions */
    .actions {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 12px;
    }

    .error-msg {
        color: var(--error-color);
        font-size: 13px;
        background: var(--error-bg);
        padding: 8px 12px;
        border-radius: 6px;
        width: 100%;
        text-align: center;
    }

    .generate-btn {
        background: var(--magenta);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 10px;
        font-weight: 600;
        font-size: 15px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(233, 19, 136, 0.3);
        transition: all 0.2s;
        width: 100%;
    }

    .generate-btn:hover:not(:disabled) {
        background: var(--magenta-dark);
        transform: translateY(-1px);
    }

    .generate-btn:disabled {
        background: var(--gray-400);
        cursor: not-allowed;
        box-shadow: none;
        opacity: 0.7;
    }

    .action-row {
        width: 100%;
        display: flex;
        gap: 12px;
    }

    .cancel-btn {
        background: white;
        border: 1px solid var(--gray-300);
        color: var(--text-secondary);
        padding: 12px 16px;
        border-radius: 10px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }

    .cancel-btn:hover {
        background: var(--gray-50);
        color: var(--text-primary);
        border-color: var(--gray-400);
    }

    .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .help-text {
        font-size: 12px;
        color: var(--gray-500);
        margin: 0;
    }

    .context-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
        border: 1px solid var(--gray-300);
        padding: 12px;
        border-radius: 8px;
        background: white;
    }

    .context-input {
        width: 100%;
        height: 100px;
        padding: 8px;
        border: 1px solid var(--gray-200);
        border-radius: 6px;
        font-family: inherit;
        font-size: 13px;
        resize: vertical;
        background: var(--gray-50);
    }

    .context-input:focus {
        outline: none;
        border-color: var(--magenta);
        background: white;
    }

    /* Upload Zone */
    .upload-zone {
        border: 2px dashed var(--gray-300);
        border-radius: 6px;
        padding: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        cursor: pointer;
        transition: all 0.2s;
        background: var(--gray-50);
        color: var(--navy);
    }

    .upload-zone:hover,
    .upload-zone.drag-over {
        border-color: var(--magenta);
        background: rgba(233, 19, 136, 0.05);
        color: var(--magenta);
    }

    .upload-text {
        font-weight: 500;
        font-size: 13px;
    }

    .divider {
        display: flex;
        align-items: center;
        text-align: center;
        color: var(--gray-400);
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.5px;
    }

    .divider::before,
    .divider::after {
        content: "";
        flex: 1;
        border-bottom: 1px solid var(--gray-200);
    }
    .divider span {
        padding: 0 8px;
    }

    .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid var(--gray-300);
        border-top-color: var(--magenta);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>
