<script lang="ts">
    import { onMount } from "svelte";
    import { getHistoryList, type HistorySummary } from "$lib/services/history";
    import { workspaceStore } from "$lib/stores/workspace";

    let { onNew } = $props<{ onNew: () => void }>();

    let historyList = $state<HistorySummary[]>([]);
    let loading = $state(false);
    let selectedId = $derived($workspaceStore.currentJobId);

    onMount(() => {
        loadHistory();
    });

    async function loadHistory() {
        loading = true;
        try {
            historyList = await getHistoryList();
        } catch (e) {
            console.error(e);
        } finally {
            loading = false;
        }
    }

    async function handleSelect(id: string) {
        await workspaceStore.loadFromHistory(id);
    }

    function formatDate(iso: string) {
        return new Date(iso).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
        });
    }
</script>

<aside class="sidebar">
    <!-- OHG Brand Header -->
    <div class="sidebar-brand">
        <div class="brand-icon">
            <svg viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="10" fill="none" stroke="white" stroke-width="1.5" />
                <path d="M11 16 V16 M13 13 V19 M16 10 V22 M19 13 V19 M21 15 V17"
                    stroke="white" stroke-width="1.5" stroke-linecap="round" />
            </svg>
        </div>
        <span class="brand-text">
            <span class="brand-ohg">OHG</span><span class="brand-scribe">Scribe</span>
        </span>
    </div>

    <!-- New Transcription -->
    <div class="sidebar-actions">
        <button class="new-btn" onclick={onNew}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Transcription
        </button>
    </div>

    <!-- History List -->
    <div class="history-section">
        <div class="section-label">HISTORY</div>

        {#if loading}
            <div class="loading-state">
                <span class="spinner"></span>
                <span>Loading...</span>
            </div>
        {:else if historyList.length === 0}
            <div class="empty-state">No transcriptions yet</div>
        {:else}
            <div class="history-list">
                {#each historyList as item}
                    <button
                        class="history-item"
                        class:active={selectedId === item.id}
                        onclick={() => handleSelect(item.id)}
                        title={item.filename}
                    >
                        <div class="item-title">{item.filename}</div>
                        <div class="item-footer">
                            <span class="item-meta">
                                {formatDate(item.transcribedAt)}
                                <span class="dot">·</span>
                                {item.speakerCount} speakers
                            </span>
                        </div>
                    </button>
                {/each}
            </div>
        {/if}
    </div>
</aside>

<style>
    .sidebar {
        width: var(--sidebar-width);
        height: 100vh;
        border-right: 1px solid var(--color-border-subtle);
        background: var(--color-bg-surface);
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        overflow: hidden;
    }

    /* === OHG Brand Header === */
    .sidebar-brand {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 16px;
        height: var(--header-height);
        background: var(--color-header-bg);
        border-bottom: 3px solid var(--color-accent);
        flex-shrink: 0;
    }

    .brand-icon {
        width: 26px;
        height: 26px;
        border-radius: 6px;
        background: var(--color-accent);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .brand-icon svg {
        width: 18px;
        height: 18px;
    }

    .brand-text {
        font-size: 15px;
        font-weight: 700;
        letter-spacing: -0.01em;
        font-family: var(--font-family);
    }

    .brand-ohg {
        color: var(--color-accent);
    }

    .brand-scribe {
        color: var(--color-header-text);
    }

    /* === Actions === */
    .sidebar-actions {
        padding: 12px;
        border-bottom: 1px solid var(--color-border-subtle);
        flex-shrink: 0;
    }

    .new-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        background: var(--color-accent);
        color: white;
        border: none;
        padding: 9px 12px;
        border-radius: var(--radius-md);
        font-weight: 600;
        font-size: var(--font-size-sm);
        font-family: var(--font-family);
        cursor: pointer;
        transition: all var(--transition-fast);
        box-shadow: 0 2px 8px var(--color-accent-glow);
    }

    .new-btn:hover {
        background: var(--color-accent-hover);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px var(--color-accent-glow);
    }

    /* === History Section === */
    .history-section {
        flex: 1;
        overflow-y: auto;
        padding: 12px 8px;
        display: flex;
        flex-direction: column;
    }

    .section-label {
        font-size: 10px;
        font-weight: 700;
        color: var(--color-text-muted);
        letter-spacing: 0.08em;
        padding: 4px 8px 8px;
    }

    .history-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .history-item {
        width: 100%;
        text-align: left;
        padding: 9px 10px;
        border-radius: var(--radius-md);
        border: 1px solid transparent;
        background: transparent;
        cursor: pointer;
        transition: all var(--transition-fast);
        font-family: var(--font-family);
    }

    .history-item:hover {
        background: var(--color-bg-hover);
    }

    .history-item.active {
        background: var(--color-bg-secondary);
        border-color: var(--color-border);
        box-shadow: var(--shadow-sm);
    }

    .history-item.active .item-title {
        color: var(--color-accent);
        font-weight: 600;
    }

    .item-title {
        font-size: var(--font-size-sm);
        font-weight: 500;
        color: var(--color-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 3px;
    }

    .item-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .item-meta {
        font-size: 11px;
        color: var(--color-text-muted);
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .dot {
        opacity: 0.5;
    }

    /* Loading / empty states */
    .loading-state {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 16px 8px;
        color: var(--color-text-muted);
        font-size: var(--font-size-sm);
    }

    .spinner {
        width: 14px;
        height: 14px;
        border: 2px solid var(--color-border);
        border-top-color: var(--color-accent);
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
        display: inline-block;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .empty-state {
        padding: 20px 8px;
        text-align: center;
        color: var(--color-text-muted);
        font-size: var(--font-size-sm);
    }
</style>
