<script lang="ts">
  import type { FileJob } from "../types";

  interface Props {
    job: FileJob;
    onOpen?: (path: string) => void;
    onRetry?: (id: string) => void;
  }

  let { job, onOpen, onRetry }: Props = $props();

  const statusLabels: Record<FileJob["status"], string> = {
    queued: "Waiting...",
    converting: "Converting video...",
    uploading: "Uploading...",
    transcribing: "Transcribing...",
    generating: "Generating document...",
    complete: "Done",
    error: "Error",
  };

  function getStatusColor(status: FileJob["status"]): string {
    switch (status) {
      case "complete":
        return "var(--success-color, #10B981)";
      case "error":
        return "var(--error-color, #EF4444)";
      default:
        return "var(--magenta, #E91388)";
    }
  }
</script>

<div class="file-item" class:error={job.status === "error"}>
  <div class="file-info">
    <span class="filename" title={job.filename}>{job.filename}</span>
    <span class="status" style="color: {getStatusColor(job.status)}">
      {#if job.status === "error" && job.error}
        {job.error}
      {:else}
        {statusLabels[job.status]}
      {/if}
    </span>
  </div>

  <div class="file-actions">
    {#if job.status === "complete"}
      <span class="checkmark">✓</span>
      {#if job.outputPath && onOpen}
        <button class="open-btn" onclick={() => onOpen?.(job.outputPath!)}>
          Open
        </button>
      {/if}
    {:else if job.status === "error"}
      {#if onRetry}
        <button class="retry-btn" onclick={() => onRetry?.(job.id)}>
          Retry
        </button>
      {/if}
    {:else}
      <div class="progress-container">
        <div class="progress-bar" style="width: {job.progress}%"></div>
      </div>
      <span class="progress-text">{job.progress}%</span>
    {/if}
  </div>
</div>

<style>
  .file-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: var(--white, #ffffff);
    border-radius: 12px;
    gap: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .file-item.error {
    background: var(--error-bg, #fef2f2);
  }

  .file-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .filename {
    font-size: 14px;
    font-weight: 500;
    color: var(--navy, #1a2b4a);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status {
    font-size: 12px;
  }

  .file-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .checkmark {
    color: var(--success-color, #10b981);
    font-weight: bold;
    font-size: 18px;
  }

  .progress-container {
    width: 100px;
    height: 4px;
    background: var(--lavender, #f0ebf5);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--magenta, #e91388) 0%,
      var(--purple, #6b2d7b) 100%
    );
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 12px;
    color: var(--gray-600, #4b5563);
    width: 36px;
    text-align: right;
  }

  .open-btn,
  .retry-btn {
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .open-btn {
    background: linear-gradient(
      135deg,
      var(--magenta, #e91388) 0%,
      var(--purple, #6b2d7b) 100%
    );
    color: white;
  }

  .open-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(233, 19, 136, 0.3);
  }

  .retry-btn {
    background: var(--white, #ffffff);
    color: var(--magenta, #e91388);
    border: 1px solid var(--magenta, #e91388);
  }

  .retry-btn:hover {
    background: rgba(233, 19, 136, 0.05);
  }
</style>
