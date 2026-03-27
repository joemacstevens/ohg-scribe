<script lang="ts">
  import { ACCEPTED_EXTENSIONS } from "../types";

  interface Props {
    onFilesDropped: (files: { filename: string; file: File }[]) => void;
    disabled?: boolean;
    compact?: boolean;
  }

  let { onFilesDropped, disabled = false, compact = false }: Props = $props();

  let isDragOver = $state(false);
  let fileInput: HTMLInputElement | null = $state(null);

  function filterFiles(fileList: FileList): { filename: string; file: File }[] {
    return Array.from(fileList)
      .filter((f) => {
        const ext = "." + f.name.split(".").pop()?.toLowerCase();
        return ACCEPTED_EXTENSIONS.includes(ext);
      })
      .map((f) => ({ filename: f.name, file: f }));
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (!disabled) isDragOver = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    isDragOver = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragOver = false;
    if (disabled || !e.dataTransfer?.files.length) return;
    const valid = filterFiles(e.dataTransfer.files);
    if (valid.length > 0) onFilesDropped(valid);
  }

  function handleClick() {
    if (disabled) return;
    fileInput?.click();
  }

  function handleInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;
    const valid = filterFiles(input.files);
    if (valid.length > 0) onFilesDropped(valid);
    input.value = ""; // Reset so same file can be chosen again
  }
</script>

<!-- Hidden native file input -->
<input
  bind:this={fileInput}
  type="file"
  multiple
  accept={ACCEPTED_EXTENSIONS.join(",")}
  onchange={handleInputChange}
  style="display:none"
/>

<div
  class="drop-zone"
  class:drag-over={isDragOver}
  class:disabled
  class:compact
  role="button"
  tabindex="0"
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  onclick={handleClick}
  onkeydown={(e) => e.key === "Enter" && handleClick()}
>
  {#if compact}
    <span class="compact-text">Drop more files</span>
  {:else}
    <div class="drop-content">
      <div class="icon-circle">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          stroke-width="2"
          stroke-linecap="round"
        >
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17,8 12,3 7,8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
      <p class="main-text">Drop files here</p>
      <p class="sub-text">or click to browse</p>
    </div>
  {/if}
</div>

<style>
  .drop-zone {
    border: 2px dashed var(--lavender-dark, #e8e0f0);
    border-radius: 16px;
    padding: 48px 24px;
    text-align: center;
    cursor: pointer;
    background: var(--white, #ffffff);
    transition:
      border-color var(--duration-fast, 150ms) var(--ease-out, ease-out),
      background-color var(--duration-fast, 150ms) var(--ease-out, ease-out),
      transform var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  .drop-zone:hover:not(.disabled) {
    border-color: var(--magenta, #e91388);
    background: linear-gradient(
      180deg,
      rgba(233, 19, 136, 0.02) 0%,
      var(--white) 100%
    );
  }

  .drop-zone.drag-over {
    border-color: var(--magenta, #e91388);
    border-style: solid;
    background: linear-gradient(
      180deg,
      rgba(233, 19, 136, 0.05) 0%,
      var(--white) 100%
    );
    transform: scale(1.01);
  }

  .drop-zone.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .drop-zone.compact {
    padding: 16px 24px;
  }

  .drop-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .icon-circle {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--color-accent);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-circle svg {
    width: 28px;
    height: 28px;
  }

  .main-text {
    font-size: 18px;
    font-weight: 600;
    color: var(--navy, #1a2b4a);
    margin: 0;
  }

  .sub-text {
    font-size: 14px;
    color: var(--gray-600, #4b5563);
    margin: 0;
  }

  .compact-text {
    font-size: 14px;
    color: var(--gray-600, #4b5563);
  }
</style>
