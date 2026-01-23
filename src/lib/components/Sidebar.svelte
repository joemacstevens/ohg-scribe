<script lang="ts">
    import { onMount } from "svelte";
    import { fly, fade } from "svelte/transition";
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

<div class="sidebar">
    <div class="sidebar-header">
        <button class="new-job-btn" onclick={onNew}>
            <span class="icon">+</span>
            <span>New Transcription</span>
        </button>
    </div>

    <div class="history-list">
        <div class="section-label">History</div>
        {#if loading}
            <div class="loading">Loading...</div>
        {:else}
            {#each historyList as item}
                <button
                    class="history-item"
                    class:active={selectedId === item.id}
                    onclick={() => handleSelect(item.id)}
                >
                    <div class="item-title">{item.filename}</div>
                    <div class="item-meta">
                        <span>{formatDate(item.transcribedAt)}</span>
                        <span>•</span>
                        <span>{item.speakerCount} speakers</span>
                    </div>
                </button>
            {/each}
        {/if}
    </div>
</div>

<style>
    .sidebar {
        width: 250px;
        height: 100vh;
        border-right: 1px solid var(--border-color);
        background: var(--bg-secondary);
        display: flex;
        flex-direction: column;
    }

    .sidebar-header {
        padding: 16px;
        border-bottom: 1px solid var(--border-color);
        background: var(--white);
    }

    .new-job-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background: var(--magenta);
        color: white;
        border: none;
        padding: 12px;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 2px 4px rgba(233, 19, 136, 0.2);
    }

    .new-job-btn:hover {
        background: var(--magenta-dark);
        transform: translateY(-1px);
    }

    .icon {
        font-size: 18px;
        font-weight: 400;
    }

    .history-list {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
    }

    .section-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 12px;
        padding-left: 4px;
    }

    .history-item {
        width: 100%;
        text-align: left;
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid transparent;
        background: transparent;
        margin-bottom: 4px;
        cursor: pointer;
        transition: all 0.15s;
    }

    .history-item:hover {
        background: var(--bg-hover);
    }

    .history-item.active {
        background: var(--white);
        border-color: var(--lavender-dark);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .history-item.active .item-title {
        color: var(--magenta);
        font-weight: 600;
    }

    .item-title {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 4px;
    }

    .item-meta {
        font-size: 11px;
        color: var(--text-secondary);
        display: flex;
        gap: 6px;
    }

    .loading {
        padding: 20px;
        text-align: center;
        color: var(--text-secondary);
        font-size: 13px;
    }
</style>
