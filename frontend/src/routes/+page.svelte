<script lang="ts">
  import { onMount } from "svelte";
  import DropZone from "$lib/components/DropZone.svelte";
  import FileQueue from "$lib/components/FileQueue.svelte";
  import OptionsPanel from "$lib/components/OptionsPanel.svelte";
  import SettingsModal from "$lib/components/SettingsModal.svelte";
  import Toast from "$lib/components/Toast.svelte";
  import SpeakerControls from "$lib/components/SpeakerControls.svelte";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import Workspace from "$lib/components/workspace/Workspace.svelte";

  import { queueStore } from "$lib/stores/queue";
  import { optionsStore } from "$lib/stores/options";
  import { workspaceStore } from "$lib/stores/workspace";
  import type { FileJob, TranscriptionOptions } from "$lib/types";
  import {
    uploadAudio,
    submitTranscription,
    waitForTranscription,
    parseTranscriptResponse,
  } from "$lib/services/transcription";
  import {
    generateWordDocument,
    saveDocument,
  } from "$lib/services/docx-export";
  import { saveToHistory, createHistoryEntry } from "$lib/services/history";

  let settingsOpen = $state(false);

  let jobs: FileJob[] = $state([]);
  let options: TranscriptionOptions = $state({
    speakerCount: "auto",
    speakerLabelMode: "generic",
    speakerNamesInput: "",
    boostWords: [],
    boostWordsInput: "",
    selectedPresets: [],
    includeSummary: false,
    detectTopics: false,
    analyzeSentiment: false,
    extractKeyPhrases: false,
  });
  let toasts: {
    id: string;
    message: string;
    type: "success" | "error" | "info";
  }[] = $state([]);
  let isProcessing = $state(false);

  // Map from jobId -> File (so we can upload from the browser)
  const fileMap = new Map<string, File>();

  queueStore.subscribe((value) => {
    jobs = value;
  });

  optionsStore.subscribe((value) => {
    options = value;
  });

  function handleFilesDropped(files: { filename: string; file: File }[]) {
    if ($workspaceStore.viewMode === "workspace") {
      workspaceStore.resetToNew();
    }

    // Convert to FileJob format (no filepath needed for web)
    const jobFiles = files.map(f => ({ filename: f.filename, filepath: f.filename }));
    queueStore.addFiles(jobFiles);

    // Store the actual File objects keyed by filename for later use
    files.forEach(f => {
      // The job ID is set by queueStore — find the newly added jobs
      // We use filename as a proxy until the job is processed
      fileMap.set(f.filename, f.file);
    });

    showToast(
      `Added ${files.length} file${files.length > 1 ? "s" : ""} to queue`,
      "info",
    );

    if (!isProcessing) {
      processQueue();
    }
  }

  async function processQueue() {
    if (isProcessing) return;
    isProcessing = true;

    while (true) {
      const queuedJob = jobs.find((j) => j.status === "queued");
      if (!queuedJob) break;
      await processFile(queuedJob.id);
    }

    isProcessing = false;
  }

  async function processFile(jobId: string) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    // Get the File object (keyed by filename, as set during drop)
    const file = fileMap.get(job.filename);
    if (!file) {
      queueStore.updateJob(jobId, { status: 'error', error: 'File reference lost — please re-add the file.' });
      return;
    }

    try {
      // Step 1: Upload through backend proxy to AssemblyAI (with real progress)
      queueStore.updateJob(jobId, { status: "uploading", progress: 20 });
      const uploadUrl = await uploadAudio(file, (pct) => {
        queueStore.updateJob(jobId, { progress: pct });
      });

      queueStore.updateJob(jobId, { progress: 40 });

      // Step 2: Submit transcription (backend holds the API key)
      queueStore.updateJob(jobId, { status: "transcribing", progress: 45 });
      const transcriptId = await submitTranscription(uploadUrl, job.filename, options);

      // Step 3: Wait for completion (polls backend)
      const response = await waitForTranscription(
        transcriptId,
        (status) => {
          if (status === "processing") {
            queueStore.updateJob(jobId, { progress: 65 });
          }
        },
      );

      queueStore.updateJob(jobId, { progress: 80 });

      // Step 4: Parse transcript
      queueStore.updateJob(jobId, { status: "generating", progress: 85 });
      const speakerNames = options.speakerNamesInput
        ? options.speakerNamesInput.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
        : [];

      const transcriptResult = parseTranscriptResponse(response, speakerNames);

      // Step 5: Generate and download Word document
      const docBuffer = await generateWordDocument(transcriptResult, {
        filename: job.filename,
        transcribedDate: new Date(),
        includeSummary: options.includeSummary,
        includeTopics: options.detectTopics,
        includeSentiment: options.analyzeSentiment,
      });

      const outputFilename = job.filename.replace(/\.[^/.]+$/, "_transcript.docx");
      saveDocument(docBuffer, outputFilename); // triggers browser download

      queueStore.updateJob(jobId, {
        status: "complete",
        progress: 100,
        outputPath: outputFilename,
      });

      // Step 6: Save to history
      try {
        const historyEntry = createHistoryEntry(
          job.filename,
          job.filename,
          transcriptResult,
          {
            speakerNames,
            includedSummary: options.includeSummary,
            includedTopics: options.detectTopics,
            includedSentiment: options.analyzeSentiment,
          },
        );

        await saveToHistory(historyEntry);

        queueStore.updateJob(jobId, {
          historyId: historyEntry.id,
          transcriptResult: transcriptResult,
        } as any);
      } catch (historyError) {
        console.warn("Failed to save to history:", historyError);
      }

      showToast(`Completed: ${job.filename}`, "success");
    } catch (error) {
      console.error("Error processing file:", error);
      queueStore.updateJob(jobId, {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      showToast(
        `Error: ${error instanceof Error ? error.message : "Failed to process file"}`,
        "error",
      );
    } finally {
      // Clean up file reference
      fileMap.delete(job.filename);
    }
  }

  function handleOpenFile(path: string) {
    // In web, there's no local file system access — show a toast
    showToast("Document was downloaded to your Downloads folder", "info");
  }

  function handleRetry(id: string) {
    queueStore.updateJob(id, {
      status: "queued",
      progress: 0,
      error: undefined,
    });
    if (!isProcessing) {
      processQueue();
    }
  }

  // Settings modal: in web app, API keys are server-managed.
  // The modal is kept for UX consistency but we don't store keys in the browser.
  async function handleSaveApiKeys(
    _assemblyaiKeyVal: string,
    _openaiKeyVal: string,
    _anthropicKeyVal: string,
  ) {
    showToast("API keys are managed server-side in this deployment", "info");
    settingsOpen = false;
  }

  function showToast(
    message: string,
    type: "success" | "error" | "info" = "info",
  ) {
    const id = Date.now().toString();
    toasts = [...toasts, { id, message, type }];
  }

  function removeToast(id: string) {
    toasts = toasts.filter((t) => t.id !== id);
  }

  function handleViewTranscript(job: FileJob) {
    if (job.status === "complete") {
      if ((job as any).transcriptResult) {
        workspaceStore.openWorkspace(
          (job as any).transcriptResult,
          job.id,
          job.filename,
        );
      } else {
        showToast("Transcript not available", "info");
      }
    } else {
      showToast("Transcript not available", "error");
    }
  }

  let hasJobs = $derived(jobs.length > 0);

  function handleNewTranscription() {
    workspaceStore.resetToNew();
  }
</script>

<main class="app-layout">
  <Sidebar onNew={handleNewTranscription} />

  <div class="main-content">
    {#if $workspaceStore.viewMode === "workspace"}
      <Workspace />
    {:else}
      <!-- Home: New Transcription Queue -->
      <div class="transcription-flow">
        <header class="header">
          <div class="header-brand">
            <div class="brand-icon">
              <svg viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="10" fill="none" stroke="white" stroke-width="1.5" />
                <path d="M11 16 V16 M13 13 V19 M16 10 V22 M19 13 V19 M21 15 V17"
                  stroke="white" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </div>
            <h1 class="brand-text">
              <span class="brand-ohg">OHG</span><span class="brand-scribe">Scribe</span>
            </h1>
          </div>
          <div class="header-actions">
            <button
              class="header-icon-btn"
              onclick={() => (settingsOpen = true)}
              aria-label="Settings"
              title="Settings"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </header>

        <div class="content-body">
          <SpeakerControls />
          <DropZone onFilesDropped={handleFilesDropped} compact={hasJobs} />
          {#if hasJobs}
            <FileQueue
              {jobs}
              onOpen={handleOpenFile}
              onRetry={handleRetry}
              onViewTranscript={handleViewTranscript}
            />
          {/if}
          <OptionsPanel />
        </div>
      </div>
    {/if}
  </div>

  <SettingsModal
    isOpen={settingsOpen}
    onClose={() => (settingsOpen = false)}
    onSave={handleSaveApiKeys}
    currentAssemblyAIKey=""
    currentOpenAIKey=""
    currentAnthropicKey=""
  />

  {#each toasts as toast (toast.id)}
    <Toast
      message={toast.message}
      type={toast.type}
      onClose={() => removeToast(toast.id)}
    />
  {/each}
</main>

<style>
  /* ============================================
     Launchpad Token Foundation — applied globally
     via :global(:root) for Docker container compatibility
     ============================================ */


  :global(:root) {
    /* Brand */
    --color-accent: #e91e8c;
    --color-accent-hover: #f74ba5;
    --color-accent-dark: #c4106f;
    --color-accent-muted: rgba(233, 30, 140, 0.1);
    --color-accent-glow: rgba(233, 30, 140, 0.25);

    --color-secondary: #00a8b8;
    --color-secondary-hover: #00bcd0;
    --color-secondary-muted: rgba(0, 168, 184, 0.1);

    /* OHG Dark Slate Header */
    --color-header-bg: #1a252f;
    --color-header-text: #ffffff;
    --color-header-text-secondary: rgba(255, 255, 255, 0.6);
    --color-header-border: rgba(255, 255, 255, 0.08);
    --color-header-hover: rgba(255, 255, 255, 0.08);

    /* Backgrounds */
    --color-bg-primary: #f8f9fb;
    --color-bg-secondary: #ffffff;
    --color-bg-surface: #f1f3f7;
    --color-bg-elevated: #ffffff;
    --color-bg-hover: #eef0f5;
    --color-bg-active: #e4e7ef;

    /* Borders */
    --color-border: #d8dce6;
    --color-border-subtle: #e8ebf0;
    --color-border-focus: #e91e8c;

    /* Text */
    --color-text-primary: #1e293b;
    --color-text-secondary: #475569;
    --color-text-muted: #94a3b8;
    --color-text-heading: #0f172a;

    /* Semantic */
    --color-success: #059669;
    --color-success-bg: rgba(5, 150, 105, 0.08);
    --color-warning: #d97706;
    --color-error: #dc2626;
    --color-error-bg: rgba(220, 38, 38, 0.08);

    /* Legacy aliases */
    --magenta: #e91e8c;
    --magenta-light: #f74ba5;
    --magenta-dark: #c4106f;
    --navy: #0f172a;
    --navy-light: #1e293b;
    --white: #ffffff;
    --lavender-light: #f1f3f7;
    --lavender: #eef0f5;
    --lavender-dark: #d8dce6;
    --gray-50: #f9fafb;
    --gray-100: #f1f3f7;
    --gray-200: #e8ebf0;
    --gray-300: #d8dce6;
    --gray-400: #94a3b8;
    --gray-500: #64748b;
    --gray-600: #475569;
    --gray-700: #1e293b;
    --bg-primary: #f8f9fb;
    --bg-secondary: #ffffff;
    --bg-tertiary: #f1f3f7;
    --bg-card: #ffffff;
    --bg-hover: #eef0f5;
    --text-primary: #1e293b;
    --text-secondary: #475569;
    --text-muted: #94a3b8;
    --border-color: #d8dce6;
    --accent-color: #e91e8c;
    --success-color: #059669;
    --error-color: #dc2626;
    --error-bg: rgba(220, 38, 38, 0.08);

    /* Typography */
    --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-size-xs: 0.75rem;
    --font-size-sm: 0.8125rem;
    --font-size-base: 0.875rem;
    --font-size-md: 1rem;
    --font-size-lg: 1.125rem;
    --font-weight-normal: 400;
    --font-weight-medium: 500;
    --font-weight-semibold: 600;
    --font-weight-bold: 700;

    /* Layout */
    --header-height: 56px;
    --sidebar-width: 260px;
    --radius-sm: 6px;
    --radius-md: 8px;
    --radius-lg: 12px;
    --radius-xl: 16px;
    --radius-full: 9999px;

    /* Shadows */
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.06);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
    --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
    --shadow-glow: 0 0 20px rgba(233,30,140,0.25);

    /* Transitions */
    --ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94);
    --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
    --transition-fast: 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
    --transition-base: 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
    --transition-slow: 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94);

    /* Animation Tokens */
    --duration-instant: 100ms;
    --duration-fast: 150ms;
    --duration-normal: 250ms;
    --duration-slow: 350ms;
    --duration-emphasis: 500ms;
    --ease-in: cubic-bezier(0.55, 0.06, 0.68, 0.19);
    --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
    --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.1);
  }

  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    font-family: var(--font-family);
    color: var(--color-text-primary);
    -webkit-font-smoothing: antialiased;
    background: var(--color-bg-primary);
    overflow: hidden;
  }

  :global(::-webkit-scrollbar) { width: 6px; height: 6px; }
  :global(::-webkit-scrollbar-track) { background: transparent; }
  :global(::-webkit-scrollbar-thumb) { background: var(--color-border); border-radius: 999px; }
  :global(::-webkit-scrollbar-thumb:hover) { background: var(--color-text-muted); }

  /* ============================================
     Page Layout
     ============================================ */

  :global(.app-layout) {

    display: flex;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }

  .main-content {
    flex: 1;
    height: 100%;
    overflow: hidden;
    background: var(--color-bg-primary);
    position: relative;
    display: flex;
    flex-direction: column;
  }

  /* Transcription Flow (Queue) Layout */
  .transcription-flow {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  /* === OHG Dark Header === */
  .header {
    height: var(--header-height);
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 24px;
    background: var(--color-header-bg);
    border-bottom: 3px solid var(--color-accent);
    flex-shrink: 0;
  }

  .header-brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .brand-icon {
    width: 30px;
    height: 30px;
    border-radius: 7px;
    background: var(--color-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .brand-icon svg {
    width: 22px;
    height: 22px;
  }

  .brand-text {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    display: flex;
    gap: 0;
    font-family: var(--font-family);
    letter-spacing: -0.01em;
  }

  .brand-ohg {
    color: var(--color-accent);
  }

  .brand-scribe {
    color: var(--color-header-text);
  }

  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .header-icon-btn {
    width: 34px;
    height: 34px;
    background: var(--color-header-hover);
    border: 1px solid var(--color-header-border);
    cursor: pointer;
    padding: 0;
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-header-text-secondary);
  }

  .header-icon-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: var(--color-header-text);
  }

  .content-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px;
    max-width: 800px;
    width: 100%;
    margin: 0 auto;
  }
</style>
