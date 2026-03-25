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
      <!-- Original Content (New Transcription Queue) -->
      <div class="transcription-flow">
        <header class="header">
          <div class="logo">
            <div class="logo-icon">
              <svg viewBox="0 0 32 32" fill="none">
                <circle
                  cx="16"
                  cy="16"
                  r="10"
                  fill="none"
                  stroke="white"
                  stroke-width="1.5"
                />
                <path
                  d="M11 16 V16 M13 13 V19 M16 10 V22 M19 13 V19 M21 15 V17"
                  stroke="white"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
            </div>
            <h1 class="logo-text">
              <span class="logo-ohg">OHG</span><span class="logo-scribe"
                >Scribe</span
              >
            </h1>
          </div>
          <div class="header-actions">
            <button
              class="header-btn"
              onclick={() => (settingsOpen = true)}
              aria-label="Settings"
              title="Settings"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
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
  :global(:root) {
    /* Primary */
    --magenta: #e91388;
    --magenta-light: #f74ba5;
    --magenta-dark: #c4106f;

    /* Secondary */
    --purple: #6b2d7b;
    --purple-light: #8b4d9b;

    /* Neutral */
    --navy: #1a2b4a;
    --navy-light: #2d4066;

    /* Backgrounds */
    --lavender-light: #f8f5fa;
    --lavender: #f0ebf5;
    --lavender-dark: #e8e0f0;

    /* Grays */
    --gray-100: #f9fafb;
    --gray-200: #e5e7eb;
    --gray-400: #9ca3af;
    --gray-600: #4b5563;

    /* Semantic */
    --success-color: #10b981;
    --error-color: #ef4444;
    --error-bg: #fef2f2;
    --white: #ffffff;

    /* Legacy mappings for compatibility */
    --accent-color: var(--magenta);
    --accent-hover: var(--magenta-dark);
    --accent-light: var(--lavender);
    --text-primary: var(--navy);
    --text-secondary: var(--gray-600);
    --bg-primary: var(--white);
    --bg-secondary: var(--lavender-light);
    --bg-hover: var(--lavender);
    --border-color: var(--lavender-dark);
  }

  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      sans-serif;
    color: var(--navy);
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
    overflow: hidden; /* App feels like native app */
  }

  .app-layout {
    display: flex;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }

  .main-content {
    flex: 1;
    height: 100%;
    overflow: hidden;
    background: var(--bg-primary);
    position: relative;
  }

  /* Transcription Flow (Queue) Layout */
  .transcription-flow {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 24px;
    border-bottom: 1px solid var(--lavender-dark);
    background: var(--white);
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .logo-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: linear-gradient(135deg, var(--magenta) 0%, var(--purple) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo-icon svg {
    width: 24px;
    height: 24px;
  }

  .logo-text {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    display: flex;
    gap: 0;
  }

  .logo-ohg {
    color: var(--magenta);
  }

  .logo-scribe {
    color: var(--navy);
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .header-btn {
    width: 36px;
    height: 36px;
    background: var(--white);
    border: none;
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--gray-600);
  }

  .header-btn:hover {
    background: var(--lavender);
    color: var(--navy);
  }

  .content-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px;
    max-width: 800px; /* SLightly wider now that we have space */
    width: 100%;
    margin: 0 auto;
  }
</style>
